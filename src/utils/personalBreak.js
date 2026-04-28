export const PERSONAL_BREAK_TOTAL_SECONDS = 60 * 60;
export const PERSONAL_BREAK_TOTAL_MINUTES = PERSONAL_BREAK_TOTAL_SECONDS / 60;

const PERSONAL_BREAK_EVENT_LABELS = {
  start: "Started",
  pause: "Paused",
  resume: "Resumed",
  complete: "Completed",
};

function clampSeconds(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return PERSONAL_BREAK_TOTAL_SECONDS;
  return Math.max(0, Math.min(PERSONAL_BREAK_TOTAL_SECONDS, Math.floor(num)));
}

function parseDateTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeEventType(value) {
  const type = String(value ?? "").trim().toLowerCase();
  return PERSONAL_BREAK_EVENT_LABELS[type] ? type : "pause";
}

export function getPersonalBreakState(entry, nowValue = Date.now()) {
  const nowMs =
    nowValue instanceof Date ? nowValue.getTime() : new Date(nowValue).getTime();
  const startedAt = parseDateTime(entry?.personal_break_started_at);
  const lastStartedAt = parseDateTime(entry?.personal_break_last_started_at);
  const endedAt = parseDateTime(entry?.personal_break_ended_at);
  const baseRemainingSeconds = clampSeconds(entry?.personal_break_remaining_seconds);
  const isPaused = Boolean(entry?.personal_break_is_paused);
  const hasStarted = !!startedAt;

  let remainingSeconds = baseRemainingSeconds;
  let isRunning =
    hasStarted &&
    !!lastStartedAt &&
    !isPaused &&
    baseRemainingSeconds > 0 &&
    Number.isFinite(nowMs);

  if (isRunning) {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((nowMs - lastStartedAt.getTime()) / 1000),
    );
    remainingSeconds = Math.max(0, baseRemainingSeconds - elapsedSeconds);
    if (remainingSeconds === 0) {
      isRunning = false;
    }
  }

  const usedSeconds = PERSONAL_BREAK_TOTAL_SECONDS - remainingSeconds;
  const isCompleted = hasStarted && remainingSeconds === 0;
  const canResume = hasStarted && !isRunning && !isCompleted && remainingSeconds > 0;
  const isPausedState =
    hasStarted && isPaused && !isRunning && !isCompleted && remainingSeconds > 0;
  const hasAnyUsage = hasStarted || usedSeconds > 0 || !!endedAt;

  return {
    startedAt,
    lastStartedAt,
    endedAt,
    hasStarted,
    hasAnyUsage,
    isRunning,
    isPaused: isPausedState,
    isCompleted,
    canResume,
    remainingSeconds,
    usedSeconds,
    baseRemainingSeconds,
  };
}

export function formatDurationCompact(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m`;
}

export function formatPersonalBreakLogValue(entry, nowValue = Date.now()) {
  const state = getPersonalBreakState(entry, nowValue);
  if (!state.hasAnyUsage) return "-";
  return `${formatDurationCompact(state.usedSeconds)} used / ${formatDurationCompact(state.remainingSeconds)} left`;
}

export function getPersonalBreakHistory(entry) {
  const raw = entry?.personal_break_history;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      const at = parseDateTime(item?.at);
      if (!at) return null;

      return {
        id: `${item?.type ?? "event"}-${at.toISOString()}-${index}`,
        type: normalizeEventType(item?.type),
        label:
          PERSONAL_BREAK_EVENT_LABELS[normalizeEventType(item?.type)] ?? "Paused",
        at: at.toISOString(),
        remainingSeconds: Math.max(
          0,
          Math.floor(Number(item?.remaining_seconds) || 0),
        ),
        note: String(item?.note ?? "").trim(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function appendPersonalBreakHistoryEvent(
  currentHistory,
  { type, at, remainingSeconds, note = "" },
) {
  const history = Array.isArray(currentHistory) ? [...currentHistory] : [];
  history.push({
    type: normalizeEventType(type),
    at,
    remaining_seconds: Math.max(
      0,
      Math.floor(Number(remainingSeconds) || 0),
    ),
    note: String(note ?? "").trim() || null,
  });
  return history;
}
