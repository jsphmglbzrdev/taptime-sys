import { AlertCircle, CheckCircle2, Download, X } from "lucide-react";
import { isLate, isUnderTime } from "../../utils/shiftSchedule";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabase";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import {
  formatReadableDateTime,
  getEntryShiftTimes,
  formatShiftTimeLabel,
} from "../../utils/shiftSchedule";
import { formatRenderedHours } from "../../utils/timeMetrics";
import { formatPersonalBreakLogValue, getPersonalBreakState } from "../../utils/personalBreak";

const TAB_TIME_LOGS = "time_logs";
const TAB_SHIFT_HISTORY = "shift_history";
const PREVIOUS_VERSIONS_TABLE_HEADERS = [
  "Date Created",
  "Week Start",
  "Week End",
  "Time Shift",
];

function formatTime(value) {
  if (!value) return "-";
  const raw = String(value).trim();
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayedShiftRange(row) {
  if (!row) return "";
  return `${formatShiftTimeLabel(row.shift_start_time)} - ${formatShiftTimeLabel(row.shift_end_time)}`;
}

function sanitizeFilePart(label) {
  return String(label || "employee")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function calculateStatusWithColor(row) {
  const hasClockIn = !!row.clock_in_at;
  const hasClockOut = !!row.clock_out_at;
  const personalBreakState = getPersonalBreakState(row);
  const hasOvertimeIn = !!row.overtime_start;
  const hasOvertimeOut = !!row.overtime_end;
  const hasOvertimeActive = hasOvertimeIn && !hasOvertimeOut;
  const hasOvertimeCompleted = hasOvertimeIn && hasOvertimeOut;

  let statusLabel, statusTone;

  if (hasOvertimeCompleted) {
    statusLabel = "Shift Completed with Overtime";
    statusTone = "green";
  } else if (hasOvertimeActive) {
    statusLabel = "Overtime";
    statusTone = "orange";
  } else if (hasClockOut) {
    statusLabel = "Shift Completed";
    statusTone = "green";
  } else if (personalBreakState.isRunning) {
    statusLabel = "Personal Break";
    statusTone = "orange";
  } else if (hasClockIn) {
    statusLabel = "Working";
    statusTone = "green";
  } else {
    statusLabel = "Not started";
    statusTone = "orange";
  }

  return { statusLabel, statusTone };
}
function EmployeeLogsModal({
  isOpen,
  onClose,
  employee,
  rows,
  onExport,
  isExporting,
}) {
  const [activeTab, setActiveTab] = useState(TAB_TIME_LOGS);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [shiftHistoryRows, setShiftHistoryRows] = useState([]);

  const displayName = useMemo(
    () =>
      `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim() ||
      employee?.email ||
      "Employee",
    [employee],
  );

  const loadShiftHistory = useCallback(async () => {
    if (!employee?.auth_id) return;
    setIsHistoryLoading(true);
    try {
      const [curRes, histRes] = await Promise.all([
        supabase
          .from("employee_weekly_shifts")
          .select(
            "id, week_start, week_end, shift_start_time, shift_end_time, created_at",
          )
          .eq("employee_auth_id", employee.auth_id)
          .order("week_start", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("employee_weekly_shift_history")
          .select(
            "id, shift_created_at, week_start, week_end, shift_start_time, shift_end_time, superseded_at",
          )
          .eq("employee_auth_id", employee.auth_id)
          .order("superseded_at", { ascending: false }),
      ]);

      if (curRes.error) throw curRes.error;
      if (histRes.error) throw histRes.error;

      setCurrentShift(curRes.data ?? null);
      setShiftHistoryRows(histRes.data ?? []);
    } catch {
      setCurrentShift(null);
      setShiftHistoryRows([]);
      toast.error("Failed to load weekly shift history.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, [employee?.auth_id]);

  useEffect(() => {
    if (!isOpen || !employee?.auth_id) return;
    setActiveTab(TAB_TIME_LOGS);
    loadShiftHistory();
  }, [employee?.auth_id, isOpen, loadShiftHistory]);

  const handleShiftHistoryDownload = useCallback(() => {
    if (shiftHistoryRows.length === 0) {
      toast.info("No weekly shift history to download.");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const sheetData = [
        PREVIOUS_VERSIONS_TABLE_HEADERS,
        ...shiftHistoryRows.map((row) => [
          formatReadableDateTime(row.shift_created_at),
          row.week_start,
          row.week_end,
          displayedShiftRange(row),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, "Weekly Shift History");

      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `shift_history_${sanitizeFilePart(displayName)}_${stamp}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch {
      toast.error("Could not download weekly shift history.");
    }
  }, [displayName, shiftHistoryRows]);

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black text-gray-800 break-words">
              {displayName} — Time Logs
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 break-all">{employee.email}</p>
          </div>

          <div className="flex w-full sm:w-auto items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={
                activeTab === TAB_TIME_LOGS ? onExport : handleShiftHistoryDownload
              }
              disabled={
                activeTab === TAB_TIME_LOGS
                  ? isExporting
                  : isHistoryLoading || shiftHistoryRows.length === 0
              }
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              <Download size={18} className="shrink-0" />
              {activeTab === TAB_TIME_LOGS
                ? isExporting
                  ? "Exporting..."
                  : "Download Excel"
                : "Download Shift History"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="border-b border-gray-100 px-4 sm:px-6 py-3">
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab(TAB_TIME_LOGS)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition cursor-pointer ${
                activeTab === TAB_TIME_LOGS
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Time Logs History
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(TAB_SHIFT_HISTORY)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition cursor-pointer ${
                activeTab === TAB_SHIFT_HISTORY
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Weekly Shift History
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          {activeTab === TAB_TIME_LOGS ? (
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                  <th className="px-6 py-3 font-bold">Date</th>
                  <th className="px-6 py-3 font-bold">Scheduled Time Shift</th>
                  <th className="px-6 py-3 font-bold">Clock In</th>
                  <th className="px-6 py-3 font-bold">Personal Break</th>
                  <th className="px-6 py-3 font-bold">Clock Out</th>
                  <th className="px-6 py-3 font-bold">Overtime Start</th>
                  <th className="px-6 py-3 font-bold">Overtime End</th>
                  <th className="px-6 py-3 font-bold">Hours Rendered</th>
                  <th className="px-6 py-3 font-bold">Overtime Hours</th>
                  <th className="px-6 py-3 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => {
                  const { statusLabel, statusTone } = calculateStatusWithColor(r);
                  const formattedClockIn = formatTime(r?.clock_in_at);
                  const formattedClockOut = formatTime(r?.clock_out_at);
                  const { shiftStart, shiftEnd } = getEntryShiftTimes(r);

                  const considerLate =
                    formattedClockIn !== "-" &&
                    !!shiftStart &&
                    isLate(formattedClockIn, shiftStart, 5);
                  const considerUnderTime =
                    !!r?.clock_out_at &&
                    formattedClockOut !== "-" &&
                    !!shiftEnd &&
                    isUnderTime(formattedClockOut, shiftEnd);

                  return (
                    <tr key={r.id} className="text-sm">
                      <td className="px-6 py-4 font-bold text-gray-700">
                        {r.shift_date}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {r.scheduled_shift}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {formattedClockIn}{" "}
                        {considerLate && (
                          <span className="bg-orange-600 text-white px-2 rounded-2xl text-xs font-bold">
                            Late
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {formatPersonalBreakLogValue(r)}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {formattedClockOut}{" "}
                        {considerUnderTime && (
                          <span className="bg-orange-600 text-white px-2 rounded-2xl text-xs font-bold">
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
                      <td className="px-6 py-4 text-gray-500">
                        {formatRenderedHours(r.clock_in_at, r.clock_out_at)}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {formatRenderedHours(r.overtime_start, r.overtime_end)}
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
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-6 py-10 text-gray-400 text-sm font-medium"
                    >
                      No time logs found for this employee.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : isHistoryLoading ? (
            <div className="px-6 py-10 text-sm font-medium text-gray-500">
              Loading weekly shift history...
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Current Schedule
                </h3>
                {currentShift ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/80">
                        <th className="px-4 py-2 font-bold">Date Created</th>
                        <th className="px-4 py-2 font-bold">Week Start</th>
                        <th className="px-4 py-2 font-bold">Week End</th>
                        <th className="px-4 py-2 font-bold">Time Shift</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {formatReadableDateTime(currentShift.created_at)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {currentShift.week_start}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {currentShift.week_end}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {displayedShiftRange(currentShift)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-500 font-medium">
                    No active shift on file.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Previous Versions
                </h3>
                {shiftHistoryRows.length === 0 ? (
                  <p className="text-sm text-gray-500 font-medium">
                    No archived changes yet.
                  </p>
                ) : (
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/80">
                          <th className="px-4 py-2 font-bold">Date Created</th>
                          <th className="px-4 py-2 font-bold">Week Start</th>
                          <th className="px-4 py-2 font-bold">Week End</th>
                          <th className="px-4 py-2 font-bold">Time Shift</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {shiftHistoryRows.map((row) => (
                          <tr key={row.id}>
                            <td className="px-4 py-3 text-gray-700 font-medium">
                              {formatReadableDateTime(row.shift_created_at)}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-medium">
                              {row.week_start}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-medium">
                              {row.week_end}
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-medium">
                              {displayedShiftRange(row)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmployeeLogsModal;
