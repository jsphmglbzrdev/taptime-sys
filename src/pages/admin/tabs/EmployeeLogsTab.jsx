import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Download,
  History,
  Search,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import {
  listTimeEntriesByAuthId,
  listUserProfiles,
} from "../../../utils/admin";
import { supabase } from "../../../utils/supabase";
import {
  formatReadableDateTime,
  formatShiftTimeLabel,
  getEntryShiftTimes,
  isLate,
  isUnderTime,
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
const TAB_SHIFT_HISTORY = "shift_history";
const TAB_BREAK_HISTORY = "break_history";
const ORDINAL_LABELS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"];
const PAGE_SIZE = 8;

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

function formatEmployeeName(employee) {
  if (!employee) return "Employee";
  const fullName = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
  return fullName || employee.email || employee.auth_id || "Employee";
}

function displayShiftRange(row) {
  if (!row) return "-";
  return `${formatShiftTimeLabel(row.shift_start_time)} - ${formatShiftTimeLabel(row.shift_end_time)}`;
}

function sanitizeFilePart(label) {
  return String(label || "employee")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function getOrdinalLabel(index) {
  return ORDINAL_LABELS[index] ?? `Break ${index + 1}`;
}

function getScheduledShiftDisplay(row, fallbackWeeklyShift = null) {
  if (row?.scheduled_shift) return row.scheduled_shift;
  const { shiftStart, shiftEnd } = getEntryShiftTimes(row ?? {}, fallbackWeeklyShift);
  if (!shiftStart || !shiftEnd) return "-";
  return `${formatShiftTimeLabel(shiftStart)} - ${formatShiftTimeLabel(shiftEnd)}`;
}

function getStatusMeta(row) {
  const hasClockIn = !!row?.clock_in_at;
  const hasClockOut = !!row?.clock_out_at;
  const breakState = getPersonalBreakState(row);
  const hasOvertimeIn = !!row?.overtime_start;
  const hasOvertimeOut = !!row?.overtime_end;
  const hasOvertimeActive = hasOvertimeIn && !hasOvertimeOut;
  const hasOvertimeCompleted = hasOvertimeIn && hasOvertimeOut;

  if (hasOvertimeCompleted) {
    return { label: "Completed with Overtime", tone: "green" };
  }
  if (hasOvertimeActive) {
    return { label: "Overtime", tone: "orange" };
  }
  if (hasClockOut) {
    return { label: "Shift Completed", tone: "green" };
  }
  if (breakState.isRunning) {
    return { label: "Personal Break", tone: "orange" };
  }
  if (hasClockIn) {
    return { label: "Working", tone: "green" };
  }
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

function formatBreakEventCell(label, at) {
  if (!at) return "-";
  return `${label} ${formatTime(at)}`.trim();
}

function getBreakHistoryColumns(rows) {
  const maxSessions = rows.reduce(
    (max, row) => Math.max(max, buildBreakSessions(row).length),
    0,
  );

  return Array.from({ length: maxSessions }).flatMap((_, index) => {
    const ordinal = getOrdinalLabel(index);
    return [
      {
        key: `break_${index + 1}_start`,
        label: `${ordinal} Break Start/Resume`,
        value: (row) => {
          const session = buildBreakSessions(row)[index];
          return formatBreakEventCell(session?.startLabel ?? "", session?.startAt ?? "");
        },
      },
      {
        key: `break_${index + 1}_end`,
        label: `${ordinal} Break Pause/Complete`,
        value: (row) => {
          const session = buildBreakSessions(row)[index];
          return formatBreakEventCell(session?.endLabel ?? "", session?.endAt ?? "");
        },
      },
    ];
  });
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseCalendarDate(value) {
  if (!value) return null;
  const parts = String(value).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateLabel(date) {
  if (!date) return "";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isDateWithinRange(value, range) {
  if (!range?.from && !range?.to) return true;
  const target = toDateOnly(value);
  if (!target) return false;

  const from = toDateOnly(range.from);
  const to = toDateOnly(range.to ?? range.from);

  if (from && target < from) return false;
  if (to && target > to) return false;
  return true;
}

function formatRangeLabel(range) {
  if (!range?.from && !range?.to) return "All dates";
  if (range?.from && !range?.to) return formatDateLabel(range.from);
  return `${formatDateLabel(range.from)} - ${formatDateLabel(range.to)}`;
}

function getTabExportCopy(activeTab) {
  if (activeTab === TAB_SHIFT_HISTORY) return "Export Shift History";
  if (activeTab === TAB_BREAK_HISTORY) return "Export Break History";
  return "Export Time Logs";
}

function paginateRows(rows, page, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;

  return {
    pageRows: rows.slice(startIndex, startIndex + pageSize),
    totalPages,
    currentPage: safePage,
  };
}

function PaginationControls({ currentPage, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
      <p className="text-xs font-bold text-gray-400">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function EmployeeLogsDetailModal({
  isOpen,
  employee,
  activeTab,
  setActiveTab,
  timeLogRows,
  currentShiftRows,
  archivedShiftRows,
  breakHistoryRows,
  breakHistoryColumns,
  dateRange,
  setDateRange,
  focusedShiftDate,
  clearFocusedShiftDate,
  isLogsLoading,
  isExporting,
  onExport,
  onClose,
}) {
  const employeeName = formatEmployeeName(employee);
  const [pageByTab, setPageByTab] = useState({
    [TAB_TIME_LOGS]: 1,
    [TAB_SHIFT_HISTORY]: 1,
    [TAB_BREAK_HISTORY]: 1,
  });

  const paginatedTimeLogs = useMemo(
    () => paginateRows(timeLogRows, pageByTab[TAB_TIME_LOGS]),
    [pageByTab, timeLogRows],
  );
  const paginatedShiftHistory = useMemo(
    () => paginateRows([...currentShiftRows, ...archivedShiftRows], pageByTab[TAB_SHIFT_HISTORY]),
    [archivedShiftRows, currentShiftRows, pageByTab],
  );
  const paginatedBreakHistory = useMemo(
    () => paginateRows(breakHistoryRows, pageByTab[TAB_BREAK_HISTORY]),
    [breakHistoryRows, pageByTab],
  );

  const updatePage = useCallback((tab, nextPage) => {
    setPageByTab((current) => ({
      ...current,
      [tab]: nextPage,
    }));
  }, []);

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative flex h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl sm:h-[calc(100vh-3rem)]">
        <div className="border-b border-gray-100 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-orange-500">
                Employee History
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                {employeeName}
              </h3>
              <p className="mt-1 text-sm font-medium text-gray-500">{employee.email}</p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
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
                    onSelect={(range) => {
                      setDateRange(range);
                      setPageByTab({
                        [TAB_TIME_LOGS]: 1,
                        [TAB_SHIFT_HISTORY]: 1,
                        [TAB_BREAK_HISTORY]: 1,
                      });
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              <button
                type="button"
                onClick={() => {
                  setDateRange(undefined);
                  setPageByTab({
                    [TAB_TIME_LOGS]: 1,
                    [TAB_SHIFT_HISTORY]: 1,
                    [TAB_BREAK_HISTORY]: 1,
                  });
                }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50"
              >
                Clear Range
              </button>

              <button
                type="button"
                onClick={onExport}
                disabled={isExporting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Download size={16} />
                {isExporting ? "Exporting..." : getTabExportCopy(activeTab)}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-3 text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab(TAB_TIME_LOGS);
                updatePage(TAB_TIME_LOGS, 1);
              }}
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
              onClick={() => {
                setActiveTab(TAB_SHIFT_HISTORY);
                updatePage(TAB_SHIFT_HISTORY, 1);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === TAB_SHIFT_HISTORY
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Shift History
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab(TAB_BREAK_HISTORY);
                updatePage(TAB_BREAK_HISTORY, 1);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === TAB_BREAK_HISTORY
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Break History
            </button>
          </div>

          {activeTab === TAB_BREAK_HISTORY && focusedShiftDate && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                Showing {focusedShiftDate}
              </span>
              <button
                type="button"
                onClick={clearFocusedShiftDate}
                className="text-xs font-bold text-gray-500 hover:text-orange-600"
              >
                Show all break days
              </button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          {activeTab === TAB_TIME_LOGS ? (
            <>
            <table className="w-full min-w-[1180px]">
              <thead>
                <tr className="bg-gray-50/70 text-left text-[10px] uppercase tracking-widest text-gray-400">
                  <th className="px-4 py-3 font-bold">Employee</th>
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Scheduled Shift</th>
                  <th className="px-4 py-3 font-bold">Clock In</th>
                  <th className="px-4 py-3 font-bold">Clock Out</th>
                  <th className="px-4 py-3 font-bold">Overtime Start</th>
                  <th className="px-4 py-3 font-bold">Overtime End</th>
                  <th className="px-4 py-3 font-bold">Hours Rendered</th>
                  <th className="px-4 py-3 font-bold">Overtime Hours</th>
                  <th className="px-4 py-3 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {paginatedTimeLogs.pageRows.map((row) => {
                  const statusMeta = getStatusMeta(row);
                  const formattedClockIn = formatTime(row.clock_in_at);
                  const formattedClockOut = formatTime(row.clock_out_at);
                  const { shiftStart, shiftEnd } = getEntryShiftTimes(
                    row,
                    currentShiftRows[0] ?? null,
                  );
                  const considerLate =
                    formattedClockIn !== "-" &&
                    !!shiftStart &&
                    isLate(formattedClockIn, shiftStart, 5);
                  const considerUnderTime =
                    formattedClockOut !== "-" &&
                    !!shiftEnd &&
                    isUnderTime(formattedClockOut, shiftEnd);

                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-4 font-bold text-gray-700">{employeeName}</td>
                      <td className="px-4 py-4 font-bold text-gray-700">{row.shift_date}</td>
                      <td className="px-4 py-4 text-gray-600">
                        {getScheduledShiftDisplay(row, currentShiftRows[0] ?? null)}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {formattedClockIn}{" "}
                        {considerLate && (
                          <span className="rounded-2xl bg-orange-600 px-2 py-0.5 text-xs font-bold text-white">
                            Late
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {formattedClockOut}{" "}
                        {considerUnderTime && (
                          <span className="rounded-2xl bg-orange-600 px-2 py-0.5 text-xs font-bold text-white">
                            Undertime
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-600">{formatTime(row.overtime_start)}</td>
                      <td className="px-4 py-4 text-gray-600">{formatTime(row.overtime_end)}</td>
                      <td className="px-4 py-4 text-gray-600">
                        {formatRenderedHours(row.clock_in_at, row.clock_out_at)}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {formatRenderedHours(row.overtime_start, row.overtime_end)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                            statusMeta.tone === "green"
                              ? "bg-green-50 text-green-600"
                              : "bg-orange-50 text-orange-600"
                          }`}
                        >
                          {statusMeta.tone === "green" ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <AlertCircle size={12} />
                          )}
                          {statusMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!isLogsLoading && timeLogRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-sm font-medium text-gray-400">
                      No time logs found for this employee in the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationControls
              currentPage={paginatedTimeLogs.currentPage}
              totalPages={paginatedTimeLogs.totalPages}
              onChange={(nextPage) => updatePage(TAB_TIME_LOGS, nextPage)}
            />
            </>
          ) : activeTab === TAB_BREAK_HISTORY ? (
            <>
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="bg-gray-50/70 text-left text-[10px] uppercase tracking-widest text-gray-400">
                  <th className="px-4 py-3 font-bold">Employee</th>
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Break Summary</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  {breakHistoryColumns.map((column) => (
                    <th key={column.key} className="px-4 py-3 font-bold">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {paginatedBreakHistory.pageRows.map((row) => {
                  const statusMeta = getStatusMeta(row);
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-4 font-bold text-gray-700">{employeeName}</td>
                      <td className="px-4 py-4 font-bold text-gray-700">{row.shift_date}</td>
                      <td className="px-4 py-4 text-gray-600">
                        {formatPersonalBreakLogValue(row)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                            statusMeta.tone === "green"
                              ? "bg-green-50 text-green-600"
                              : "bg-orange-50 text-orange-600"
                          }`}
                        >
                          {statusMeta.tone === "green" ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <AlertCircle size={12} />
                          )}
                          {statusMeta.label}
                        </span>
                      </td>
                      {breakHistoryColumns.map((column) => (
                        <td key={column.key} className="px-4 py-4 text-gray-600">
                          {column.value(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {!isLogsLoading && breakHistoryRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={4 + Math.max(1, breakHistoryColumns.length)}
                      className="px-4 py-10 text-sm font-medium text-gray-400"
                    >
                      No break history found for this employee in the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationControls
              currentPage={paginatedBreakHistory.currentPage}
              totalPages={paginatedBreakHistory.totalPages}
              onChange={(nextPage) => updatePage(TAB_BREAK_HISTORY, nextPage)}
            />
            </>
          ) : (
            <>
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="bg-gray-50/70 text-left text-[10px] uppercase tracking-widest text-gray-400">
                  <th className="px-4 py-3 font-bold">Employee</th>
                  <th className="px-4 py-3 font-bold">Created</th>
                  <th className="px-4 py-3 font-bold">Week Start</th>
                  <th className="px-4 py-3 font-bold">Week End</th>
                  <th className="px-4 py-3 font-bold">Time Shift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {paginatedShiftHistory.pageRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-4 font-bold text-gray-700">{employeeName}</td>
                    <td className="px-4 py-4 text-gray-600">
                      {formatReadableDateTime(row.shift_created_at ?? row.created_at)}
                    </td>
                    <td className="px-4 py-4 text-gray-600">{row.week_start}</td>
                    <td className="px-4 py-4 text-gray-600">{row.week_end}</td>
                    <td className="px-4 py-4 text-gray-600">{displayShiftRange(row)}</td>
                  </tr>
                ))}

                {paginatedShiftHistory.pageRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-sm font-medium text-gray-400">
                      No shift history found for this employee in the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationControls
              currentPage={paginatedShiftHistory.currentPage}
              totalPages={paginatedShiftHistory.totalPages}
              onChange={(nextPage) => updatePage(TAB_SHIFT_HISTORY, nextPage)}
            />
            </>
          )}
        </div>

        {isLogsLoading && (
          <div className="border-t border-gray-100 px-6 py-4 text-sm font-medium text-gray-500">
            Loading employee history...
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmployeeLogsTab({
  initialEmployeeAuthId = null,
  initialTab = null,
  initialShiftDate = null,
  onConsumeInitialEmployeeAuthId,
}) {
  const [employees, setEmployees] = useState([]);
  const [selectedAuthId, setSelectedAuthId] = useState(initialEmployeeAuthId);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(initialTab || TAB_TIME_LOGS);
  const [focusedShiftDate, setFocusedShiftDate] = useState(initialShiftDate);
  const [logs, setLogs] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [shiftHistoryRows, setShiftHistoryRows] = useState([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(Boolean(initialEmployeeAuthId));
  const [exportRange, setExportRange] = useState(undefined);

  const loadEmployees = useCallback(async () => {
    setIsEmployeesLoading(true);
    try {
      const res = await listUserProfiles();
      if (!res.success) {
        toast.error(res.error || "Failed to load employees.");
        return;
      }
      setEmployees((res.data ?? []).filter((row) => row?.role === "Employee"));
    } finally {
      setIsEmployeesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (!initialEmployeeAuthId) return;
    setSelectedAuthId(initialEmployeeAuthId);
    setIsModalOpen(true);
    setActiveTab(initialTab || TAB_TIME_LOGS);
    setFocusedShiftDate(initialShiftDate ?? null);
    onConsumeInitialEmployeeAuthId?.();
  }, [
    initialEmployeeAuthId,
    initialShiftDate,
    initialTab,
    onConsumeInitialEmployeeAuthId,
  ]);

  const filteredEmployees = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((employee) => {
      const name = formatEmployeeName(employee).toLowerCase();
      const email = String(employee.email ?? "").toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [employees, search]);

  const selectedEmployee = useMemo(
    () => employees.find((row) => row.auth_id === selectedAuthId) ?? null,
    [employees, selectedAuthId],
  );

  const loadEmployeeData = useCallback(async () => {
    if (!selectedAuthId) {
      setLogs([]);
      setCurrentShift(null);
      setShiftHistoryRows([]);
      return;
    }

    setIsLogsLoading(true);
    try {
      const [logsRes, currentShiftRes, historyRes] = await Promise.all([
        listTimeEntriesByAuthId({ auth_id: selectedAuthId }),
        supabase
          .from("employee_weekly_shifts")
          .select("id, week_start, week_end, shift_start_time, shift_end_time, created_at")
          .eq("employee_auth_id", selectedAuthId)
          .order("week_start", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("employee_weekly_shift_history")
          .select("id, shift_created_at, week_start, week_end, shift_start_time, shift_end_time, superseded_at")
          .eq("employee_auth_id", selectedAuthId)
          .order("superseded_at", { ascending: false }),
      ]);

      if (!logsRes.success) {
        toast.error(logsRes.error || "Failed to load employee logs.");
        setLogs([]);
      } else {
        setLogs(logsRes.data ?? []);
      }

      setCurrentShift(currentShiftRes.error ? null : (currentShiftRes.data ?? null));
      setShiftHistoryRows(historyRes.error ? [] : (historyRes.data ?? []));
    } finally {
      setIsLogsLoading(false);
    }
  }, [selectedAuthId]);

  useEffect(() => {
    if (!isModalOpen) return;
    loadEmployeeData();
  }, [isModalOpen, loadEmployeeData]);

  const completedLogs = useMemo(
    () => logs.filter((row) => !!row.clock_out_at),
    [logs],
  );

  const breakHistoryRows = useMemo(() => {
    const rows = completedLogs.filter(
      (row) => getPersonalBreakHistory(row).length > 0,
    );
    if (!focusedShiftDate) return rows;
    return rows.filter((row) => row.shift_date === focusedShiftDate);
  }, [completedLogs, focusedShiftDate]);

  const breakHistoryColumns = useMemo(
    () => getBreakHistoryColumns(breakHistoryRows),
    [breakHistoryRows],
  );

  const filteredTimeLogs = useMemo(
    () =>
      completedLogs.filter((row) =>
        isDateWithinRange(parseCalendarDate(row.shift_date), exportRange),
      ),
    [completedLogs, exportRange],
  );

  const filteredBreakHistory = useMemo(
    () =>
      breakHistoryRows.filter((row) =>
        isDateWithinRange(parseCalendarDate(row.shift_date), exportRange),
      ),
    [breakHistoryRows, exportRange],
  );

  const filteredCurrentShiftRows = useMemo(
    () =>
      currentShift &&
      isDateWithinRange(parseCalendarDate(currentShift.week_start), exportRange)
        ? [currentShift]
        : [],
    [currentShift, exportRange],
  );

  const filteredArchivedShiftRows = useMemo(
    () => {
      return shiftHistoryRows.filter((row) =>
        isDateWithinRange(parseCalendarDate(row.week_start), exportRange),
      );
    },
    [exportRange, shiftHistoryRows],
  );

  const handleOpenEmployee = useCallback((authId) => {
    setSelectedAuthId(authId);
    setFocusedShiftDate(null);
    setActiveTab(TAB_TIME_LOGS);
    setExportRange(undefined);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setExportRange(undefined);
    setFocusedShiftDate(null);
  }, []);

  const handleExport = useCallback(() => {
    if (!selectedEmployee) {
      toast.info("Select an employee first.");
      return;
    }

    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const employeeName = formatEmployeeName(selectedEmployee);
      const safeLabel = sanitizeFilePart(employeeName);
      const stamp = new Date().toISOString().slice(0, 10);

      if (activeTab === TAB_BREAK_HISTORY) {
        if (filteredBreakHistory.length === 0) {
          toast.info("No break history matched the selected export range.");
          return;
        }

        const rows = filteredBreakHistory.map((row) => {
          const output = {
            Employee: employeeName,
            Date: row.shift_date,
            "Break Summary": formatPersonalBreakLogValue(row),
            Status: getStatusMeta(row).label,
          };

          breakHistoryColumns.forEach((column) => {
            output[column.label] = column.value(row);
          });

          return output;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Break History");
        XLSX.writeFile(wb, `employee-break-history-${safeLabel}-${stamp}.xlsx`);
        return;
      }

      if (activeTab === TAB_SHIFT_HISTORY) {
        const shiftExportRows = [...filteredCurrentShiftRows, ...filteredArchivedShiftRows];
        if (shiftExportRows.length === 0) {
          toast.info("No shift history matched the selected export range.");
          return;
        }

        const rows = shiftExportRows.map((row) => ({
          Employee: employeeName,
          Created: formatReadableDateTime(row.shift_created_at ?? row.created_at),
          "Week Start": row.week_start,
          "Week End": row.week_end,
          "Time Shift": displayShiftRange(row),
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Shift History");
        XLSX.writeFile(wb, `employee-shift-history-${safeLabel}-${stamp}.xlsx`);
        return;
      }

      if (filteredTimeLogs.length === 0) {
        toast.info("No time logs matched the selected export range.");
        return;
      }

      const rows = filteredTimeLogs.map((row) => ({
        Employee: employeeName,
        Date: row.shift_date,
        "Scheduled Shift": getScheduledShiftDisplay(row, currentShift),
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
      XLSX.writeFile(wb, `employee-time-logs-${safeLabel}-${stamp}.xlsx`);
    } catch {
      toast.error("Failed to export employee data.");
    } finally {
      setIsExporting(false);
    }
  }, [
    activeTab,
    breakHistoryColumns,
    currentShift,
    filteredArchivedShiftRows,
    filteredBreakHistory,
    filteredCurrentShiftRows,
    filteredTimeLogs,
    selectedEmployee,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-800">
            Employee Logs
          </h2>
          <p className="text-sm font-medium text-gray-500">
            Open an employee card to view time logs, shift history, and break history separately.
          </p>
        </div>

        <div className="relative w-full lg:w-80">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employee"
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-sm font-medium text-gray-700 outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredEmployees.map((employee) => {
          const employeeName = formatEmployeeName(employee);
          return (
            <button
              key={employee.auth_id}
              type="button"
              onClick={() => handleOpenEmployee(employee.auth_id)}
              className="rounded-3xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
            >
              <p className="text-xs font-black uppercase tracking-widest text-orange-500">
                Employee
              </p>
              <h3 className="mt-3 text-xl font-black tracking-tight text-gray-900">
                {employeeName}
              </h3>
              <p className="mt-2 text-sm font-medium text-gray-500">{employee.email}</p>
              <div className="mt-5 inline-flex rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
                View History
              </div>
            </button>
          );
        })}

        {!isEmployeesLoading && filteredEmployees.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm font-medium text-gray-500">
            No employees matched your search.
          </div>
        )}
      </div>

      <EmployeeLogsDetailModal
        isOpen={isModalOpen}
        employee={selectedEmployee}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        timeLogRows={filteredTimeLogs}
        currentShiftRows={filteredCurrentShiftRows}
        archivedShiftRows={filteredArchivedShiftRows}
        breakHistoryRows={filteredBreakHistory}
        breakHistoryColumns={breakHistoryColumns}
        dateRange={exportRange}
        setDateRange={setExportRange}
        focusedShiftDate={focusedShiftDate}
        clearFocusedShiftDate={() => setFocusedShiftDate(null)}
        isLogsLoading={isLogsLoading}
        isExporting={isExporting}
        onExport={handleExport}
        onClose={handleCloseModal}
      />
    </div>
  );
}
