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

function formatShiftTimeLabel(timeStr) {
  if (!timeStr) return "-";
  const normalized = String(timeStr).trim();
  const timeFor = (t) => {
    const d = new Date(`2000-01-01T${t.length === 5 ? `${t}:00` : t}`);
    if (Number.isNaN(d.getTime())) return t;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  return timeFor(normalized);
}

function formatDayRange(week_start, week_end) {
  if (!week_start || !week_end) return "";
  const days = ["Sun", "Mon", "Tues", "Wed", "Thurs", "Fri", "Sat"];
  const startDate = new Date(week_start);
  const endDate = new Date(week_end);
  const startDay = days[startDate.getDay()];
  const endDay = days[endDate.getDay()];
  return `${startDay} - ${endDay}`;
}

export function buildUserShiftNotification(payload) {
  const nextRow = payload?.new ?? null;
  const previousRow = payload?.old ?? null;
  const eventType = payload?.eventType;

  if (eventType === "INSERT" && nextRow) {
    const dayRange = formatDayRange(nextRow.week_start, nextRow.week_end);
    const startTime = formatShiftTimeLabel(nextRow.shift_start_time);
    const endTime = formatShiftTimeLabel(nextRow.shift_end_time);
    
    return {
      dedupeKey: `user-shift-insert-${nextRow.employee_auth_id}-${payload.commit_timestamp}`,
      kind: "shift",
      title: "New shift assigned",
      message: `Your shift has been assigned: ${dayRange} (${nextRow.week_start} - ${nextRow.week_end}), ${startTime} to ${endTime}`,
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

    const dayRange = formatDayRange(nextRow.week_start, nextRow.week_end);
    const startTime = formatShiftTimeLabel(nextRow.shift_start_time);
    const endTime = formatShiftTimeLabel(nextRow.shift_end_time);
    
    let changeDetails = [];
    if (getChangedValues(previousRow, nextRow, ["week_start", "week_end"]).length > 0) {
      const prevDayRange = formatDayRange(previousRow.week_start, previousRow.week_end);
      changeDetails.push(`week: ${prevDayRange} → ${dayRange}`);
    }
    if (getChangedValues(previousRow, nextRow, ["shift_start_time", "shift_end_time"]).length > 0) {
      const prevStartTime = formatShiftTimeLabel(previousRow.shift_start_time);
      const prevEndTime = formatShiftTimeLabel(previousRow.shift_end_time);
      changeDetails.push(`time: ${prevStartTime}-${prevEndTime} → ${startTime}-${endTime}`);
    }

    return {
      dedupeKey: `user-shift-update-${nextRow.employee_auth_id}-${payload.commit_timestamp}`,
      kind: "shift",
      title: "Shift updated",
      message: `Your shift has been updated: ${dayRange} (${nextRow.week_start} - ${nextRow.week_end}), ${startTime} to ${endTime}. Changes: ${changeDetails.join(", ")}`,
    };
  }

  if (eventType === "DELETE" && previousRow) {
    const dayRange = formatDayRange(previousRow.week_start, previousRow.week_end);
    const startTime = formatShiftTimeLabel(previousRow.shift_start_time);
    const endTime = formatShiftTimeLabel(previousRow.shift_end_time);
    
    return {
      dedupeKey: `user-shift-delete-${previousRow.employee_auth_id}-${payload.commit_timestamp}`,
      kind: "shift",
      title: "Shift removed",
      message: `Your shift has been removed: ${dayRange} (${previousRow.week_start} - ${previousRow.week_end}), ${startTime} to ${endTime}. Please contact your admin for the updated schedule.`,
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

  if (
    previousRow?.personal_break_last_started_at !==
      nextRow?.personal_break_last_started_at &&
    nextRow?.personal_break_last_started_at
  ) {
    const title = previousRow?.personal_break_started_at
      ? "Personal break resumed"
      : "Personal break started";
    const message = previousRow?.personal_break_started_at
      ? `${employeeLabel} resumed personal break.`
      : `${employeeLabel} started personal break.`;
    events.push(
      buildTimeEvent(
        title,
        message,
        "break",
        `admin-personal-break-start-${authId}-${timestamp}`,
      ),
    );
  }

  if (
    !previousRow?.personal_break_is_paused &&
    nextRow?.personal_break_is_paused &&
    Number(nextRow?.personal_break_remaining_seconds) > 0
  ) {
    events.push(
      buildTimeEvent(
        "Personal break paused",
        `${employeeLabel} paused personal break.`,
        "break",
        `admin-personal-break-pause-${authId}-${timestamp}`,
      ),
    );
  }

  if (
    Number(previousRow?.personal_break_remaining_seconds) > 0 &&
    Number(nextRow?.personal_break_remaining_seconds) === 0
  ) {
    events.push(
      buildTimeEvent(
        "Personal break completed",
        `${employeeLabel} used the full personal break.`,
        "break",
        `admin-personal-break-complete-${authId}-${timestamp}`,
      ),
    );
  }

  return events;
}
