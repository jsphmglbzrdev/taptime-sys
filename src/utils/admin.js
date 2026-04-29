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
import { generateEmployerCode } from "./organizationCodes";
import { isEmployerRole } from "./roles";
import { matchesEmployerScope } from "./employerScope";

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

async function getUniqueEmployerProfileByCode(employerCode) {
  const safeEmployerCode = String(employerCode ?? "").trim().toUpperCase();
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("auth_id, role, department, employer_code")
    .eq("employer_code", safeEmployerCode)
    .limit(2);

  if (error) throw error;

  const matches = (data ?? []).filter(
    (profile) => profile?.auth_id && isEmployerRole(profile.role),
  );

  if (matches.length === 0) {
    return { profile: null, error: "Employer code was not found." };
  }

  if (matches.length > 1) {
    return {
      profile: null,
      error:
        "This employer code is assigned to multiple accounts. Please contact the system administrator for a new employer invite code.",
    };
  }

  return { profile: matches[0], error: null };
}

// Account creation


export const createUser = async ({
  first_name,
  last_name,
  email,
  password,
  role,
  employee_code,
  department,
  employer_code,
}) => {
  try {
    const safeEmail = String(email ?? "").trim().toLowerCase();
    const safeRole = role === "Admin" ? "Employer" : role || "Employee";
    const isEmployeeRole = safeRole === "Employee";
    const employerAccount = isEmployerRole(safeRole);
    const safeDepartment = String(department ?? "").trim();
    const safeEmployerCode = String(employer_code ?? "").trim().toUpperCase();
    let resolvedDepartment = safeDepartment || null;
    let employerAuthId = null;

    if (employerAccount && !safeDepartment) {
      throw new Error("Department is required for employer accounts.");
    }

    let qrRecord = null;
    let employerCode = null;
    if (isEmployeeRole) {
      const normalizedEmployeeCode = normalizeEmployeeCode(employee_code);
      if (!isValidEmployeeCode(normalizedEmployeeCode)) {
        throw new Error("Employee ID must be exactly 7 digits.");
      }
      if (!safeEmployerCode) {
        throw new Error("Employer code is required for employee accounts.");
      }

      const { profile: employerProfile, error: employerLookupError } =
        await getUniqueEmployerProfileByCode(safeEmployerCode);

      if (employerLookupError) {
        throw new Error(employerLookupError);
      }

      employerAuthId = employerProfile.auth_id;
      employerCode = employerProfile.employer_code ?? safeEmployerCode;
      resolvedDepartment = employerProfile.department ?? null;
      qrRecord = await generateAttendanceQrSvg(normalizedEmployeeCode);
    }

    if (employerAccount) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidateCode = generateEmployerCode(
          `${first_name ?? ""}${last_name ?? ""}${safeDepartment}`,
        );
        const { data: existingEmployerCodes, error: existingEmployerCodesError } =
          await supabaseAdmin
            .from("user_profiles")
            .select("auth_id")
            .eq("employer_code", candidateCode)
            .limit(1);

        if (existingEmployerCodesError) throw existingEmployerCodesError;
        if (!existingEmployerCodes?.length) {
          employerCode = candidateCode;
          break;
        }
      }

      if (!employerCode) {
        throw new Error("Unable to generate a unique employer code.");
      }

      resolvedDepartment = safeDepartment;
    }

    // 1. Create user without affecting current session
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: safeEmail,
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
        email: safeEmail,
        role: safeRole,
        department: resolvedDepartment,
        employer_auth_id: employerAuthId,
        employer_code: employerCode,
        employee_code: qrRecord?.employeeCode ?? null,
        attendance_qr_payload: qrRecord?.payload ?? null,
        attendance_qr_svg: qrRecord?.svg ?? null,
      },
    ]);
    if (profileError) throw profileError;

    return {
      success: true,
      user: data?.user ?? data,
      profile: {
        auth_id: authUserId,
        first_name,
        last_name,
        email: safeEmail,
        role: safeRole,
        department: resolvedDepartment,
        employer_auth_id: employerAuthId,
        employer_code: employerCode,
        employee_code: qrRecord?.employeeCode ?? null,
        attendance_qr_payload: qrRecord?.payload ?? null,
        attendance_qr_svg: qrRecord?.svg ?? null,
      },
    };
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
  department,
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

    if (typeof department !== "undefined") {
      profilePatch.department = String(department ?? "").trim() || null;
    }

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

async function ensureEmployeeWithinScope({ viewerProfile, employeeAuthId }) {
  if (!employeeAuthId) throw new Error("employee_auth_id is required");

  const { data: employeeProfile, error: employeeProfileError } =
    await supabaseAdmin
      .from("user_profiles")
      .select("auth_id, role, employer_code")
      .eq("auth_id", employeeAuthId)
      .maybeSingle();

  if (employeeProfileError) throw employeeProfileError;
  if (!employeeProfile?.auth_id || employeeProfile.role !== "Employee") {
    throw new Error("Employee account not found.");
  }
  if (!matchesEmployerScope(viewerProfile, employeeProfile)) {
    throw new Error("You are not allowed to manage this employee schedule.");
  }

  return employeeProfile;
}

export const listEmployeeWeeklyShifts = async ({ viewerProfile } = {}) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("employee_weekly_shifts")
      .select(
        `
        id,
        employee_auth_id,
        week_start,
        week_end,
        shift_start_time,
        shift_end_time,
        created_at
      `,
      )
      .order("week_start", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = data ?? [];
    if (!viewerProfile || !isEmployerRole(viewerProfile.role)) {
      return { success: true, data: rows };
    }

    const { data: scopedProfiles, error: scopedProfilesError } =
      await supabaseAdmin
        .from("user_profiles")
        .select("auth_id, role, employer_code")
        .eq("role", "Employee")
        .eq("employer_code", String(viewerProfile.employer_code ?? "").trim());

    if (scopedProfilesError) throw scopedProfilesError;

    const allowedAuthIds = new Set(
      (scopedProfiles ?? []).map((profile) => profile.auth_id).filter(Boolean),
    );

    return {
      success: true,
      data: rows.filter((row) => allowedAuthIds.has(row.employee_auth_id)),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getEmployeeWeeklyShiftHistory = async ({
  viewerProfile,
  employee_auth_id,
}) => {
  try {
    await ensureEmployeeWithinScope({ viewerProfile, employeeAuthId: employee_auth_id });

    const [currentRes, historyRes] = await Promise.all([
      supabaseAdmin
        .from("employee_weekly_shifts")
        .select(
          "id, week_start, week_end, shift_start_time, shift_end_time, created_at",
        )
        .eq("employee_auth_id", employee_auth_id)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("employee_weekly_shift_history")
        .select(
          "id, shift_created_at, week_start, week_end, shift_start_time, shift_end_time, superseded_at",
        )
        .eq("employee_auth_id", employee_auth_id)
        .order("superseded_at", { ascending: false }),
    ]);

    if (currentRes.error) throw currentRes.error;
    if (historyRes.error) throw historyRes.error;

    return {
      success: true,
      current: currentRes.data ?? null,
      history: historyRes.data ?? [],
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const saveEmployeeWeeklyShift = async ({ viewerProfile, payload }) => {
  try {
    const safePayload = {
      employee_auth_id: payload?.employee_auth_id,
      week_start: payload?.week_start,
      week_end: payload?.week_end,
      shift_start_time: payload?.shift_start_time,
      shift_end_time: payload?.shift_end_time,
    };

    await ensureEmployeeWithinScope({
      viewerProfile,
      employeeAuthId: safePayload.employee_auth_id,
    });

    const currentRes = await supabaseAdmin
      .from("employee_weekly_shifts")
      .select("*")
      .eq("employee_auth_id", safePayload.employee_auth_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentRes.error) throw currentRes.error;

    const prev = currentRes.data ?? null;

    if (prev) {
      const normalizedPrevStart = String(prev.shift_start_time ?? "").slice(0, 5);
      const normalizedPrevEnd = String(prev.shift_end_time ?? "").slice(0, 5);
      const normalizedNextStart = String(safePayload.shift_start_time ?? "").slice(0, 5);
      const normalizedNextEnd = String(safePayload.shift_end_time ?? "").slice(0, 5);
      const hasChanges =
        prev.week_start !== safePayload.week_start ||
        prev.week_end !== safePayload.week_end ||
        normalizedPrevStart !== normalizedNextStart ||
        normalizedPrevEnd !== normalizedNextEnd ||
        prev.employee_auth_id !== safePayload.employee_auth_id;

      if (hasChanges) {
        const historyRes = await supabaseAdmin
          .from("employee_weekly_shift_history")
          .insert({
            shift_created_at: prev.created_at,
            employee_auth_id: prev.employee_auth_id,
            week_start: prev.week_start,
            week_end: prev.week_end,
            shift_start_time: prev.shift_start_time,
            shift_end_time: prev.shift_end_time,
          });
        if (historyRes.error) throw historyRes.error;
      }

      const updateRes = await supabaseAdmin
        .from("employee_weekly_shifts")
        .update(
          hasChanges
            ? { ...safePayload, created_at: new Date().toISOString() }
            : safePayload,
        )
        .eq("id", prev.id);
      if (updateRes.error) throw updateRes.error;
    } else {
      const insertRes = await supabaseAdmin
        .from("employee_weekly_shifts")
        .insert(safePayload);
      if (insertRes.error) throw insertRes.error;
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const deleteEmployeeWeeklyShift = async ({ viewerProfile, row }) => {
  try {
    if (!row?.id) throw new Error("Shift row not found.");

    await ensureEmployeeWithinScope({
      viewerProfile,
      employeeAuthId: row.employee_auth_id,
    });

    const historyRes = await supabaseAdmin
      .from("employee_weekly_shift_history")
      .insert({
        shift_created_at: row.created_at,
        employee_auth_id: row.employee_auth_id,
        week_start: row.week_start,
        week_end: row.week_end,
        shift_start_time: row.shift_start_time,
        shift_end_time: row.shift_end_time,
      });
    if (historyRes.error) throw historyRes.error;

    const deleteRes = await supabaseAdmin
      .from("employee_weekly_shifts")
      .delete()
      .eq("id", row.id);
    if (deleteRes.error) throw deleteRes.error;

    return { success: true };
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
