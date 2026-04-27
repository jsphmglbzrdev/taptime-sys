function parseDateTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatRenderedHours(startValue, endValue) {
  const start = parseDateTime(startValue);
  const end = parseDateTime(endValue);

  if (!start || !end) return "-";

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return "-";

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

