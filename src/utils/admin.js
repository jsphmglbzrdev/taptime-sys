import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "./auditTrail";
import { parseAttendanceQrPayload } from "./attendanceQr";

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

export const updateUserAccount = async ({ auth_id, first_name, last_name, password }) => {
  try {
    if (!auth_id) throw new Error("auth_id is required");

    // 1) Update profile names
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .update({ first_name, last_name })
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

export const listAuditTrail = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from("audit_trails")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return { success: true, data: data ?? [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const listAuditTrailPage = async ({ page = 1, pageSize = 20 } = {}) => {
  try {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    const { data, error, count } = await supabaseAdmin
      .from("audit_trails")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      success: true,
      data: data ?? [],
      count: count ?? 0,
      page: safePage,
      pageSize: safePageSize,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearAuditTrail = async () => {
  try {
    const { error } = await supabaseAdmin
      .from("audit_trails")
      .delete()
      .not("id", "is", null);

    if (error) throw error;
    return { success: true };
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
        "auth_id, shift_date, morning_break_in_at, morning_break_out_at, afternoon_break_in_at, afternoon_break_out_at, lunch_break_in_at, lunch_break_out_at",
      )
      .eq("shift_date", shift_date);

    if (error) throw error;

    const nowMs = Date.now();
    const expiredUpdates = [];
    const breakConfigs = [
      {
        inKey: "morning_break_in_at",
        outKey: "morning_break_out_at",
        durationMs: 15 * 60 * 1000,
      },
      {
        inKey: "afternoon_break_in_at",
        outKey: "afternoon_break_out_at",
        durationMs: 15 * 60 * 1000,
      },
      {
        inKey: "lunch_break_in_at",
        outKey: "lunch_break_out_at",
        durationMs: 60 * 60 * 1000,
      },
    ];

    for (const entry of data ?? []) {
      for (const cfg of breakConfigs) {
        const breakInAt = entry?.[cfg.inKey];
        const breakOutAt = entry?.[cfg.outKey];
        if (!breakInAt || breakOutAt) continue;

        const endMs = new Date(breakInAt).getTime() + cfg.durationMs;
        if (Number.isNaN(endMs) || endMs > nowMs) continue;

        expiredUpdates.push({
          auth_id: entry.auth_id,
          shift_date: entry.shift_date,
          [cfg.outKey]: new Date(endMs).toISOString(),
        });
        break;
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
  actor,
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
          overtime_start: null,
          overtime_end: null,
        },
        { onConflict: "auth_id,shift_date" },
      );

      if (upsertError) throw upsertError;

      await logAuditEvent({
        eventType: "info",
        module: "admin",
        action: "qr_clock_in",
        description: `Recorded QR clock-in for ${profile.email ?? profile.auth_id}.`,
        actor,
        target: {
          auth_id: profile.auth_id,
          email: profile.email,
          name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
        },
        metadata: {
          employee_code: employeeCode,
          clock_in_at: nowIso,
        },
      });

      return {
        success: true,
        action: "clock_in",
        employee: profile,
        employeeCode,
        scannedAt: nowIso,
      };
    }

    if (!existingEntry.clock_out_at) {
      const { error: updateError } = await supabaseAdmin
        .from("time_entries")
        .update({ clock_out_at: nowIso })
        .eq("auth_id", profile.auth_id)
        .eq("shift_date", shiftDate);

      if (updateError) throw updateError;

      await logAuditEvent({
        eventType: "info",
        module: "admin",
        action: "qr_clock_out",
        description: `Recorded QR clock-out for ${profile.email ?? profile.auth_id}.`,
        actor,
        target: {
          auth_id: profile.auth_id,
          email: profile.email,
          name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
        },
        metadata: {
          employee_code: employeeCode,
          clock_out_at: nowIso,
        },
      });

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

      await logAuditEvent({
        eventType: "info",
        module: "admin",
        action: "qr_overtime_start",
        description: `Recorded QR overtime start for ${profile.email ?? profile.auth_id}.`,
        actor,
        target: {
          auth_id: profile.auth_id,
          email: profile.email,
          name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
        },
        metadata: {
          employee_code: employeeCode,
          overtime_start: nowIso,
        },
      });

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

      await logAuditEvent({
        eventType: "info",
        module: "admin",
        action: "qr_overtime_end",
        description: `Recorded QR overtime end for ${profile.email ?? profile.auth_id}.`,
        actor,
        target: {
          auth_id: profile.auth_id,
          email: profile.email,
          name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
        },
        metadata: {
          employee_code: employeeCode,
          overtime_end: nowIso,
        },
      });

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
