import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpenText,
  CheckCircle2,
  Clock,
  Coffee,
  PlayCircle,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  autoEndExpiredBreaksByShiftDate,
  listTimeEntriesByShiftDate,
  listUserProfiles,
} from "../../../utils/admin";
import { supabase } from "../../../utils/supabase";
import {
  formatPersonalBreakLogValue,
  getPersonalBreakHistory,
  getPersonalBreakState,
} from "../../../utils/personalBreak";
import {
  formatShiftTimeLabel,
  getEntryShiftTimes,
} from "../../../utils/shiftSchedule";

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

function formatCountdown(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined) return "--:--";
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getScheduledShiftDisplay(entry, weeklyShift = null) {
  if (entry?.scheduled_shift) return entry.scheduled_shift;
  const { shiftStart, shiftEnd } = getEntryShiftTimes(entry ?? {}, weeklyShift);
  if (!shiftStart || !shiftEnd) return "-";
  return `${formatShiftTimeLabel(shiftStart)} - ${formatShiftTimeLabel(shiftEnd)}`;
}

function getTodayStatus(entry, nowMs) {
  const hasClockIn = !!entry?.clock_in_at;
  const hasClockOut = !!entry?.clock_out_at;
  const hasOvertimeStart = !!entry?.overtime_start;
  const hasOvertimeEnd = !!entry?.overtime_end;
  const breakState = getPersonalBreakState(entry, nowMs);

  if (hasOvertimeStart && hasOvertimeEnd) {
    return {
      label: "Completed with Overtime",
      toneClass: "bg-green-50 text-green-700",
    };
  }
  if (hasOvertimeStart && !hasOvertimeEnd) {
    return { label: "Overtime", toneClass: "bg-orange-50 text-orange-700" };
  }
  if (breakState.isRunning) {
    return { label: "Personal Break", toneClass: "bg-orange-50 text-orange-700" };
  }
  if (hasClockOut) {
    return { label: "Shift Completed", toneClass: "bg-green-50 text-green-700" };
  }
  if (hasClockIn) {
    return { label: "Working", toneClass: "bg-emerald-50 text-emerald-700" };
  }
  return { label: "Not started", toneClass: "bg-gray-100 text-gray-600" };
}

function BreakActivity({ entry }) {
  const history = getPersonalBreakHistory(entry).slice(-3).reverse();

  if (history.length === 0) {
    return <span className="text-gray-400">No break activity</span>;
  }

  return (
    <div className="space-y-1">
      {history.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-gray-700">{item.label}</span>
          <span className="text-xs font-medium text-gray-500">
            {formatTime(item.at)}
          </span>
        </div>
      ))}
    </div>
  );
}

function getLatestBreakEvent(entry) {
  const history = getPersonalBreakHistory(entry);
  return history.length > 0 ? history[history.length - 1] : null;
}

function formatEmployeeName(employee) {
  const label =
    `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim() ||
    employee?.email ||
    "Employee";
  return label;
}

function BreakActivityModal({ isOpen, onClose, row }) {
  if (!isOpen || !row) return null;

  const label = formatEmployeeName(row.employee);
  const history = getPersonalBreakHistory(row.entry).slice().reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative flex h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl sm:h-[calc(100vh-3rem)]">
        <div className="border-b border-gray-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-orange-500">
                Today&apos;s Break Activity
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                {label}
              </h3>
              <p className="mt-1 text-sm font-medium text-gray-500">
                {row.employee.email}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                Date
              </p>
              <p className="mt-2 text-base font-black text-gray-800">
                {row.entry?.shift_date || "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                Break Summary
              </p>
              <p className="mt-2 text-base font-black text-gray-800">
                {formatPersonalBreakLogValue(row.entry)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
              Activity Timeline
            </p>
            {history.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm font-medium text-gray-500">
                No break activity recorded for today.
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-orange-700 shadow-sm">
                        {item.label}
                      </span>
                      <span className="text-xs font-bold text-gray-500">
                        {formatTime(item.at)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-gray-600">
                      {item.remainingSeconds > 0
                        ? `${Math.floor(item.remainingSeconds / 60)} min left`
                        : "No time left"}
                    </p>
                    {item.note && (
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-gray-400">
                        {item.note.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewTab({ currentTime, onOpenEmployeeLogs }) {
  const [employees, setEmployees] = useState([]);
  const [todayEntries, setTodayEntries] = useState([]);
  const [todayWeeklyShifts, setTodayWeeklyShifts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [breakActivityTarget, setBreakActivityTarget] = useState(null);
  const [isBreakActivityVisible, setIsBreakActivityVisible] = useState(true);

  const todayShiftDate = useMemo(
    () => currentTime.toLocaleDateString("en-CA"),
    [currentTime],
  );

  const loadEmployees = useCallback(async () => {
    const res = await listUserProfiles();
    if (!res.success) {
      toast.error(res.error || "Failed to load employees.");
      return;
    }
    setEmployees((res.data ?? []).filter((row) => row?.role === "Employee"));
  }, []);

  const loadTodayEntries = useCallback(async () => {
    const autoEndRes = await autoEndExpiredBreaksByShiftDate({
      shift_date: todayShiftDate,
    });
    if (!autoEndRes.success) {
      console.debug("[OverviewTab] failed to auto-end expired breaks", {
        shiftDate: todayShiftDate,
        error: autoEndRes.error,
      });
    }

    const res = await listTimeEntriesByShiftDate({ shift_date: todayShiftDate });
    if (!res.success) {
      toast.error(res.error || "Failed to load today's monitoring data.");
      return;
    }
    setTodayEntries(res.data ?? []);
  }, [todayShiftDate]);

  const loadTodayWeeklyShifts = useCallback(async () => {
    const res = await supabase
      .from("employee_weekly_shifts")
      .select(
        "employee_auth_id, week_start, week_end, shift_start_time, shift_end_time",
      )
      .lte("week_start", todayShiftDate)
      .gte("week_end", todayShiftDate);

    if (res.error) {
      toast.error("Failed to load today's shift assignments.");
      return;
    }

    setTodayWeeklyShifts(res.data ?? []);
  }, [todayShiftDate]);

  const refreshOverview = useCallback(
    async ({ silent = false } = {}) => {
      setIsRefreshing(true);
      try {
        await Promise.all([loadEmployees(), loadTodayEntries(), loadTodayWeeklyShifts()]);
        if (!silent) {
          toast.success("Overview refreshed.");
        }
      } catch {
        if (!silent) {
          toast.error("Failed to refresh overview.");
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [loadEmployees, loadTodayEntries, loadTodayWeeklyShifts],
  );

  useEffect(() => {
    refreshOverview({ silent: true });
  }, [refreshOverview]);

  useEffect(() => {
    const autoRefreshId = window.setInterval(() => {
      refreshOverview({ silent: true });
    }, 15000);

    return () => window.clearInterval(autoRefreshId);
  }, [refreshOverview]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-overview-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_entries" },
        () => refreshOverview({ silent: true }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_profiles" },
        () => refreshOverview({ silent: true }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshOverview]);

  const rows = useMemo(() => {
    const nowMs = currentTime.getTime();
    const entryByAuthId = new Map(todayEntries.map((entry) => [entry.auth_id, entry]));
    const shiftByAuthId = new Map(
      todayWeeklyShifts.map((shift) => [shift.employee_auth_id, shift]),
    );

    return employees
      .map((employee) => {
        const entry = entryByAuthId.get(employee.auth_id) ?? null;
        const weeklyShift = shiftByAuthId.get(employee.auth_id) ?? null;
        const breakState = getPersonalBreakState(entry, nowMs);
        const status = getTodayStatus(entry, nowMs);
        return {
          employee,
          entry,
          weeklyShift,
          breakState,
          status,
        };
      })
      .sort((a, b) => {
        const left =
          `${a.employee.first_name ?? ""} ${a.employee.last_name ?? ""}`.trim() ||
          a.employee.email ||
          "";
        const right =
          `${b.employee.first_name ?? ""} ${b.employee.last_name ?? ""}`.trim() ||
          b.employee.email ||
          "";
        return left.localeCompare(right);
      });
  }, [currentTime, employees, todayEntries, todayWeeklyShifts]);

  const summary = useMemo(() => {
    const clockedIn = rows.filter((row) => !!row.entry?.clock_in_at).length;
    const activeBreaks = rows.filter((row) => row.breakState.isRunning).length;
    const completed = rows.filter((row) => !!row.entry?.clock_out_at).length;

    return {
      scheduled: rows.length,
      clockedIn,
      activeBreaks,
      completed,
    };
  }, [rows]);

  const activeBreakRows = useMemo(
    () => rows.filter((row) => row.breakState.isRunning),
    [rows],
  );

  const breakActivityRows = useMemo(
    () =>
      rows
        .map((row) => ({
          ...row,
          latestBreakEvent: getLatestBreakEvent(row.entry),
        }))
        .filter((row) => row.latestBreakEvent)
        .sort(
          (a, b) =>
            new Date(b.latestBreakEvent.at).getTime() -
            new Date(a.latestBreakEvent.at).getTime(),
        ),
    [rows],
  );

  const openBreakActivityView = useCallback((row) => {
    setBreakActivityTarget(row);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-800">
            Today&apos;s Overview
          </h2>
          <p className="text-sm font-medium text-gray-500">
            Live monitoring for {currentTime.toLocaleDateString([], {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
            <Clock size={18} className="text-orange-500" />
            <span className="text-lg font-bold tabular-nums text-gray-800">
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => refreshOverview({ silent: false })}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
              Scheduled Today
            </p>
            <UserCheck size={18} className="text-orange-500" />
          </div>
          <p className="mt-3 text-3xl font-black text-gray-800">{summary.scheduled}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
              Clocked In
            </p>
            <PlayCircle size={18} className="text-emerald-500" />
          </div>
          <p className="mt-3 text-3xl font-black text-gray-800">{summary.clockedIn}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
              On Personal Break
            </p>
            <Coffee size={18} className="text-orange-500" />
          </div>
          <p className="mt-3 text-3xl font-black text-gray-800">{summary.activeBreaks}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
              Completed
            </p>
            <CheckCircle2 size={18} className="text-green-500" />
          </div>
          <p className="mt-3 text-3xl font-black text-gray-800">{summary.completed}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-800">Active Personal Breaks</h3>
            <p className="text-sm font-medium text-gray-500">
              Employees currently on break with their live countdown and latest activity.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeBreakRows.map((row) => {
            const label = formatEmployeeName(row.employee);

            return (
              <div
                key={row.employee.auth_id}
                className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-gray-800">{label}</p>
                    <p className="text-xs font-medium text-gray-500">{row.employee.email}</p>
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-black text-orange-600 shadow-sm">
                    {formatCountdown(row.breakState.remainingSeconds)}
                  </span>
                </div>
                <div className="mt-4 rounded-xl bg-white px-3 py-3">
                  <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                    Break Activity
                  </p>
                  <div className="mt-2">
                    <BreakActivity entry={row.entry} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openBreakActivityView(row)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-bold text-orange-600 transition-all hover:bg-orange-100"
                >
                  <BookOpenText size={16} />
                  View Break Activity
                </button>
              </div>
            );
          })}

          {activeBreakRows.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
              <Activity size={20} className="mx-auto text-gray-300" />
              <p className="mt-3 text-sm font-bold text-gray-600">
                No employees are on personal break right now.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-800">Break Activity</h3>
              <p className="text-sm font-medium text-gray-500">
                Separate personal-break activity feed for today.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBreakActivityVisible((current) => !current)}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
            >
              {isBreakActivityVisible ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {isBreakActivityVisible && (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {breakActivityRows.map((row) => {
              const label = formatEmployeeName(row.employee);
              return (
                <div
                  key={row.employee.auth_id}
                  className="rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-orange-50/40 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-gray-800">{label}</p>
                      <p className="text-xs font-medium text-gray-500">{row.employee.email}</p>
                    </div>
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-black text-orange-700">
                      {row.entry?.shift_date || "-"}
                    </span>
                  </div>
                  <div className="mt-4 rounded-xl border border-orange-100 bg-white px-3 py-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                      Latest Activity
                    </p>
                    <p className="mt-2 text-sm font-black text-gray-800">
                      {row.latestBreakEvent.label}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      {formatTime(row.latestBreakEvent.at)}
                    </p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-orange-600">
                      {formatPersonalBreakLogValue(row.entry, currentTime)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openBreakActivityView(row)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                  >
                    <BookOpenText size={16} />
                    View Break Activity
                  </button>
                </div>
              );
            })}

            {breakActivityRows.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm font-medium text-gray-400">
                No break activity recorded for today.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-black text-gray-800">Today&apos;s Shift Board</h3>
          <p className="text-sm font-medium text-gray-500">
            A clear view of each employee&apos;s shift progress for today only.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-gray-50/60 text-left text-[10px] uppercase tracking-widest text-gray-400">
                <th className="px-5 py-3 font-bold">Employee</th>
                <th className="px-5 py-3 font-bold">Scheduled Shift</th>
                <th className="px-5 py-3 font-bold">Clock In</th>
                <th className="px-5 py-3 font-bold">Break Summary</th>
                <th className="px-5 py-3 font-bold">Clock Out</th>
                <th className="px-5 py-3 font-bold">Overtime</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold text-right">Logs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => {
                const label =
                  `${row.employee.first_name ?? ""} ${row.employee.last_name ?? ""}`.trim() ||
                  row.employee.email;

                return (
                  <tr key={row.employee.auth_id} className="align-top text-sm">
                    <td className="px-5 py-4">
                      <p className="font-black text-gray-800">{label}</p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {row.employee.email}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {getScheduledShiftDisplay(row.entry, row.weeklyShift)}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {formatTime(row.entry?.clock_in_at)}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <p>{formatPersonalBreakLogValue(row.entry, currentTime)}</p>
                      {row.breakState.isRunning && (
                        <p className="mt-1 text-xs font-black text-orange-600">
                          {formatCountdown(row.breakState.remainingSeconds)} left
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {formatTime(row.entry?.clock_out_at)}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {row.entry?.overtime_start || row.entry?.overtime_end
                        ? `${formatTime(row.entry?.overtime_start)} - ${formatTime(row.entry?.overtime_end)}`
                        : "-"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold ${row.status.toneClass}`}
                      >
                        {row.status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenEmployeeLogs?.(row.employee.auth_id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                      >
                        <BookOpenText size={16} />
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10 text-center text-sm font-medium text-gray-400"
                  >
                    No employees available for today&apos;s overview.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BreakActivityModal
        isOpen={!!breakActivityTarget}
        onClose={() => setBreakActivityTarget(null)}
        row={breakActivityTarget}
      />
    </div>
  );
}
