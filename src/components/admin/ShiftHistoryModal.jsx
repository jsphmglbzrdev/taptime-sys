import React, { useCallback, useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { supabase } from "../../utils/supabase";
import {
  formatShiftTimeLabel,
  formatReadableDateTime,
} from "../../utils/shiftSchedule";

/** Headers and cell values match the “Previous versions” table in this modal. */
const PREVIOUS_VERSIONS_TABLE_HEADERS = [
  "Date Created",
  "Week Start",
  "Week End",
  "Time Shift",
];

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

export default function ShiftHistoryModal({
  isOpen,
  onClose,
  employeeAuthId,
  employeeLabel,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [current, setCurrent] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  const load = useCallback(async () => {
    if (!employeeAuthId) return;
    setIsLoading(true);
    try {
      const [curRes, histRes] = await Promise.all([
        supabase
          .from("employee_weekly_shifts")
          .select(
            "id, week_start, week_end, shift_start_time, shift_end_time, created_at",
          )
          .eq("employee_auth_id", employeeAuthId)
          .order("week_start", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("employee_weekly_shift_history")
          .select(
            "id, shift_created_at, week_start, week_end, shift_start_time, shift_end_time, superseded_at",
          )
          .eq("employee_auth_id", employeeAuthId)
          .order("superseded_at", { ascending: false }),
      ]);

      if (curRes.error) throw curRes.error;
      if (histRes.error) throw histRes.error;

      setCurrent(curRes.data ?? null);
      setHistoryRows(histRes.data ?? []);
    } catch {
      setCurrent(null);
      setHistoryRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [employeeAuthId]);

  const handleDownload = useCallback(() => {
    if (!employeeAuthId) return;
    if (historyRows.length === 0) {
      toast.info("No previous versions to download.");
      return;
    }
    try {
      const wb = XLSX.utils.book_new();
      const sheetData = [
        PREVIOUS_VERSIONS_TABLE_HEADERS,
        ...historyRows.map((r) => [
          formatReadableDateTime(r.shift_created_at),
          r.week_start,
          r.week_end,
          displayedShiftRange(r),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, "Previous versions");

      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `shift_history_${sanitizeFilePart(employeeLabel)}_${stamp}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch {
      toast.error("Could not download shift history.");
    }
  }, [employeeAuthId, employeeLabel, historyRows]);

  useEffect(() => {
    if (!isOpen || !employeeAuthId) return;
    load();
  }, [isOpen, employeeAuthId, load]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <div className="font-black text-xl text-gray-800">
              Shift history
            </div>
            <div className="text-xs font-bold text-gray-400">
              {employeeLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {isLoading ? (
            <p className="text-sm font-medium text-gray-500">Loading…</p>
          ) : (
            <>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Current schedule
                </h3>
                {current ? (
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
                          {formatReadableDateTime(current.created_at)}
                        </td>

                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {current.week_start}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {current.week_end}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {displayedShiftRange(current)}
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
                  Previous versions
                </h3>
                {historyRows.length === 0 ? (
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
                        {historyRows.map((r) => (
                          <tr key={r.id}>
                            <td className="px-4 py-3 text-gray-700 font-medium">
                              {formatReadableDateTime(r.shift_created_at)}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-medium">
                              {r.week_start}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-medium">
                              {r.week_end}
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-medium">
                              {displayedShiftRange(r)}
                            </td>
                          
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={isLoading || historyRows.length === 0}
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} aria-hidden />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl font-black bg-orange-500 text-white hover:bg-orange-600 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
