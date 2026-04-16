export function getProfileDisplayName(profile, fallback = "Employee") {
  const first = String(profile?.first_name ?? "").trim();
  const last = String(profile?.last_name ?? "").trim();
  const full = [first, last].filter(Boolean).join(" ");
  return full || profile?.email || fallback;
}

function getChangedValues(previousRow, nextRow, fields) {
  return fields.filter((field) => previousRow?.[field] !== nextRow?.[field]);
}

export function buildUserAccountNotification(payload) {
  const nextRow = payload?.new ?? null;
  if (!nextRow) return null;

  return {
    dedupeKey: `user-profile-${payload.eventType}-${nextRow.auth_id}-${payload.commit_timestamp}`,
    kind: "account",
    title: "Account updated",
    message: "Your account details were updated. Review your profile for the latest changes.",
  };
}

export function buildUserShiftNotification(payload) {
  const nextRow = payload?.new ?? null;
  const previousRow = payload?.old ?? null;
  const eventType = payload?.eventType;

  if (eventType === "INSERT" && nextRow) {
    return {
      dedupeKey: `user-shift-insert-${nextRow.employee_auth_id}-${payload.commit_timestamp}`,
      kind: "shift",
      title: "Shift assigned",
      message: `Your weekly shift is now ${nextRow.week_start} to ${nextRow.week_end}.`,
    };
  }

  if (eventType === "UPDATE" && nextRow) {
    const changedFields = getChangedValues(previousRow, nextRow, [
      "week_start",
      "week_end",
      "shift_start_time",
      "shift_end_time",
      "created_at",
    ]);
    if (changedFields.length === 0) return null;

    return {
      dedupeKey: `user-shift-update-${nextRow.employee_auth_id}-${payload.commit_timestamp}`,
      kind: "shift",
      title: "Shift updated",
      message: `Your assigned shift was changed to ${nextRow.week_start} through ${nextRow.week_end}.`,
    };
  }

  if (eventType === "DELETE" && previousRow) {
    return {
      dedupeKey: `user-shift-delete-${previousRow.employee_auth_id}-${payload.commit_timestamp}`,
      kind: "shift",
      title: "Shift removed",
      message: "Your assigned weekly shift was removed. Please contact your admin for the updated schedule.",
    };
  }

  return null;
}

function buildTimeEvent(title, message, kind, dedupeKey) {
  return {
    title,
    message,
    kind,
    dedupeKey,
  };
}

export function buildAdminAttendanceNotifications(payload, profileMap = new Map()) {
  const nextRow = payload?.new ?? null;
  const previousRow = payload?.old ?? null;
  const eventType = payload?.eventType;
  const authId = nextRow?.auth_id ?? previousRow?.auth_id ?? "";
  const profile = profileMap.get(authId);
  const employeeLabel = getProfileDisplayName(profile, authId || "Employee");
  const shiftDate = nextRow?.shift_date ?? previousRow?.shift_date ?? "";
  const timestamp = payload?.commit_timestamp ?? new Date().toISOString();
  const events = [];

  if (eventType === "INSERT" && nextRow?.clock_in_at) {
    events.push(
      buildTimeEvent(
        "Clock in",
        `${employeeLabel} clocked in for ${shiftDate}.`,
        "attendance",
        `admin-clock-in-${authId}-${timestamp}`,
      ),
    );
    return events;
  }

  if (eventType !== "UPDATE" || !nextRow || !previousRow) {
    return events;
  }

  const updateChecks = [
    {
      field: "clock_out_at",
      title: "Clock out",
      message: `${employeeLabel} clocked out for ${shiftDate}.`,
      kind: "attendance",
    },
    {
      field: "morning_break_in_at",
      title: "Morning break",
      message: `${employeeLabel} started morning break.`,
      kind: "break",
    },
    {
      field: "morning_break_out_at",
      title: "Morning break ended",
      message: `${employeeLabel} ended morning break.`,
      kind: "break",
    },
    {
      field: "lunch_break_in_at",
      title: "Lunch break",
      message: `${employeeLabel} started lunch break.`,
      kind: "break",
    },
    {
      field: "lunch_break_out_at",
      title: "Lunch break ended",
      message: `${employeeLabel} ended lunch break.`,
      kind: "break",
    },
    {
      field: "afternoon_break_in_at",
      title: "Afternoon break",
      message: `${employeeLabel} started afternoon break.`,
      kind: "break",
    },
    {
      field: "afternoon_break_out_at",
      title: "Afternoon break ended",
      message: `${employeeLabel} ended afternoon break.`,
      kind: "break",
    },
    {
      field: "overtime_start",
      title: "Overtime started",
      message: `${employeeLabel} started overtime.`,
      kind: "overtime",
    },
    {
      field: "overtime_end",
      title: "Overtime ended",
      message: `${employeeLabel} ended overtime.`,
      kind: "overtime",
    },
  ];

  for (const check of updateChecks) {
    if (!previousRow?.[check.field] && nextRow?.[check.field]) {
      events.push(
        buildTimeEvent(
          check.title,
          check.message,
          check.kind,
          `admin-${check.field}-${authId}-${timestamp}`,
        ),
      );
    }
  }

  return events;
}
