import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  History,
  CalendarDays,
  X,
} from "lucide-react";
import { supabase } from "../../../utils/supabase";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import {
  getEntryShiftTimes,
  isLate,
  isUnderTime,
  formatShiftTimeLabel,
  formatReadableDateTime,
} from "../../../utils/shiftSchedule";
import { formatRenderedHours } from "../../../utils/timeMetrics";
import {
  formatPersonalBreakLogValue,
  getPersonalBreakHistory,
  getPersonalBreakState,
} from "../../../utils/personalBreak";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import { Calendar } from "../../../components/ui/calendar";

const TAB_TIME_LOGS = "time_logs";
const TAB_BREAK_HISTORY = "break_history";
const TAB_SHIFT_HISTORY = "shift_history";

const ORDINAL_LABELS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"];
const PAGE_SIZE = 10;

function formatTime(value) {
  if (!value) return "-";
  const raw = String(value).trim();
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(date) {
  if (!date) return "";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRangeLabel(range) {
  if (!range?.from && !range?.to) return "All dates";
  if (range?.from && !range?.to) return formatDateLabel(range.from);
  return `${formatDateLabel(range.from)} - ${formatDateLabel(range.to)}`;
}

function getStatusMeta(row) {
  const hasClockIn = !!row?.clock_in_at;
  const hasClockOut = !!row?.clock_out_at;
  const breakState = getPersonalBreakState(row);
  const hasOvertimeIn = !!row?.overtime_start;
  const hasOvertimeOut = !!row?.overtime_end;
  const hasOvertimeActive = hasOvertimeIn && !hasOvertimeOut;
  const hasOvertimeCompleted = hasOvertimeIn && hasOvertimeOut;

  if (hasOvertimeCompleted) return { label: "Completed with Overtime", tone: "green" };
  if (hasOvertimeActive) return { label: "Overtime", tone: "orange" };
  if (hasClockOut) return { label: "Shift Completed", tone: "green" };
  if (breakState.isRunning) return { label: "Personal Break", tone: "orange" };
  if (hasClockIn) return { label: "Working", tone: "green" };
  return { label: "Not started", tone: "orange" };
}

function buildBreakSessions(entry) {
  const history = getPersonalBreakHistory(entry);
  const sessions = [];

  history.forEach((item) => {
    const isStartEvent = item.type === "start" || item.type === "resume";
    const isStopEvent = item.type === "pause" || item.type === "complete";

    if (isStartEvent) {
      sessions.push({
        startLabel: item.label,
        startAt: item.at,
        endLabel: "",
        endAt: "",
      });
      return;
    }

    if (isStopEvent) {
      const target = [...sessions].reverse().find((session) => !session.endAt);
      if (target) {
        target.endLabel = item.label;
        target.endAt = item.at;
      } else {
        sessions.push({
          startLabel: "",
          startAt: "",
          endLabel: item.label,
          endAt: item.at,
        });
      }
    }
  });

  return sessions;
}

function getOrdinalLabel(index) {
  return ORDINAL_LABELS[index] ?? `Break ${index + 1}`;
}

function formatBreakEventCell(label, at) {
  if (!at) return "-";
  return `${label} ${formatTime(at)}`.trim();
}

export default function MyLogsTab() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(TAB_TIME_LOGS);
  const [page, setPage] = useState(1);
  const [timeEntries, setTimeEntries] = useState([]);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalShifts, setTotalShifts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [weeklyShift, setWeeklyShift] = useState(null);
  const [dateRange, setDateRange] = useState(undefined);

  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const fetchTimeEntries = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from("time_entries")
        .select("*", { count: "exact" })
        .eq("auth_id", user.id);

      if (dateRange?.from) {
        const from = dateRange.from.toLocaleDateString("en-CA");
        query = query.gte("shift_date", from);
      }
      if (dateRange?.to) {
        const to = dateRange.to.toLocaleDateString("en-CA");
        query = query.lte("shift_date", to);
      }

      const { data, count, error } = await query
        .order("shift_date", { ascending: false })
        .range(rangeFrom, rangeTo);

      if (error) throw error;
      setTimeEntries(data ?? []);
      setTotalEntries(count ?? 0);
    } catch {
      toast.error("Failed to load time logs.");
    } finally {
      setIsLoading(false);
    }
  }, [user, rangeFrom, rangeTo, dateRange]);

  const fetchShiftHistory = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from("employee_weekly_shift_history")
        .select("*", { count: "exact" })
        .eq("employee_auth_id", user.id);

      if (dateRange?.from) {
        const from = dateRange.from.toLocaleDateString("en-CA");
        query = query.gte("week_start", from);
      }
      if (dateRange?.to) {
        const to = dateRange.to.toLocaleDateString("en-CA");
        query = query.lte("week_end", to);
      }

      const { data, count, error } = await query
        .order("week_start", { ascending: false })
        .range(rangeFrom, rangeTo);

      if (error) throw error;
      setShiftHistory(data ?? []);
      setTotalShifts(count ?? 0);
    } catch {
      toast.error("Failed to load shift history.");
    } finally {
      setIsLoading(false);
    }
  }, [user, rangeFrom, rangeTo, dateRange]);

  const fetchWeeklyShift = useCallback(async () => {
    if (!user) return;
    const today = new Date().toLocaleDateString("en-CA");
    const res = await supabase
      .from("employee_weekly_shifts")
      .select("week_start, week_end, shift_start_time, shift_end_time")
      .eq("employee_auth_id", user.id)
      .lte("week_start", today)
      .gte("week_end", today)
      .maybeSingle();

    if (!res.error) {
      setWeeklyShift(res.data ?? null);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === TAB_SHIFT_HISTORY) {
      fetchShiftHistory();
    } else {
      fetchTimeEntries();
    }
  }, [activeTab, fetchTimeEntries, fetchShiftHistory]);

  useEffect(() => {
    fetchWeeklyShift();
  }, [fetchWeeklyShift]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    setPage(1);
  };

  const clearDateRange = () => {
    setDateRange(undefined);
    setPage(1);
  };

  const currentTotal = activeTab === TAB_SHIFT_HISTORY ? totalShifts : totalEntries;
  const totalPages = Math.max(1, Math.ceil(currentTotal / PAGE_SIZE));

  const breakHistoryRows = useMemo(() => {
    return timeEntries.filter((row) => getPersonalBreakHistory(row).length > 0);
  }, [timeEntries]);

  const maxBreakSessions = useMemo(() => {
    return breakHistoryRows.reduce(
      (max, row) => Math.max(max, buildBreakSessions(row).length),
      0,
    );
  }, [breakHistoryRows]);

  const breakHistoryColumns = useMemo(() => {
    return Array.from({ length: maxBreakSessions }).flatMap((_, index) => {
      const ordinal = getOrdinalLabel(index);
      return [
        {
          label: `${ordinal} Break Start/Resume`,
          getValue: (row) => {
            const session = buildBreakSessions(row)[index];
            return formatBreakEventCell(session?.startLabel ?? "", session?.startAt ?? "");
          },
        },
        {
          label: `${ordinal} Break Pause/Complete`,
          getValue: (row) => {
            const session = buildBreakSessions(row)[index];
            return formatBreakEventCell(session?.endLabel ?? "", session?.endAt ?? "");
          },
        },
      ];
    });
  }, [maxBreakSessions]);

  const handleExport = useCallback(async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const stamp = new Date().toISOString().slice(0, 10);

      if (activeTab === TAB_SHIFT_HISTORY) {
        let query = supabase
          .from("employee_weekly_shift_history")
          .select("*")
          .eq("employee_auth_id", user.id);

        if (dateRange?.from) {
          const from = dateRange.from.toLocaleDateString("en-CA");
          query = query.gte("week_start", from);
        }
        if (dateRange?.to) {
          const to = dateRange.to.toLocaleDateString("en-CA");
          query = query.lte("week_end", to);
        }

        const { data, error } = await query.order("week_start", { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) {
          toast.info("No shift history to export.");
          return;
        }

        const rows = data.map((r) => ({
          "Week Start": r.week_start,
          "Week End": r.week_end,
          "Shift Start": formatShiftTimeLabel(r.shift_start_time),
          "Shift End": formatShiftTimeLabel(r.shift_end_time),
          "Assigned On": formatReadableDateTime(r.shift_created_at ?? r.created_at),
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Shift History");
        XLSX.writeFile(wb, `my-shift-history-${stamp}.xlsx`);
      } else {
        let query = supabase
          .from("time_entries")
          .select("*")
          .eq("auth_id", user.id);

        if (dateRange?.from) {
          const from = dateRange.from.toLocaleDateString("en-CA");
          query = query.gte("shift_date", from);
        }
        if (dateRange?.to) {
          const to = dateRange.to.toLocaleDateString("en-CA");
          query = query.lte("shift_date", to);
        }

        const { data, error } = await query.order("shift_date", { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) {
          toast.info("No logs to export.");
          return;
        }

        if (activeTab === TAB_BREAK_HISTORY) {
          const breakRows = data.filter((row) => getPersonalBreakHistory(row).length > 0);
          if (breakRows.length === 0) {
            toast.info("No break history to export.");
            return;
          }

          const fullMaxSessions = breakRows.reduce(
            (max, row) => Math.max(max, buildBreakSessions(row).length),
            0,
          );

          const exportRows = breakRows.map((row) => {
            const output = {
              Date: row.shift_date,
              "Break Summary": formatPersonalBreakLogValue(row),
              Status: getStatusMeta(row).label,
            };

            for (let i = 0; i < fullMaxSessions; i++) {
              const session = buildBreakSessions(row)[i];
              const ordinal = getOrdinalLabel(i);
              output[`${ordinal} Break Start/Resume`] = formatBreakEventCell(session?.startLabel ?? "", session?.startAt ?? "");
              output[`${ordinal} Break Pause/Complete`] = formatBreakEventCell(session?.endLabel ?? "", session?.endAt ?? "");
            }

            return output;
          });

          const ws = XLSX.utils.json_to_sheet(exportRows);
          XLSX.utils.book_append_sheet(wb, ws, "Break History");
          XLSX.writeFile(wb, `my-break-history-${stamp}.xlsx`);
        } else {
          const rows = data.map((row) => ({
            Date: row.shift_date,
            "Scheduled Shift": row.scheduled_shift || "-",
            "Clock In": formatTime(row.clock_in_at),
            "Clock Out": formatTime(row.clock_out_at),
            "Overtime Start": formatTime(row.overtime_start),
            "Overtime End": formatTime(row.overtime_end),
            "Hours Rendered": formatRenderedHours(row.clock_in_at, row.clock_out_at),
            "Overtime Hours": formatRenderedHours(row.overtime_start, row.overtime_end),
            Status: getStatusMeta(row).label,
          }));

          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, "Time Logs");
          XLSX.writeFile(wb, `my-time-logs-${stamp}.xlsx`);
        }
      }
    } catch {
      toast.error("Failed to export logs.");
    } finally {
      setIsExporting(false);
    }
  }, [user, activeTab, dateRange]);

  const hasHistory = useMemo(() => {
    if (activeTab === TAB_SHIFT_HISTORY) return totalShifts > 0;
    if (activeTab === TAB_BREAK_HISTORY) return breakHistoryRows.length > 0;
    return totalEntries > 0;
  }, [activeTab, totalShifts, breakHistoryRows.length, totalEntries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">
            My Logs
          </h2>
          <p className="text-gray-500 text-sm font-medium">
            View your attendance, breaks, and shift history separately
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
              >
                <CalendarDays size={16} />
                {formatRangeLabel(dateRange)}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          {dateRange && (
            <button
              type="button"
              onClick={clearDateRange}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-3 text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-700"
              title="Clear range"
            >
              <X size={18} />
            </button>
          )}

          {hasHistory && (
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold bg-white border border-gray-200 cursor-pointer hover:bg-gray-50 text-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              {isExporting ? "Exporting..." : "Download Excel"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleTabChange(TAB_TIME_LOGS)}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === TAB_TIME_LOGS
              ? "bg-orange-500 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Time Logs
        </button>
        <button
          type="button"
          onClick={() => handleTabChange(TAB_BREAK_HISTORY)}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === TAB_BREAK_HISTORY
              ? "bg-orange-500 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Break History
        </button>
        <button
          type="button"
          onClick={() => handleTabChange(TAB_SHIFT_HISTORY)}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === TAB_SHIFT_HISTORY
              ? "bg-orange-500 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Shift History
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === TAB_TIME_LOGS ? (
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                  <th className="px-6 py-3 font-bold">Date</th>
                  <th className="px-6 py-3 font-bold">Scheduled Shift</th>
                  <th className="px-6 py-3 font-bold">Clock In</th>
                  <th className="px-6 py-3 font-bold">Clock Out</th>
                  <th className="px-6 py-3 font-bold">Overtime In</th>
                  <th className="px-6 py-3 font-bold">Overtime Out</th>
                  <th className="px-6 py-3 font-bold">Hours</th>
                  <th className="px-6 py-3 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {timeEntries.map((row) => {
                  const statusMeta = getStatusMeta(row);
                  const formattedClockIn = formatTime(row.clock_in_at);
                  const formattedClockOut = formatTime(row.clock_out_at);
                  const { shiftStart, shiftEnd } = getEntryShiftTimes(row, weeklyShift);
                  const considerLate = formattedClockIn !== "-" && !!shiftStart && isLate(formattedClockIn, shiftStart, 5);
                  const considerUnderTime = formattedClockOut !== "-" && !!shiftEnd && isUnderTime(formattedClockOut, shiftEnd);

                  return (
                    <tr key={row.id} className="text-sm">
                      <td className="px-6 py-4 font-bold text-gray-700">{row.shift_date}</td>
                      <td className="px-6 py-4 text-gray-700">{row.scheduled_shift || "-"}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {formattedClockIn}{" "}
                        {considerLate && <span className="bg-orange-600 text-white px-2 rounded-2xl text-[10px] font-bold">Late</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {formattedClockOut}{" "}
                        {considerUnderTime && <span className="bg-orange-600 text-white px-2 rounded-2xl text-[10px] font-bold">Undertime</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{formatTime(row.overtime_start)}</td>
                      <td className="px-6 py-4 text-gray-500">{formatTime(row.overtime_end)}</td>
                      <td className="px-6 py-4 text-gray-500">{formatRenderedHours(row.clock_in_at, row.clock_out_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${statusMeta.tone === "green" ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"}`}>
                          {statusMeta.tone === "green" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {statusMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : activeTab === TAB_BREAK_HISTORY ? (
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                  <th className="px-6 py-3 font-bold">Date</th>
                  <th className="px-6 py-3 font-bold">Break Summary</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  {breakHistoryColumns.map((col, idx) => (
                    <th key={idx} className="px-6 py-3 font-bold">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {breakHistoryRows.map((row) => {
                  const statusMeta = getStatusMeta(row);
                  return (
                    <tr key={row.id} className="text-sm">
                      <td className="px-6 py-4 font-bold text-gray-700">{row.shift_date}</td>
                      <td className="px-6 py-4 text-gray-500">{formatPersonalBreakLogValue(row)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${statusMeta.tone === "green" ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      {breakHistoryColumns.map((col, idx) => (
                        <td key={idx} className="px-6 py-4 text-gray-500">{col.getValue(row)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                  <th className="px-6 py-3 font-bold">Week Range</th>
                  <th className="px-6 py-3 font-bold">Shift Time</th>
                  <th className="px-6 py-3 font-bold text-right">Assigned Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shiftHistory.map((r) => (
                  <tr key={r.id} className="text-sm">
                    <td className="px-6 py-4 font-bold text-gray-700">{r.week_start} to {r.week_end}</td>
                    <td className="px-6 py-4 text-gray-500">{formatShiftTimeLabel(r.shift_start_time)} - {formatShiftTimeLabel(r.shift_end_time)}</td>
                    <td className="px-6 py-4 text-right text-gray-400">{formatReadableDateTime(r.shift_created_at ?? r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!isLoading && currentTotal === 0 && (
            <div className="px-6 py-12 text-center text-gray-400 text-sm font-medium">
              No records found.
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 cursor-pointer hover:bg-gray-50 disabled:opacity-60"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 cursor-pointer hover:bg-gray-50 disabled:opacity-60"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
