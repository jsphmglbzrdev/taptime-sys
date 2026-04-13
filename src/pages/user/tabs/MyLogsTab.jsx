import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../../../utils/supabase";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { isLate, isUnderTime } from "../../../utils/shiftSchedule";

const PAGE_SIZE = 10;

function formatTime(value) {
  if (!value) return "-";
  const raw = String(value).trim();
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MyLogsTab() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [weeklyShift, setWeeklyShift] = useState(null);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );
  const rangeFrom = useMemo(() => (page - 1) * PAGE_SIZE, [page]);
  const rangeTo = useMemo(() => rangeFrom + PAGE_SIZE - 1, [rangeFrom]);
  const getShiftDate = useCallback((d) => d.toLocaleDateString("en-CA"), []);

  const fetchPage = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await supabase
        .from("time_entries")
        .select(
          `
          id,
          shift_date,
          clock_in_at,
          morning_break_in_at,
          morning_break_out_at,
          afternoon_break_in_at,
          afternoon_break_out_at,
          lunch_break_in_at,
          lunch_break_out_at,
          clock_out_at,
					scheduled_shift,
          overtime_start,
          overtime_end
        `,
          { count: "exact" },
        )
        .eq("auth_id", user.id)
        .order("shift_date", { ascending: false })
        .range(rangeFrom, rangeTo);

      if (res.error) throw res.error;

      setRows(res.data ?? []);
      setTotal(res.count ?? 0);
    } catch (err) {
      toast.error("Failed to load logs.");
    } finally {
      setIsLoading(false);
    }
  }, [rangeFrom, rangeTo, user]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const downloadExcel = useCallback(async () => {
    if (!user) return;
    setIsDownloading(true);
    try {
      const res = await supabase
        .from("time_entries")
        .select(
          `
          shift_date,
          clock_in_at,
          morning_break_in_at,
          morning_break_out_at,
          afternoon_break_in_at,
          afternoon_break_out_at,
          lunch_break_in_at,
          lunch_break_out_at,
          clock_out_at,
					scheduled_shift,
          overtime_start,
          overtime_end
        `,
        )
        .eq("auth_id", user.id)
        .order("shift_date", { ascending: false });

      if (res.error) throw res.error;

      const data = (res.data ?? []).map((r) => {
        const [shiftStartTime, shiftEndTime] =
          r.scheduled_shift?.split(/\s*-\s*/).map((value) => value.trim()) ?? ["", ""];

        const effectiveShiftStart =
          shiftStartTime || weeklyShift?.shift_start_time || "";
        const effectiveShiftEnd =
          shiftEndTime || weeklyShift?.shift_end_time || "";

        // Format times
        const clockInTime = r.clock_in_at
          ? new Date(r.clock_in_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        const clockOutTime = r.clock_out_at
          ? new Date(r.clock_out_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";

        // Calculate status
        const consideredLate = clockInTime
          ? isLate(clockInTime, effectiveShiftStart, 5)
          : false;
        const consideredUnderTime = clockOutTime
          ? isUnderTime(clockOutTime, effectiveShiftEnd)
          : false;

        // Append status to times
        const clockInDisplay = clockInTime
          ? `${clockInTime}${consideredLate ? " - Late" : ""}`
          : "";
        const clockOutDisplay = clockOutTime
          ? `${clockOutTime}${consideredUnderTime ? " - Undertime" : ""}`
          : "";
					
	        const hasClockIn = !!r.clock_in_at;
        const hasClockOut = !!r.clock_out_at;
        const hasMorningIn = !!r.morning_break_in_at;
        const hasMorningOut = !!r.morning_break_out_at;
        const hasAfternoonIn = !!r.afternoon_break_in_at;
        const hasAfternoonOut = !!r.afternoon_break_out_at;
        const hasLunchIn = !!r.lunch_break_in_at;
        const hasLunchOut = !!r.lunch_break_out_at;
        const hasOvertimeIn = !!r.overtime_start;
        const hasOvertimeOut = !!r.overtime_end;
        const hasOvertimeActive = hasOvertimeIn && !hasOvertimeOut;
        const hasOvertimeCompleted = hasOvertimeIn && hasOvertimeOut;

        const statusLabel = hasOvertimeCompleted
          ? "Shift Completed with Overtime"
          : hasOvertimeActive
            ? "Overtime"
            : hasClockOut
              ? "Shift Completed"
              : hasMorningIn && !hasMorningOut
                ? "Morning Break"
                : hasAfternoonIn && !hasAfternoonOut
                  ? "Afternoon Break"
                  : hasLunchIn && !hasLunchOut
                    ? "Lunch Break"
                    : hasClockIn
                      ? "Working"
                      : "Not started";

        return {
          Date: r.shift_date,
          "Scheduled Time Shift": r.scheduled_shift,
          "Clock In": clockInDisplay,
          "Morning Break Time (Time In)": r.morning_break_in_at
            ? new Date(r.morning_break_in_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          "Morning Break Time (Time Out)": r.morning_break_out_at
            ? new Date(r.morning_break_out_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          "Afternoon Break Time (Time In)": r.afternoon_break_in_at
            ? new Date(r.afternoon_break_in_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          "Afternoon Break Time (Time Out)": r.afternoon_break_out_at
            ? new Date(r.afternoon_break_out_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          "Lunch Break Time (Time In)": r.lunch_break_in_at
            ? new Date(r.lunch_break_in_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          "Lunch Break Time (Time Out)": r.lunch_break_out_at
            ? new Date(r.lunch_break_out_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          "Clock Out": clockOutDisplay,
          "Overtime Start": r.overtime_start
            ? new Date(r.overtime_start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          "Overtime End": r.overtime_end
            ? new Date(r.overtime_end).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          Status: statusLabel,
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "My Logs");

      const fileName = `my-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      toast.error("Failed to export Excel.");
    } finally {
      setIsDownloading(false);
    }
  }, [user, weeklyShift]);

  const fetchWeeklyShift = useCallback(async () => {
    if (!user) return;
    const today = getShiftDate(new Date());
    const res = await supabase
      .from("employee_weekly_shifts")
      .select("week_start, week_end, shift_start_time, shift_end_time")
      .eq("employee_auth_id", user.id)
      .lte("week_start", today)
      .gte("week_end", today)
      .maybeSingle();

    if (res.error) {
      setWeeklyShift(null);
      return;
    }
    setWeeklyShift(res.data ?? null);
  }, [getShiftDate, user]);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchWeeklyShift()]).catch(() => {
      toast.error("Failed to load dashboard data.");
    });
  }, [user, fetchWeeklyShift]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">
            My Logs
          </h2>
          <p className="text-gray-500 text-sm font-medium">
            All your time entries
          </p>
        </div>
        <button
          type="button"
          onClick={downloadExcel}
          disabled={!user || isDownloading}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold bg-white border border-gray-200 cursor-pointer hover:bg-gray-50 text-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <Download size={18} />
          {isDownloading ? "Exporting..." : "Download Excel"}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                <th className="px-6 py-3 font-bold">Date</th>
                <th className="px-6 py-3 font-bold">Scheduled Time Shift</th>
                <th className="px-6 py-3 font-bold">Clock In</th>
                <th className="px-6 py-3 font-bold">
                  Morning Break Time (Time In)
                </th>
                <th className="px-6 py-3 font-bold">
                  Morning Break Time (Time Out)
                </th>
                <th className="px-6 py-3 font-bold">
                  Afternoon Break Time (Time In)
                </th>
                <th className="px-6 py-3 font-bold">
                  Afternoon Break Time (Time Out)
                </th>
                <th className="px-6 py-3 font-bold">
                  Lunch Break Time (Time In)
                </th>
                <th className="px-6 py-3 font-bold">
                  Lunch Break Time (Time Out)
                </th>
                <th className="px-6 py-3 font-bold">Clock Out</th>
                <th className="px-6 py-3 font-bold">Overtime Start</th>
                <th className="px-6 py-3 font-bold">Overtime End</th>
                <th className="px-6 py-3 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => {
                const hasClockIn = !!r.clock_in_at;
                const hasClockOut = !!r.clock_out_at;
                const hasMorningIn = !!r.morning_break_in_at;
                const hasMorningOut = !!r.morning_break_out_at;
                const hasAfternoonIn = !!r.afternoon_break_in_at;
                const hasAfternoonOut = !!r.afternoon_break_out_at;
                const hasLunchIn = !!r.lunch_break_in_at;
                const hasLunchOut = !!r.lunch_break_out_at;
                const hasOvertimeIn = !!r.overtime_start;
                const hasOvertimeOut = !!r.overtime_end;
                const hasOvertimeActive = hasOvertimeIn && !hasOvertimeOut;
                const hasOvertimeCompleted = hasOvertimeIn && hasOvertimeOut;

                const considerLate = isLate(
                  formatTime(r?.clock_in_at),
                  weeklyShift?.shift_start_time,
                  5,
                );
                const considerUnderTime = isUnderTime(
                  formatTime(r?.clock_out_at),
                  weeklyShift?.shift_end_time,
                );

                const statusLabel = hasOvertimeCompleted
                  ? "Shift Completed with Overtime"
                  : hasOvertimeActive
                    ? "Overtime"
                    : hasClockOut
                      ? "Shift Completed"
                      : hasMorningIn && !hasMorningOut
                        ? "Morning Break"
                        : hasAfternoonIn && !hasAfternoonOut
                          ? "Afternoon Break"
                          : hasLunchIn && !hasLunchOut
                            ? "Lunch Break"
                            : hasClockIn
                              ? "Working"
                              : "Not started";

                const statusTone = !hasClockIn
                  ? "orange"
                  : hasOvertimeActive
                    ? "orange"
                    : hasOvertimeCompleted || hasClockOut
                      ? "green"
                      : hasMorningIn && !hasMorningOut
                        ? "orange"
                        : hasAfternoonIn && !hasAfternoonOut
                          ? "orange"
                          : hasLunchIn && !hasLunchOut
                            ? "orange"
                            : "green";

                return (
                  <tr key={r.id} className="text-sm">
                    <td className="px-6 py-4 font-bold text-gray-700">
                      {r.shift_date}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {r.scheduled_shift}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatTime(r.clock_in_at)}{" "}
                      {considerLate && (
                        <span className="bg-orange-600 text-white px-2 rounded-2xl">
                          Late
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatTime(r.morning_break_in_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatTime(r.morning_break_out_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatTime(r.afternoon_break_in_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatTime(r.afternoon_break_out_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatTime(r.lunch_break_in_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatTime(r.lunch_break_out_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatTime(r.clock_out_at)}{" "}
                      {considerUnderTime && (
                        <span className="bg-orange-600 text-white px-2 rounded-2xl">
                          Undertime
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatTime(r.overtime_start)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatTime(r.overtime_end)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          statusTone === "green"
                            ? "bg-green-50 text-green-600"
                            : "bg-orange-50 text-orange-600"
                        }`}
                      >
                        {statusTone === "green" ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <AlertCircle size={12} />
                        )}
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td
                    className="px-6 py-8 text-gray-400 text-sm font-medium"
                    colSpan={13}
                  >
                    No logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-400">
            Page {page} of {totalPages} • {total} rows
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 cursor-pointer hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 cursor-pointer hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
