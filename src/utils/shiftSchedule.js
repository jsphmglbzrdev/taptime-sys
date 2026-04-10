/** Earliest clock-in: 1 hour before scheduled shift start */
export const CLOCK_IN_EARLY_MS = 60 * 60 * 1000;
/** After shift start, this many minutes still count as “within grace” (not flagged late) */
export const LATE_GRACE_MS = 5 * 60 * 1000;

export function normalizeTimeString(timeStr) {
  if (timeStr == null || timeStr === "") return null;
  const s = String(timeStr).trim();
  if (s.length === 5) return `${s}:00`;
  return s.length >= 8 ? s.slice(0, 8) : s;
}

/** Local Date for a calendar day + time-of-day (from Postgres `time`). */
export function localDateTimeFromShiftDateAndTime(shiftDate, timeStr) {
  const t = normalizeTimeString(timeStr);
  if (!shiftDate || !t) return null;
  return new Date(`${shiftDate}T${t}`);
}

/**
 * @param {Array<{ week_start: string, week_end: string }>} rows
 * @param {string} calendarDate YYYY-MM-DD
 */
export function findWeeklyShiftForDate(rows, calendarDate) {
  if (!rows?.length || !calendarDate) return null;
  return (
    rows.find(
      (r) => r.week_start <= calendarDate && calendarDate <= r.week_end,
    ) ?? null
  );
}

export function getClockInWindow(shiftDate, shiftStartTime, shiftEndTime) {
  const shiftStart = localDateTimeFromShiftDateAndTime(
    shiftDate,
    shiftStartTime,
  );
  const shiftEnd = localDateTimeFromShiftDateAndTime(shiftDate, shiftEndTime);
  if (!shiftStart || !shiftEnd) return null;
  return {
    earliestClockIn: new Date(shiftStart.getTime() - CLOCK_IN_EARLY_MS),
    shiftStart,
    graceEnds: new Date(shiftStart.getTime() + LATE_GRACE_MS),
    latestClockIn: shiftEnd,
  };
}

/**
 * @returns {{ allowed: boolean, reason: string, late?: boolean, window?: object }}
 */
export function evaluateClockIn(nowMs, window) {
  if (!window) {
    return { allowed: true, reason: "no_schedule" };
  }
  if (nowMs < window.earliestClockIn.getTime()) {
    return { allowed: false, reason: "too_early", window };
  }
  if (nowMs > window.latestClockIn.getTime()) {
    return { allowed: false, reason: "past_shift_end", window };
  }
  const late = nowMs > window.graceEnds.getTime();
  return {
    allowed: true,
    reason: late ? "late_grace_passed" : "on_time",
    late,
    window,
  };
}

/** Whole minutes worked past scheduled shift end on that calendar day. */
export function computeOvertimeMinutes(
  clockOutIso,
  shiftDate,
  shiftEndTimeStr,
) {
  const shiftEnd = localDateTimeFromShiftDateAndTime(
    shiftDate,
    shiftEndTimeStr,
  );
  if (!shiftEnd || !clockOutIso) return 0;
  const diffMs = new Date(clockOutIso).getTime() - shiftEnd.getTime();
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / 60000);
}

export function formatShiftTimeLabel(timeStr) {
  const t = normalizeTimeString(timeStr);
  if (!t) return "-";
  const d = new Date(`2000-01-01T${t}`);
  if (Number.isNaN(d.getTime())) return timeStr;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const parseTimeToMinutes = (time) => {
  // Handle "04:41 PM"
  if (time?.includes("AM") || time?.includes("PM")) {
    let [hourMin, modifier] = time.split(" ");
    let [hours, minutes] = hourMin.split(":").map(Number);

    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  // Handle "07:00:00"
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

