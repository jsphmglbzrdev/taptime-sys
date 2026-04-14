import { AlertCircle, CheckCircle2, Download, X } from "lucide-react";
import { isLate, isUnderTime } from "../../utils/shiftSchedule";
import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

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

function calculateStatusWithColor(row) {
  const hasClockIn = !!row.clock_in_at;
  const hasClockOut = !!row.clock_out_at;
  const hasMorningIn = !!row.morning_break_in_at;
  const hasMorningOut = !!row.morning_break_out_at;
  const hasAfternoonIn = !!row.afternoon_break_in_at;
  const hasAfternoonOut = !!row.afternoon_break_out_at;
  const hasLunchIn = !!row.lunch_break_in_at;
  const hasLunchOut = !!row.lunch_break_out_at;
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
  } else if (hasMorningIn && !hasMorningOut) {
    statusLabel = "Morning Break";
    statusTone = "orange";
  } else if (hasAfternoonIn && !hasAfternoonOut) {
    statusLabel = "Afternoon Break";
    statusTone = "orange";
  } else if (hasLunchIn && !hasLunchOut) {
    statusLabel = "Lunch Break";
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
  const [weeklyShift, setWeeklyShift] = useState(null);

  useEffect(() => {
    if (!isOpen || !employee || !rows.length) return;

    const fetchWeeklyShift = async () => {
      try {
        const shiftDate = rows[0]?.shift_date;
        if (!shiftDate) return;

        const res = await supabase
          .from("employee_weekly_shifts")
          .select("shift_start_time, shift_end_time")
          .eq("employee_auth_id", employee.auth_id)
          .lte("week_start", shiftDate)
          .gte("week_end", shiftDate)
          .maybeSingle();

        if (res.data) {
          setWeeklyShift(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch weekly shift:", err);
      }
    };

    fetchWeeklyShift();
  }, [isOpen, employee, rows]);

  if (!isOpen || !employee) return null;

  const displayName =
    `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
    employee.email;

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
              onClick={onExport}
              disabled={isExporting}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              <Download size={18} className="shrink-0" />
              {isExporting ? "Exporting..." : "Download Excel"}
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

        <div className="overflow-auto">
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
                const { statusLabel, statusTone } = calculateStatusWithColor(r);
                const formattedClockIn = formatTime(r?.clock_in_at);
                const formattedClockOut = formatTime(r?.clock_out_at);

                const considerLate = isLate(
                  formattedClockIn,
                  weeklyShift?.shift_start_time,
                  5,
                );
                const considerUnderTime =
                  !!r?.clock_out_at &&
                  formattedClockOut !== "-" &&
                  !!weeklyShift?.shift_end_time &&
                  isUnderTime(formattedClockOut, weeklyShift.shift_end_time);

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
                    colSpan={13}
                    className="px-6 py-10 text-gray-400 text-sm font-medium"
                  >
                    No time logs found for this employee.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default EmployeeLogsModal;
