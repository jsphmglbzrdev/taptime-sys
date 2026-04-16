/* global process */
import { createClient } from "@supabase/supabase-js";
import {
  AUTO_CLOCK_OUT_GRACE_MS,
  findWeeklyShiftForDate,
  getAutoClockOutDeadline,
  parseTimeToMinutes,
} from "../../src/utils/shiftSchedule.js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ROLE_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function isAuthorized(request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return true;
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${configuredSecret}`;
}

function parseShiftEndTimeFromLabel(label) {
  const parts = String(label ?? "")
    .split(/\s*-\s*/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (parts.length !== 2) return null;

  const endLabel = parts[1];
  const endMinutes = parseTimeToMinutes(endLabel);
  if (!endLabel.includes(":")) return null;
  if (Number.isNaN(endMinutes)) return null;

  const hours = `${Math.floor(endMinutes / 60)}`.padStart(2, "0");
  const minutes = `${endMinutes % 60}`.padStart(2, "0");
  return `${hours}:${minutes}:00`;
}

function resolveShiftEndTime(entry, shiftsByEmployee) {
  const fromLabel = parseShiftEndTimeFromLabel(entry?.scheduled_shift);
  if (fromLabel) return fromLabel;

  const employeeShifts = shiftsByEmployee.get(entry?.auth_id) ?? [];
  const matchingShift = findWeeklyShiftForDate(employeeShifts, entry?.shift_date);
  return matchingShift?.shift_end_time ?? null;
}

async function writeAuditRows(rows) {
  if (!rows.length) return;
  const { error } = await supabaseAdmin.from("audit_trails").insert(rows);
  if (error) throw error;
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized." }, 401);
  }

  if (!supabaseAdmin) {
    return json(
      {
        error:
          "Missing Supabase server credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      500,
    );
  }

  const now = new Date();

  try {
    const { data: activeEntries, error: activeEntriesError } = await supabaseAdmin
      .from("time_entries")
      .select(
        "auth_id, shift_date, scheduled_shift, clock_in_at, clock_out_at, morning_break_in_at, morning_break_out_at, afternoon_break_in_at, afternoon_break_out_at, lunch_break_in_at, lunch_break_out_at, overtime_start, overtime_end",
      )
      .not("clock_in_at", "is", null)
      .is("clock_out_at", null);

    if (activeEntriesError) throw activeEntriesError;
    if (!activeEntries?.length) {
      return json({ ok: true, processed: 0, updated: 0, timestamp: now.toISOString() });
    }

    const employeeIds = Array.from(
      new Set(activeEntries.map((entry) => entry.auth_id).filter(Boolean)),
    );

    const { data: shiftRows, error: shiftRowsError } = await supabaseAdmin
      .from("employee_weekly_shifts")
      .select("employee_auth_id, week_start, week_end, shift_end_time")
      .in("employee_auth_id", employeeIds);

    if (shiftRowsError) throw shiftRowsError;

    const shiftsByEmployee = new Map();
    for (const row of shiftRows ?? []) {
      const rows = shiftsByEmployee.get(row.employee_auth_id) ?? [];
      rows.push(row);
      shiftsByEmployee.set(row.employee_auth_id, rows);
    }

    let updated = 0;
    const auditRows = [];

    for (const entry of activeEntries) {
      if (entry.overtime_start && !entry.overtime_end) continue;

      const shiftEndTime = resolveShiftEndTime(entry, shiftsByEmployee);
      if (!shiftEndTime) continue;

      const autoClockOutAt = getAutoClockOutDeadline(
        entry.shift_date,
        shiftEndTime,
        AUTO_CLOCK_OUT_GRACE_MS,
      );
      if (!autoClockOutAt || now.getTime() < autoClockOutAt.getTime()) continue;

      const autoClockOutIso = autoClockOutAt.toISOString();
      const patch = { clock_out_at: autoClockOutIso };

      if (entry.morning_break_in_at && !entry.morning_break_out_at) {
        patch.morning_break_out_at = autoClockOutIso;
      }
      if (entry.afternoon_break_in_at && !entry.afternoon_break_out_at) {
        patch.afternoon_break_out_at = autoClockOutIso;
      }
      if (entry.lunch_break_in_at && !entry.lunch_break_out_at) {
        patch.lunch_break_out_at = autoClockOutIso;
      }

      const { error: updateError } = await supabaseAdmin
        .from("time_entries")
        .update(patch)
        .eq("auth_id", entry.auth_id)
        .eq("shift_date", entry.shift_date)
        .is("clock_out_at", null);

      if (updateError) throw updateError;

      updated += 1;
      auditRows.push({
        event_type: "warning",
        module: "system",
        action: "auto_clock_out",
        description: `System automatically clocked out ${entry.auth_id} after shift end plus 10 minutes.`,
        actor_auth_id: null,
        actor_email: "system@cron",
        actor_name: "System Cron",
        actor_role: "System",
        target_auth_id: entry.auth_id,
        metadata: {
          shift_date: entry.shift_date,
          scheduled_shift: entry.scheduled_shift,
          shift_end_time: shiftEndTime,
          auto_clock_out_at: autoClockOutIso,
        },
      });
    }

    await writeAuditRows(auditRows);

    return json({
      ok: true,
      processed: activeEntries.length,
      updated,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return json(
      {
        error: error?.message ?? "Unknown auto clock-out error.",
        timestamp: now.toISOString(),
      },
      500,
    );
  }
}
