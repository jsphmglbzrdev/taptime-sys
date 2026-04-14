import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Coffee,
  RefreshCw,
  Sunset,
  SunMedium,
  UserCheck,
  UserRoundX,
} from "lucide-react";
import {
  listTimeEntriesByAuthId,
  listTimeEntriesByShiftDate,
  listUserProfiles,
} from "../../../utils/admin";
import { useLoading } from "../../../context/LoadingContext";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import EmployeeLogsModal from "../../../components/admin/EmployeesLogModal";
import { isLate, isUnderTime } from "../../../utils/shiftSchedule";
import { supabase } from "../../../utils/supabase";

function OverviewTab({ currentTime }) {
  const AUTO_REFRESH_SECONDS = 15;
  const MORNING_BREAK_MIN = 15;
  const AFTERNOON_BREAK_MIN = 15;
  const LUNCH_BREAK_MIN = 60;

  const { setLoading } = useLoading();
  const [employees, setEmployees] = useState([]);
  const [avatarSrcByAuthId, setAvatarSrcByAuthId] = useState({});
  const [todayEntries, setTodayEntries] = useState([]);
  const [activeLiveTab, setActiveLiveTab] = useState("all");
  const [activeStatusTab, setActiveStatusTab] = useState("on-duty");
  const [selected, setSelected] = useState(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const todayShiftDate = useMemo(
    () => currentTime.toLocaleDateString("en-CA"),
    [currentTime],
  );

  const resolveAvatarSrc = useCallback(async (avatarRef) => {
    const ref = String(avatarRef ?? "").trim();
    if (!ref) return "";
    if (/^https?:\/\//i.test(ref)) return ref;

    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(ref, 60 * 60);
    if (error) throw error;
    return data?.signedUrl ?? "";
  }, []);

  const loadEmployees = useCallback(async ({ showSpinner = false } = {}) => {
    if (showSpinner) {
      setLoading(true);
    }
    try {
      const res = await listUserProfiles();
      if (!res.success) {
        toast.error(res.error || "Failed to load employees");
        return;
      }
      setEmployees((res.data ?? []).filter((u) => u?.role === "Employee"));
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [setLoading]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const loadTodayEntries = useCallback(async () => {
    try {
      const res = await listTimeEntriesByShiftDate({ shift_date: todayShiftDate });
      if (!res.success) {
        toast.error(res.error || "Failed to load live monitoring data");
        return;
      }
      setTodayEntries(res.data ?? []);
    } catch {
      toast.error("Failed to load live monitoring data");
    }
  }, [todayShiftDate]);

  useEffect(() => {
    loadTodayEntries();
  }, [loadTodayEntries]);

  const refreshOverview = useCallback(async ({ silent = false, source = "manual" } = {}) => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadEmployees(), loadTodayEntries()]);
      console.debug("[OverviewTab] refresh completed", {
        source,
        refreshedAt: new Date().toISOString(),
      });
      if (!silent) {
        toast.success("Monitoring dashboard refreshed.");
      }
    } catch {
      console.debug("[OverviewTab] refresh failed", {
        source,
        attemptedAt: new Date().toISOString(),
      });
      if (!silent) {
        toast.error("Failed to refresh monitoring dashboard.");
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [loadEmployees, loadTodayEntries]);

  useEffect(() => {
    const autoRefreshId = window.setInterval(() => {
      refreshOverview({ silent: true, source: "auto-poll" });
    }, AUTO_REFRESH_SECONDS * 1000);

    return () => {
      window.clearInterval(autoRefreshId);
    };
  }, [AUTO_REFRESH_SECONDS, refreshOverview]);

  useEffect(() => {
    const overviewChannel = supabase
      .channel("admin-overview-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_entries",
        },
        () => {
          loadTodayEntries();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_profiles",
        },
        () => {
          loadEmployees();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(overviewChannel);
    };
  }, [loadEmployees, loadTodayEntries]);

  useEffect(() => {
    let cancelled = false;

    const loadAvatarSources = async () => {
      const nextAvatarMap = {};

      await Promise.all(
        employees.map(async (emp) => {
          try {
            const url = await resolveAvatarSrc(emp?.avatar_url);
            if (url) {
              nextAvatarMap[emp.auth_id] = url;
            }
          } catch {
            nextAvatarMap[emp.auth_id] = "";
          }
        }),
      );

      if (!cancelled) {
        setAvatarSrcByAuthId(nextAvatarMap);
      }
    };

    loadAvatarSources();

    return () => {
      cancelled = true;
    };
  }, [employees, resolveAvatarSrc]);

  const openEmployeeLogs = useCallback(
    async (emp) => {
      setSelected(emp);
      setIsLogsOpen(true);
      setLoading(true);
      try {
        const res = await listTimeEntriesByAuthId({ auth_id: emp.auth_id });
        if (!res.success) {
          toast.error(res.error || "Failed to load logs");
          setLogs([]);
          return;
        }
        setLogs(res.data ?? []);
      } finally {
        setLoading(false);
      }
    },
    [setLoading],
  );

  const exportSelectedExcel = useCallback(async () => {
    if (!selected) return;
    setIsExporting(true);
    try {
      let weeklyShiftData = null;
      if (logs.length > 0) {
        const shiftDate = logs[0]?.shift_date;
        const res = await supabase
          .from("employee_weekly_shifts")
          .select("shift_start_time, shift_end_time")
          .eq("employee_auth_id", selected.auth_id)
          .lte("week_start", shiftDate)
          .gte("week_end", shiftDate)
          .maybeSingle();

        if (res.data) {
          weeklyShiftData = res.data;
        }
      }

      const data = (logs ?? []).map((r) => {
        const hasClockIn = !!r.clock_in_at;
        const hasClockOut = !!r.clock_out_at;
        const hasMorningIn = !!r.morning_break_in_at;
        const hasMorningOut = !!r.morning_break_out_at;
        const hasAfternoonIn = !!r.afternoon_break_in_at;
        const hasAfternoonOut = !!r.afternoon_break_out_at;
        const hasLunchIn = !!r.lunch_break_in_at;
        const hasLunchOut = !!r.lunch_break_out_at;

        const statusLabel = hasClockOut
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

        const considerLate = clockInTime
          ? isLate(clockInTime, weeklyShiftData?.shift_start_time, 5)
          : false;
        const considerUnderTime =
          !!clockOutTime &&
          !!weeklyShiftData?.shift_end_time &&
          isUnderTime(clockOutTime, weeklyShiftData.shift_end_time);

        const clockInDisplay = clockInTime
          ? `${clockInTime}${considerLate ? " - Late" : ""}`
          : "";
        const clockOutDisplay = clockOutTime
          ? `${clockOutTime}${considerUnderTime ? " - Undertime" : ""}`
          : "";

        return {
          Date: r.shift_date,
          "Scheduled Time Shift": r.scheduled_shift || "-",
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
      XLSX.utils.book_append_sheet(wb, ws, "Employee Logs");

      const safeName =
        `${selected.first_name ?? ""} ${selected.last_name ?? ""}`
          .trim()
          .replace(/\s+/g, "-") || (selected.email ?? "employee");
      XLSX.writeFile(
        wb,
        `employee-logs-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } catch {
      toast.error("Failed to export Excel.");
    } finally {
      setIsExporting(false);
    }
  }, [logs, selected]);

  const employeeCards = useMemo(() => {
    return employees.map((emp) => {
      const name =
        `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || emp.email;
      const avatarSrc = avatarSrcByAuthId[emp.auth_id] ?? "";
      const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase();

      return (
        <button
          key={emp.auth_id}
          type="button"
          onClick={() => openEmployeeLogs(emp)}
          className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm transition-all hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={`${name} profile`}
                  className="h-16 w-16 shrink-0 rounded-full border-2 border-orange-100 object-cover object-center"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-orange-100 bg-orange-50 text-xl font-black text-orange-500">
                  {initials || "?"}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-gray-800">{name}</p>
                <p className="truncate text-xs font-bold text-gray-400">{emp.email}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-lg bg-green-50 px-2 py-1 text-[10px] font-black text-green-600">
              {String(emp.role ?? "Employee").toUpperCase()}
            </span>
          </div>
          <div className="mt-4 text-[10px] font-black uppercase tracking-widest text-orange-500">
            View time logs
          </div>
        </button>
      );
    });
  }, [avatarSrcByAuthId, employees, openEmployeeLogs]);

  const liveStatuses = useMemo(() => {
    const nowMs = currentTime.getTime();
    const entryByAuthId = new Map(todayEntries.map((entry) => [entry.auth_id, entry]));

    return employees.map((emp) => {
      const name =
        `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || emp.email;
      const avatarSrc = avatarSrcByAuthId[emp.auth_id] ?? "";
      const entry = entryByAuthId.get(emp.auth_id) ?? null;
      const hasClockIn = !!entry?.clock_in_at;
      const hasClockOut = !!entry?.clock_out_at;
      const hasMorningIn = !!entry?.morning_break_in_at;
      const hasMorningOut = !!entry?.morning_break_out_at;
      const hasAfternoonIn = !!entry?.afternoon_break_in_at;
      const hasAfternoonOut = !!entry?.afternoon_break_out_at;
      const hasLunchIn = !!entry?.lunch_break_in_at;
      const hasLunchOut = !!entry?.lunch_break_out_at;
      const hasAnyBreakRecord =
        hasMorningIn ||
        hasMorningOut ||
        hasLunchIn ||
        hasLunchOut ||
        hasAfternoonIn ||
        hasAfternoonOut;

      const getRemainingSeconds = (startAt, durationMin) => {
        if (!startAt) return null;
        const startMs = new Date(startAt).getTime();
        const endMs = startMs + durationMin * 60 * 1000;
        return Math.max(0, Math.ceil((endMs - nowMs) / 1000));
      };

      const getResolvedActiveStatus = () => {
        if (hasClockOut) {
          return {
            statusKey: "completed",
            statusLabel: "Shift Completed",
            toneClass: "bg-green-50 text-green-700",
            countdownSeconds: null,
          };
        }

        if (hasClockIn) {
          return {
            statusKey: "working",
            statusLabel: "Working",
            toneClass: "bg-emerald-50 text-emerald-700",
            countdownSeconds: null,
          };
        }

        return {
          statusKey: "idle",
          statusLabel: "Not started",
          toneClass: "bg-gray-100 text-gray-600",
          countdownSeconds: null,
        };
      };

      let statusKey = "idle";
      let statusLabel = "Not started";
      let toneClass = "bg-gray-100 text-gray-600";
      let countdownSeconds = null;

      if (hasMorningIn && !hasMorningOut) {
        countdownSeconds = getRemainingSeconds(entry?.morning_break_in_at, MORNING_BREAK_MIN);
        if (countdownSeconds <= 0) {
          ({ statusKey, statusLabel, toneClass, countdownSeconds } =
            getResolvedActiveStatus());
        } else {
          statusKey = "morning";
          statusLabel = "Morning Break";
          toneClass = "bg-amber-50 text-amber-700";
        }
      } else if (hasLunchIn && !hasLunchOut) {
        countdownSeconds = getRemainingSeconds(entry?.lunch_break_in_at, LUNCH_BREAK_MIN);
        if (countdownSeconds <= 0) {
          ({ statusKey, statusLabel, toneClass, countdownSeconds } =
            getResolvedActiveStatus());
        } else {
          statusKey = "lunch";
          statusLabel = "Lunch Break";
          toneClass = "bg-orange-50 text-orange-700";
        }
      } else if (hasAfternoonIn && !hasAfternoonOut) {
        countdownSeconds = getRemainingSeconds(
          entry?.afternoon_break_in_at,
          AFTERNOON_BREAK_MIN,
        );
        if (countdownSeconds <= 0) {
          ({ statusKey, statusLabel, toneClass, countdownSeconds } =
            getResolvedActiveStatus());
        } else {
          statusKey = "afternoon";
          statusLabel = "Afternoon Break";
          toneClass = "bg-yellow-50 text-yellow-700";
        }
      } else if (hasClockOut) {
        statusKey = "completed";
        statusLabel = "Shift Completed";
        toneClass = "bg-green-50 text-green-700";
      } else if (hasClockIn) {
        statusKey = "working";
        statusLabel = "Working";
        toneClass = "bg-emerald-50 text-emerald-700";
      }

      return {
        auth_id: emp.auth_id,
        avatarSrc,
        email: emp.email,
        entry,
        hasAnyBreakRecord,
        name,
        statusKey,
        statusLabel,
        toneClass,
        countdownSeconds,
      };
    });
  }, [
    AFTERNOON_BREAK_MIN,
    LUNCH_BREAK_MIN,
    MORNING_BREAK_MIN,
    avatarSrcByAuthId,
    currentTime,
    employees,
    todayEntries,
  ]);

  const formatCountdown = useCallback((totalSeconds) => {
    if (totalSeconds === null || totalSeconds === undefined) return "--:--";
    const safe = Math.max(0, totalSeconds);
    const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
    const seconds = String(safe % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, []);

  const liveTabs = useMemo(
    () => [
      {
        id: "all",
        label: "All Breaks",
        icon: Coffee,
        count: liveStatuses.filter((item) =>
          ["morning", "lunch", "afternoon"].includes(item.statusKey),
        ).length,
      },
      {
        id: "morning",
        label: "Morning",
        icon: SunMedium,
        count: liveStatuses.filter((item) => item.statusKey === "morning").length,
      },
      {
        id: "lunch",
        label: "Lunch",
        icon: Coffee,
        count: liveStatuses.filter((item) => item.statusKey === "lunch").length,
      },
      {
        id: "afternoon",
        label: "Afternoon",
        icon: Sunset,
        count: liveStatuses.filter((item) => item.statusKey === "afternoon").length,
      },
    ],
    [liveStatuses],
  );

  const liveBreakEmployees = useMemo(() => {
    if (activeLiveTab === "all") {
      return liveStatuses.filter((item) =>
        ["morning", "lunch", "afternoon"].includes(item.statusKey),
      );
    }

    return liveStatuses.filter((item) => item.statusKey === activeLiveTab);
  }, [activeLiveTab, liveStatuses]);

  const statusTabs = useMemo(
    () => [
      {
        id: "on-duty",
        label: "On Duty",
        icon: UserCheck,
        count: liveStatuses.filter((item) => item.statusKey === "working").length,
      },
      {
        id: "completed",
        label: "Completed",
        icon: CheckCircle2,
        count: liveStatuses.filter((item) => item.statusKey === "completed").length,
      },
      {
        id: "not-break",
        label: "Not Yet on Break",
        icon: UserRoundX,
        count: liveStatuses.filter(
          (item) => item.statusKey === "working" && !item.hasAnyBreakRecord,
        ).length,
      },
    ],
    [liveStatuses],
  );

  const statusEmployees = useMemo(() => {
    if (activeStatusTab === "completed") {
      return liveStatuses.filter((item) => item.statusKey === "completed");
    }

    if (activeStatusTab === "not-break") {
      return liveStatuses.filter(
        (item) => item.statusKey === "working" && !item.hasAnyBreakRecord,
      );
    }

    return liveStatuses.filter((item) => item.statusKey === "working");
  }, [activeStatusTab, liveStatuses]);

  const renderStatusCard = useCallback(
    (emp, keyPrefix) => (
      <button
        key={`${keyPrefix}-${emp.auth_id}`}
        type="button"
        onClick={() =>
          openEmployeeLogs(employees.find((item) => item.auth_id === emp.auth_id) ?? emp)
        }
        className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 text-left transition-all hover:bg-white hover:shadow-sm"
      >
        {emp.avatarSrc ? (
          <img
            src={emp.avatarSrc}
            alt={`${emp.name} profile`}
            className="h-14 w-14 shrink-0 rounded-full border-2 border-orange-100 object-cover object-center"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-orange-100 bg-orange-50 font-black text-xl text-orange-500">
            {emp.name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-base font-black text-gray-800">{emp.name}</p>
            <div className="shrink-0">
              <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${emp.toneClass}`}>
                {emp.statusLabel}
              </span>
              {emp.countdownSeconds !== null && emp.countdownSeconds > 0 && (
                <p className="mt-1 text-right text-xs font-black tabular-nums text-orange-600">
                  {formatCountdown(emp.countdownSeconds)}
                </p>
              )}
            </div>
          </div>
          <p className="truncate text-xs font-medium text-gray-500">{emp.email}</p>
        </div>
      </button>
    ),
    [employees, formatCountdown, openEmployeeLogs],
  );

  return (
    <>
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-800">
            Monitoring Dashboard
          </h2>
          <p className="text-sm font-medium text-gray-500">
            Real-time status for{" "}
            {currentTime.toLocaleDateString([], {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <button
            type="button"
            onClick={() => refreshOverview({ source: "manual" })}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
            <Clock size={18} className="text-orange-500" />
            <span className="text-lg font-bold tabular-nums">
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-800">Live Break Monitoring</h3>
            <p className="text-sm font-medium text-gray-500">
              Employees currently taking a break as of{" "}
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {liveTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeLiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveLiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                    isActive
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      isActive ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {liveBreakEmployees.map((emp) => renderStatusCard(emp, "live"))}

          {liveBreakEmployees.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
              <Activity size={20} className="mx-auto text-gray-300" />
              <p className="mt-3 text-sm font-bold text-gray-600">
                No employees are currently in this break status.
              </p>
              <p className="mt-1 text-xs font-medium text-gray-400">
                This panel refreshes automatically every 15 seconds.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-800">Duty Status</h3>
            <p className="text-sm font-medium text-gray-500">
              Employees grouped by active shift progress
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeStatusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveStatusTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                    isActive
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      isActive ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statusEmployees.map((emp) => renderStatusCard(emp, activeStatusTab))}

          {statusEmployees.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center">
              <Activity size={20} className="mx-auto text-gray-300" />
              <p className="mt-3 text-sm font-bold text-gray-600">
                No employees match this duty status.
              </p>
              <p className="mt-1 text-xs font-medium text-gray-400">
                The list refreshes automatically every 15 seconds.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-gray-800">Employees</h3>
            <p className="text-sm font-medium text-gray-500">
              Click an employee card to view full time logs
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {employeeCards}
          {employees.length === 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
              No employees found.
            </div>
          )}
        </div>
      </div>

      <EmployeeLogsModal
        isOpen={isLogsOpen}
        onClose={() => {
          setIsLogsOpen(false);
          setSelected(null);
          setLogs([]);
        }}
        employee={selected}
        rows={logs}
        onExport={exportSelectedExcel}
        isExporting={isExporting}
      />
    </>
  );
}

export default OverviewTab;
