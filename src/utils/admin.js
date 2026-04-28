import { createClient } from "@supabase/supabase-js";
import {
  generateAttendanceQrSvg,
  isValidEmployeeCode,
  normalizeEmployeeCode,
} from "./attendanceQr";
import { parseAttendanceQrPayload } from "./attendanceQr";
import {
  appendPersonalBreakHistoryEvent,
  getPersonalBreakState,
  PERSONAL_BREAK_TOTAL_SECONDS,
} from "./personalBreak";

const supabaseAdmin = createClient(
	import.meta.env.VITE_SUPABASE_URL,
	import.meta.env.VITE_SUPABASE_ROLE_KEY,
	{
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
			storageKey: "supabase-admin-session",
		},
	}
);

// Account creation


export const createUser = async ({ first_name, last_name, email, password, role }) => {
  try {
    // 1. Create user without affecting current session
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // optional
    });
    if (error) throw error;
    
    const authUserId = data?.user?.id ?? data?.id;
    if (!authUserId) throw new Error("Created auth user id not found");

    // 2. Insert into profiles table
    const { error: profileError } = await supabaseAdmin.from("user_profiles").insert([
      {
        auth_id: authUserId,
        first_name,
        last_name,
        email,
        role: role || "Employee",
      },
    ]);
    if (profileError) throw profileError;

    return { success: true, user: data?.user ?? data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const listUserProfiles = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateUserAccount = async ({
  auth_id,
  first_name,
  last_name,
  password,
  employee_code,
}) => {
  try {
    if (!auth_id) throw new Error("auth_id is required");

    const normalizedEmployeeCode = normalizeEmployeeCode(employee_code);
    if (normalizedEmployeeCode && !isValidEmployeeCode(normalizedEmployeeCode)) {
      throw new Error("Employee ID must be exactly 7 digits.");
    }

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from("user_profiles")
      .select(
        "auth_id, email, role, employee_code, attendance_qr_payload, attendance_qr_svg",
      )
      .eq("auth_id", auth_id)
      .maybeSingle();

    if (existingProfileError) throw existingProfileError;
    if (!existingProfile?.auth_id) throw new Error("User profile not found.");

    if (
      normalizedEmployeeCode &&
      normalizedEmployeeCode !== existingProfile.employee_code
    ) {
      const { data: duplicateProfile, error: duplicateProfileError } =
        await supabaseAdmin
          .from("user_profiles")
          .select("auth_id")
          .eq("employee_code", normalizedEmployeeCode)
          .neq("auth_id", auth_id)
          .maybeSingle();

      if (duplicateProfileError) throw duplicateProfileError;
      if (duplicateProfile?.auth_id) {
        throw new Error(
          "Employee ID already exists. Use a different 7-digit value.",
        );
      }
    }

    const shouldRefreshQr =
      !!normalizedEmployeeCode &&
      (!existingProfile.attendance_qr_svg ||
        !existingProfile.attendance_qr_payload ||
        normalizedEmployeeCode !== existingProfile.employee_code);

    const qrRecord = shouldRefreshQr
      ? await generateAttendanceQrSvg(normalizedEmployeeCode)
      : null;

    const profilePatch = {
      first_name,
      last_name,
      employee_code: normalizedEmployeeCode || existingProfile.employee_code,
      attendance_qr_payload:
        qrRecord?.payload ?? existingProfile.attendance_qr_payload,
      attendance_qr_svg: qrRecord?.svg ?? existingProfile.attendance_qr_svg,
    };

    // 1) Update profile details
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .update(profilePatch)
      .eq("auth_id", auth_id);

    if (profileError) throw profileError;

    // 2) Update password (optional)
    const safePassword = (password ?? "").trim();
    if (safePassword.length > 0) {
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(auth_id, {
        password: safePassword,
      });
      if (pwError) throw pwError;
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteUserAccount = async ({ auth_id }) => {
  try {
    if (!auth_id) throw new Error("auth_id is required");

    // Deleting from auth should cascade to user_profiles if FK is set up with on delete cascade.
    // If not, this still removes the login.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(auth_id);
    if (error) throw error;
 
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const listTimeEntriesByAuthId = async ({ auth_id }) => {
  try {
    if (!auth_id) throw new Error("auth_id is required");

    const { data, error } = await supabaseAdmin
      .from("time_entries")
      .select("*")
      .eq("auth_id", auth_id)
      .order("shift_date", { ascending: false });

    if (error) throw error;
    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const listTimeEntriesByShiftDate = async ({ shift_date }) => {
  try {
    if (!shift_date) throw new Error("shift_date is required");

    const { data, error } = await supabaseAdmin
      .from("time_entries")
      .select("*")
      .eq("shift_date", shift_date)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const autoEndExpiredBreaksByShiftDate = async ({ shift_date }) => {
  try {
    if (!shift_date) throw new Error("shift_date is required");

    const { data, error } = await supabaseAdmin
      .from("time_entries")
      .select(
        "auth_id, shift_date, personal_break_started_at, personal_break_last_started_at, personal_break_ended_at, personal_break_remaining_seconds, personal_break_is_paused, personal_break_history",
      )
      .eq("shift_date", shift_date);

    if (error) throw error;

    const expiredUpdates = [];

    for (const entry of data ?? []) {
      const state = getPersonalBreakState(entry);
      if (state.isRunning && state.remainingSeconds === 0) {
        expiredUpdates.push({
          auth_id: entry.auth_id,
          shift_date: entry.shift_date,
          personal_break_last_started_at: null,
          personal_break_ended_at: new Date().toISOString(),
          personal_break_remaining_seconds: 0,
          personal_break_is_paused: false,
          personal_break_history: appendPersonalBreakHistoryEvent(
            entry?.personal_break_history,
            {
              type: "complete",
              at: new Date().toISOString(),
              remainingSeconds: 0,
              note: "auto_end",
            },
          ),
        });
      }
    }

    if (expiredUpdates.length === 0) {
      return { success: true, updated: 0 };
    }

    for (const patch of expiredUpdates) {
      const { auth_id, shift_date: patchShiftDate, ...fields } = patch;
      const updateRes = await supabaseAdmin
        .from("time_entries")
        .update(fields)
        .eq("auth_id", auth_id)
        .eq("shift_date", patchShiftDate);

      if (updateRes.error) throw updateRes.error;
    }

    return { success: true, updated: expiredUpdates.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const recordAttendanceByQr = async ({
  rawValue,
  expectedAuthId = null,
} = {}) => {
  try {
    const parsed = parseAttendanceQrPayload(rawValue);
    if (!parsed.success) {
      throw new Error(parsed.error);
    }

    const employeeCode = parsed.employeeCode;
    const nowIso = new Date().toISOString();
    const shiftDate = new Date().toLocaleDateString("en-CA");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("auth_id, first_name, last_name, email, role, employee_code")
      .eq("employee_code", employeeCode)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile?.auth_id) {
      throw new Error("No employee account matches this QR code.");
    }
    if (profile.role !== "Employee") {
      throw new Error("Only employee accounts can use attendance QR scanning.");
    }
    if (expectedAuthId && profile.auth_id !== expectedAuthId) {
      throw new Error("This QR code does not belong to the signed-in employee.");
    }

    const { data: weeklyShift, error: weeklyShiftError } = await supabaseAdmin
      .from("employee_weekly_shifts")
      .select("employee_auth_id, week_start, week_end, shift_start_time, shift_end_time")
      .eq("employee_auth_id", profile.auth_id)
      .lte("week_start", shiftDate)
      .gte("week_end", shiftDate)
      .maybeSingle();

    if (weeklyShiftError) throw weeklyShiftError;
    if (!weeklyShift?.employee_auth_id) {
      throw new Error("This employee has no assigned shift for today.");
    }

    const { data: existingEntry, error: entryError } = await supabaseAdmin
      .from("time_entries")
      .select("*")
      .eq("auth_id", profile.auth_id)
      .eq("shift_date", shiftDate)
      .maybeSingle();

    if (entryError) throw entryError;

    if (!existingEntry?.clock_in_at) {
      const { error: upsertError } = await supabaseAdmin.from("time_entries").upsert(
        {
          auth_id: profile.auth_id,
          shift_date: shiftDate,
          clock_in_at: nowIso,
          clock_out_at: null,
          personal_break_started_at: null,
          personal_break_last_started_at: null,
          personal_break_ended_at: null,
          personal_break_remaining_seconds: PERSONAL_BREAK_TOTAL_SECONDS,
          personal_break_is_paused: false,
          personal_break_history: [],
          overtime_start: null,
          overtime_end: null,
        },
        { onConflict: "auth_id,shift_date" },
      );

      if (upsertError) throw upsertError;

      return {
        success: true,
        action: "clock_in",
        employee: profile,
        employeeCode,
        scannedAt: nowIso,
      };
    }

    if (!existingEntry.clock_out_at) {
      const breakState = getPersonalBreakState(existingEntry, nowIso);
      const breakPatch = breakState.isRunning
        ? {
            personal_break_last_started_at: null,
            personal_break_ended_at: nowIso,
            personal_break_remaining_seconds: breakState.remainingSeconds,
            personal_break_is_paused: breakState.remainingSeconds > 0,
            personal_break_history: appendPersonalBreakHistoryEvent(
              existingEntry?.personal_break_history,
              {
                type: breakState.remainingSeconds === 0 ? "complete" : "pause",
                at: nowIso,
                remainingSeconds: breakState.remainingSeconds,
                note: "qr_clock_out",
              },
            ),
          }
        : {};
      const { error: updateError } = await supabaseAdmin
        .from("time_entries")
        .update({ clock_out_at: nowIso, ...breakPatch })
        .eq("auth_id", profile.auth_id)
        .eq("shift_date", shiftDate);

      if (updateError) throw updateError;

      return {
        success: true,
        action: "clock_out",
        employee: profile,
        employeeCode,
        scannedAt: nowIso,
      };
    }

    if (!existingEntry.overtime_start) {
      const { error: overtimeStartError } = await supabaseAdmin
        .from("time_entries")
        .update({ overtime_start: nowIso, overtime_end: null })
        .eq("auth_id", profile.auth_id)
        .eq("shift_date", shiftDate);

      if (overtimeStartError) throw overtimeStartError;

      return {
        success: true,
        action: "overtime_start",
        employee: profile,
        employeeCode,
        scannedAt: nowIso,
      };
    }

    if (!existingEntry.overtime_end) {
      const { error: overtimeEndError } = await supabaseAdmin
        .from("time_entries")
        .update({ overtime_end: nowIso })
        .eq("auth_id", profile.auth_id)
        .eq("shift_date", shiftDate);

      if (overtimeEndError) throw overtimeEndError;

      return {
        success: true,
        action: "overtime_end",
        employee: profile,
        employeeCode,
        scannedAt: nowIso,
      };
    }

    throw new Error("Attendance and overtime for this employee are already completed today.");
  } catch (error) {
    return { success: false, error: error.message };
  }
};
