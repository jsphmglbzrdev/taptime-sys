import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Clock, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import Sidebar from "../../components/user/Sidebar";
import Header from "../../components/user/Header";
import { useAuth } from "../../context/AuthContext";
import { useLoading } from "../../context/LoadingContext";
import { supabase } from "../../utils/supabase";
import { toast } from "react-toastify";
import ConfirmationBox from "../../components/ConfirmationBox";
import MyLogsTab from "./tabs/MyLogsTab";
import {
  isLate,
	isUnderTime,
  evaluateClockIn,
  formatShiftTimeLabel,
  getClockInWindow,
  parseTimeToMinutes,
} from "../../utils/shiftSchedule";

export default function UserDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());

  const { user } = useAuth();
  const { setLoading } = useLoading();
  const [history, setHistory] = useState([]);
  const [todayEntry, setTodayEntry] = useState(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState(null);
  const [weeklyShift, setWeeklyShift] = useState(null);
  const [isOvertimeActive, setIsOvertimeActive] = useState(false);
  const autoEndedRef = useRef({
    morning: false,
    afternoon: false,
    lunch: false,
  });
  const lastAutoResetKeyRef = useRef(null);

  // Real-time clock effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getShiftDate = useCallback((d) => d.toLocaleDateString("en-CA"), []);

  const formatTime = useCallback((value) => {
    if (!value) return "-";
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const fetchAttendance = useCallback(async () => {
    if (!user) return;

    const shiftDate = getShiftDate(new Date());

    const [recentRes, todayRes] = await Promise.all([
      supabase
        .from("time_entries")
        .select("*")
        .eq("auth_id", user.id)
        .order("shift_date", { ascending: false })
        .limit(14),
      supabase
        .from("time_entries")
        .select("*")
        .eq("auth_id", user.id)
        .eq("shift_date", shiftDate)
        .maybeSingle(),
    ]);

    if (recentRes.error) throw recentRes.error;
    if (todayRes.error) throw todayRes.error;

    setHistory(recentRes.data ?? []);
    setTodayEntry(todayRes.data ?? null);
  }, [getShiftDate, user]);

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
    Promise.all([fetchAttendance(), fetchWeeklyShift()]).catch(() => {
      toast.error("Failed to load dashboard data.");
    });
  }, [user, fetchAttendance, fetchWeeklyShift]);

  const todayShiftDate = useMemo(
    () => getShiftDate(new Date()),
    [getShiftDate, currentTime],
  );

  const clockInWindow = useMemo(() => {
    if (!weeklyShift?.shift_start_time || !weeklyShift?.shift_end_time)
      return null;
    return getClockInWindow(
      todayShiftDate,
      weeklyShift.shift_start_time,
      weeklyShift.shift_end_time,
    );
  }, [todayShiftDate, weeklyShift]);

  const clockInEval = useMemo(
    () => evaluateClockIn(currentTime.getTime(), clockInWindow),
    [clockInWindow, currentTime],
  );

  const MORNING_BREAK_MIN = 15;
  const AFTERNOON_BREAK_MIN = 15;
  const LUNCH_BREAK_MIN = 60;

  const isShiftActive = !!todayEntry?.clock_in_at && !todayEntry?.clock_out_at;

  const isShiftCompleted = !!todayEntry?.clock_out_at;

  const canClockInNow = useMemo(() => {
    if (isShiftActive) return true;
    if (isShiftCompleted) return false;
    return clockInEval.allowed;
  }, [clockInEval.allowed, isShiftActive, isShiftCompleted]);

  const isMorningBreakActive =
    !!todayEntry?.morning_break_in_at && !todayEntry?.morning_break_out_at;
  const isAfternoonBreakActive =
    !!todayEntry?.afternoon_break_in_at && !todayEntry?.afternoon_break_out_at;
  const isLunchBreakActive =
    !!todayEntry?.lunch_break_in_at && !todayEntry?.lunch_break_out_at;

  const isAnyBreakActive =
    isMorningBreakActive || isAfternoonBreakActive || isLunchBreakActive;

  const hasMorningBreak = !!todayEntry?.morning_break_in_at;
  const hasAfternoonBreak = !!todayEntry?.afternoon_break_in_at;
  const hasLunchBreak = !!todayEntry?.lunch_break_in_at;

  const computedStatus = useMemo(() => {
    if (!todayEntry?.clock_in_at)
      return { label: "Not started", tone: "orange" };
    if (todayEntry?.clock_out_at) return { label: "Completed", tone: "green" };
    if (isMorningBreakActive) return { label: "Morning Break", tone: "orange" };
    if (isAfternoonBreakActive)
      return { label: "Afternoon Break", tone: "orange" };
    if (isLunchBreakActive) return { label: "Lunch Break", tone: "orange" };
    return { label: "Working", tone: "green" };
  }, [
    isAfternoonBreakActive,
    isLunchBreakActive,
    isMorningBreakActive,
    todayEntry,
  ]);

  const countdown = useMemo(() => {
    const nowMs = currentTime.getTime();

    const calcRemainingSec = (startAt, durationMin) => {
      if (!startAt) return null;
      const startMs = new Date(startAt).getTime();
      const endMs = startMs + durationMin * 60 * 1000;
      return Math.max(0, Math.floor((endMs - nowMs) / 1000));
    };

    const morningRemainingSec = isMorningBreakActive
      ? calcRemainingSec(todayEntry?.morning_break_in_at, MORNING_BREAK_MIN)
      : null;
    const afternoonRemainingSec = isAfternoonBreakActive
      ? calcRemainingSec(todayEntry?.afternoon_break_in_at, AFTERNOON_BREAK_MIN)
      : null;
    const lunchRemainingSec = isLunchBreakActive
      ? calcRemainingSec(todayEntry?.lunch_break_in_at, LUNCH_BREAK_MIN)
      : null;

    return { morningRemainingSec, afternoonRemainingSec, lunchRemainingSec };
  }, [
    AFTERNOON_BREAK_MIN,
    LUNCH_BREAK_MIN,
    MORNING_BREAK_MIN,
    currentTime,
    isAfternoonBreakActive,
    isLunchBreakActive,
    isMorningBreakActive,
    todayEntry?.afternoon_break_in_at,
    todayEntry?.lunch_break_in_at,
    todayEntry?.morning_break_in_at,
  ]);

  const formatMMSS = useCallback((totalSeconds) => {
    if (totalSeconds === null || totalSeconds === undefined) return "--:--";
    const safe = Math.max(0, totalSeconds);
    const mm = String(Math.floor(safe / 60)).padStart(2, "0");
    const ss = String(safe % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, []);

  const renderRemainingLines = useCallback(
    (remainingSec, totalLines, lineSeconds) => {
      const filledLines =
        remainingSec === null || remainingSec === undefined
          ? 0
          : Math.max(
              0,
              Math.min(totalLines, Math.ceil(remainingSec / lineSeconds)),
            );

      return (
        <div className="flex items-end gap-0.5">
          {Array.from({ length: totalLines }).map((_, idx) => {
            const filled = idx < filledLines;
            return (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                className={
                  filled
                    ? "w-1.5 rounded-sm bg-orange-500/90"
                    : "w-1.5 rounded-sm bg-orange-100/60"
                }
                style={{ height: filled ? 12 : 6 }}
              />
            );
          })}
        </div>
      );
    },
    [],
  );

  const updateTodayEntry = useCallback(
    async (patch) => {
      const shiftDate = getShiftDate(new Date());
      const { error } = await supabase
        .from("time_entries")
        .update(patch)
        .eq("auth_id", user.id)
        .eq("shift_date", shiftDate);
      if (error) throw error;
    },
    [getShiftDate, user],
  );

  const handleClockIn = useCallback(async () => {
    if (!user || isShiftActive) return;

    const shiftDate = getShiftDate(new Date());
    const win =
      weeklyShift?.shift_start_time && weeklyShift?.shift_end_time
        ? getClockInWindow(
            shiftDate,
            weeklyShift.shift_start_time,
            weeklyShift.shift_end_time,
          )
        : null;
    const ev = evaluateClockIn(Date.now(), win);
    if (!ev.allowed) {
      if (ev.reason === "too_early" && ev.window) {
        toast.error(
          `Clock-in opens at ${ev.window.earliestClockIn.toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
            },
          )}.`,
        );
      } else if (ev.reason === "past_shift_end") {
        toast.error("Clock-in window for today has ended.");
      } else {
        toast.error("You cannot clock in right now.");
      }
      return;
    }

    setIsActionPending(true);
    setLoading(true);

    const weeklyShiftTime = `${formatShiftTimeLabel(weeklyShift?.shift_start_time)} - ${formatShiftTimeLabel(weeklyShift?.shift_end_time)}`;

    try {
      const now = new Date().toISOString();

      const { error } = await supabase.from("time_entries").upsert(
        {
          auth_id: user.id,
          shift_date: shiftDate,
          scheduled_shift: weeklyShiftTime,
          clock_in_at: now,
          morning_break_in_at: null,
          morning_break_out_at: null,
          afternoon_break_in_at: null,
          afternoon_break_out_at: null,
          lunch_break_in_at: null,
          lunch_break_out_at: null,
          clock_out_at: null,
        },
        { onConflict: "auth_id,shift_date" },
      );
      if (error) throw error;

      await fetchAttendance();
      if (ev.late) {
        toast.warning("Clocked in after the 5-minute grace period (late).");
      } else {
        toast.success("Clocked in.");
      }
    } catch (err) {
      toast.error("Failed to clock in.");
    } finally {
      setLoading(false);
      setIsActionPending(false);
    }
  }, [
    fetchAttendance,
    getShiftDate,
    isShiftActive,
    setLoading,
    user,
    weeklyShift,
  ]);
  const handleClockOut = useCallback(async () => {
    if (!user || !isShiftActive) return;
    setIsActionPending(true);
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();

      await updateTodayEntry({
        clock_out_at: nowIso,
      });
      await fetchAttendance();
      setIsOvertimeActive(false);

      toast.success("Clocked out.");
    } catch (err) {
      toast.error("Failed to clock out.");
    } finally {
      setLoading(false);
      setIsActionPending(false);
    }
  }, [
    fetchAttendance,
    getShiftDate,
    isShiftActive,
    setLoading,
    updateTodayEntry,
    user,
    weeklyShift,
  ]);

  const startBreak = useCallback(
    async (breakType) => {
      if (!user) return;
      if (!isShiftActive) return;
      if (isAnyBreakActive) return;

      const now = new Date().toISOString();

      let patch = {};
      if (breakType === "morning") {
        if (hasMorningBreak) return;
        patch = { morning_break_in_at: now, morning_break_out_at: null };
      } else if (breakType === "afternoon") {
        if (hasAfternoonBreak) return;
        patch = { afternoon_break_in_at: now, afternoon_break_out_at: null };
      } else if (breakType === "lunch") {
        if (hasLunchBreak) return;
        patch = { lunch_break_in_at: now, lunch_break_out_at: null };
      } else {
        return;
      }

      setIsActionPending(true);
      setLoading(true);
      try {
        await updateTodayEntry(patch);
        await fetchAttendance();
        toast.success("Break started.");
      } catch (err) {
        toast.error("Failed to start break.");
      } finally {
        setLoading(false);
        setIsActionPending(false);
      }
    },
    [
      fetchAttendance,
      hasAfternoonBreak,
      hasLunchBreak,
      hasMorningBreak,
      isAnyBreakActive,
      isShiftActive,
      setLoading,
      updateTodayEntry,
      user,
    ],
  );

  const startOvertime = useCallback(async () => {
    if (!user || !isShiftCompleted) return;

    setIsActionPending(true);
    setLoading(true);
    try {
      const now = new Date().toISOString();
      await updateTodayEntry({
        overtime_start: now,
        overtime_end: null,
      });
      await fetchAttendance();
      setIsOvertimeActive(true);
      toast.success("Overtime started.");
    } catch (err) {
      toast.error("Failed to start overtime.");
    } finally {
      setLoading(false);
      setIsActionPending(false);
    }
  }, [fetchAttendance, isShiftCompleted, setLoading, updateTodayEntry, user]);

  const endOvertime = useCallback(async () => {
    if (!user || !isOvertimeActive) return;

    setIsActionPending(true);
    setLoading(true);
    try {
      const now = new Date().toISOString();
      await updateTodayEntry({
        overtime_end: now,
      });
      await fetchAttendance();
      setIsOvertimeActive(false);
      toast.success("Overtime ended.");
    } catch (err) {
      toast.error("Failed to end overtime.");
    } finally {
      setLoading(false);
      setIsActionPending(false);
    }
  }, [fetchAttendance, isOvertimeActive, setLoading, updateTodayEntry, user]);

  const endBreak = useCallback(
    async (breakType, { silent = false } = {}) => {
      if (!user) return;
      if (!isShiftActive) return;

      let isActive = false;
      let patch = {};
      if (breakType === "morning") {
        isActive = isMorningBreakActive;
        patch = { morning_break_out_at: new Date().toISOString() };
      } else if (breakType === "afternoon") {
        isActive = isAfternoonBreakActive;
        patch = { afternoon_break_out_at: new Date().toISOString() };
      } else if (breakType === "lunch") {
        isActive = isLunchBreakActive;
        patch = { lunch_break_out_at: new Date().toISOString() };
      }

      if (!isActive) return;

      setIsActionPending(true);
      setLoading(true);
      try {
        await updateTodayEntry(patch);
        await fetchAttendance();
        if (!silent) toast.success("Break ended.");
      } catch (err) {
        toast.error("Failed to end break.");
      } finally {
        setLoading(false);
        setIsActionPending(false);
      }
    },
    [
      fetchAttendance,
      isAfternoonBreakActive,
      isLunchBreakActive,
      isMorningBreakActive,
      isShiftActive,
      setLoading,
      updateTodayEntry,
      user,
    ],
  );

  // Reset auto-end tracking when the shift/day changes
  useEffect(() => {
    const key =
      todayEntry?.id ??
      `${todayEntry?.auth_id ?? ""}-${todayEntry?.shift_date ?? ""}`;
    if (!key) return;
    if (lastAutoResetKeyRef.current !== key) {
      autoEndedRef.current = { morning: false, afternoon: false, lunch: false };
      lastAutoResetKeyRef.current = key;
    }
  }, [todayEntry?.id, todayEntry?.shift_date, todayEntry?.auth_id]);

  // Automatically “Break Out” when the countdown hits 0
  useEffect(() => {
    if (isActionPending) return;

    if (
      isMorningBreakActive &&
      countdown.morningRemainingSec === 0 &&
      !autoEndedRef.current.morning
    ) {
      autoEndedRef.current.morning = true;
      endBreak("morning", { silent: true });
    }
    if (
      isAfternoonBreakActive &&
      countdown.afternoonRemainingSec === 0 &&
      !autoEndedRef.current.afternoon
    ) {
      autoEndedRef.current.afternoon = true;
      endBreak("afternoon", { silent: true });
    }
    if (
      isLunchBreakActive &&
      countdown.lunchRemainingSec === 0 &&
      !autoEndedRef.current.lunch
    ) {
      autoEndedRef.current.lunch = true;
      endBreak("lunch", { silent: true });
    }
  }, [
    countdown.afternoonRemainingSec,
    countdown.lunchRemainingSec,
    countdown.morningRemainingSec,
    endBreak,
    isActionPending,
    isAfternoonBreakActive,
    isLunchBreakActive,
    isMorningBreakActive,
  ]);

  const openConfirm = useCallback((type) => {
    setConfirmType(type);
    setIsConfirmOpen(true);
  }, []);

  const handleConfirmAction = useCallback(async () => {
    const type = confirmType;
    setIsConfirmOpen(false);
    setConfirmType(null);

    if (!type) return;

    if (type === "clock_in") return handleClockIn();
    if (type === "clock_out") return handleClockOut();
    if (type === "morning_break_start") return startBreak("morning");
    if (type === "morning_break_end") return endBreak("morning");
    if (type === "afternoon_break_start") return startBreak("afternoon");
    if (type === "afternoon_break_end") return endBreak("afternoon");
    if (type === "lunch_break_start") return startBreak("lunch");
    if (type === "lunch_break_end") return endBreak("lunch");
    if (type === "overtime_start") return startOvertime();
    if (type === "overtime_end") return endOvertime();
  }, [
    confirmType,
    endBreak,
    endOvertime,
    handleClockIn,
    handleClockOut,
    startBreak,
    startOvertime,
  ]);

  const confirmModalCopy = useMemo(() => {
    if (!confirmType)
      return {
        title: "Confirm Action",
        description: "Are you sure you want to continue?",
      };

    if (confirmType === "clock_in")
      return {
        title: "Clock In",
        description: "Confirm you want to clock in for today.",
      };
    if (confirmType === "clock_out")
      return {
        title: "Clock Out",
        description: "Confirm you want to clock out and finish your shift.",
      };

    if (confirmType === "morning_break_start")
      return {
        title: "Start Morning Break",
        description: "Confirm you want to start the 15-minute morning break.",
      };
    if (confirmType === "morning_break_end")
      return {
        title: "End Morning Break",
        description: "Confirm you want to end the morning break now.",
      };

    if (confirmType === "afternoon_break_start")
      return {
        title: "Start Afternoon Break",
        description: "Confirm you want to start the 15-minute afternoon break.",
      };
    if (confirmType === "afternoon_break_end")
      return {
        title: "End Afternoon Break",
        description: "Confirm you want to end the afternoon break now.",
      };

    if (confirmType === "lunch_break_start")
      return {
        title: "Start Lunch Break",
        description: "Confirm you want to start the 60-minute lunch break.",
      };
    if (confirmType === "lunch_break_end")
      return {
        title: "End Lunch Break",
        description: "Confirm you want to end the lunch break now.",
      };

    if (confirmType === "overtime_start")
      return {
        title: "Start Overtime",
        description: "Confirm you want to start overtime.",
      };
    if (confirmType === "overtime_end")
      return {
        title: "End Overtime",
        description: "Confirm you want to end overtime now.",
      };

    return {
      title: "Confirm Action",
      description: "Are you sure you want to continue?",
    };
  }, [confirmType]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarOpen={isSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      {/* 3. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header setIsSidebarOpen={setIsSidebarOpen} />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {activeTab === "My Logs" ? (
              <MyLogsTab />
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm space-y-2">
                  <p className="text-orange-500 font-bold text-xs uppercase tracking-widest">
                    Scheduled shift
                  </p>
                  {weeklyShift?.shift_start_time &&
                  weeklyShift?.shift_end_time ? (
                    <>
                      <p className="text-gray-800 font-black text-lg">
                        {formatShiftTimeLabel(weeklyShift.shift_start_time)} –{" "}
                        {formatShiftTimeLabel(weeklyShift.shift_end_time)}
                      </p>
                      <p className="text-gray-500 text-sm font-medium">
                        Week {weeklyShift.week_start} → {weeklyShift.week_end}{" "}
                        (Sat–Fri)
                      </p>
                      <p className="text-gray-400 text-xs font-medium">
                        Clock-in opens 1 hour before shift start. After shift
                        start you have 5 minutes grace; later counts as late.
                        Clock-in is allowed until your scheduled end time today.
                      </p>
                      {!isShiftActive && clockInWindow && (
                        <p className="text-xs font-bold text-gray-500 pt-1">
                          {!clockInEval.allowed &&
                          clockInEval.reason === "too_early"
                            ? `Opens at ${clockInWindow.earliestClockIn.toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}`
                            : !clockInEval.allowed &&
                                clockInEval.reason === "past_shift_end"
                              ? "Today’s clock-in window has closed."
                              : clockInEval.late
                                ? "You are past the grace period — clock-in will be marked late."
                                : "You are within the clock-in window."}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm font-medium">
                      No shift is assigned for this week. You can clock in
                      without schedule rules.
                    </p>
                  )}
                </div>

                {/* Clock-In Card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-center md:text-left">
                    <p className="text-orange-500 font-bold text-sm uppercase tracking-widest mb-1">
                      Time Attendance
                    </p>
                    <h2 className="text-4xl font-black text-gray-800 tabular-nums tracking-tight">
                      {currentTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </h2>
                    <p className="text-gray-400 font-medium mt-1">
                      {currentTime.toLocaleDateString([], {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${
                        computedStatus.tone === "green"
                          ? "bg-green-50 text-green-600"
                          : "bg-orange-50 text-orange-600"
                      }`}
                    >
                      {computedStatus.tone === "green" ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <AlertCircle size={12} />
                      )}
                      {computedStatus.label}
                    </span>

                    {isShiftCompleted && !isOvertimeActive ? (
                      <button
                        onClick={() => openConfirm("overtime_start")}
                        disabled={
                          isActionPending ||
                          isConfirmOpen ||
                          !user ||
                          !!todayEntry?.overtime_start
                        }
                        className="w-full md:w-auto px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg transform active:scale-95 flex items-center justify-center gap-3 bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        <Clock size={22} />
                        Start Overtime
                      </button>
                    ) : isShiftCompleted && isOvertimeActive ? (
                      <button
                        onClick={() => openConfirm("overtime_end")}
                        disabled={isActionPending || isConfirmOpen || !user}
                        className="w-full md:w-auto px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg transform active:scale-95 flex items-center justify-center gap-3 bg-orange-50 text-orange-600 border-2 border-orange-100 hover:bg-orange-100 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        <Clock size={22} />
                        End Overtime
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          openConfirm(isShiftActive ? "clock_out" : "clock_in")
                        }
                        disabled={
                          isActionPending ||
                          isConfirmOpen ||
                          !user ||
                          (isShiftActive && isAnyBreakActive) ||
                          (!isShiftActive && !canClockInNow)
                        }
                        className={`w-full md:w-auto px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg transform active:scale-95 flex items-center justify-center gap-3 ${
                          isShiftActive
                            ? "bg-red-50 text-red-600 border-2 border-red-100 hover:bg-red-100"
                            : "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200"
                        } disabled:opacity-70 disabled:cursor-not-allowed`}
                      >
                        <Clock size={22} />
                        {isShiftActive ? "Clock Out" : "Clock In"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Break Schedule / Countdown */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Morning break */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="text-orange-500 font-bold text-sm uppercase tracking-widest mb-1">
                            Morning Break
                          </p>
                          <p className="text-gray-500 text-xs font-medium">
                            {MORNING_BREAK_MIN} minutes
                          </p>
                        </div>
                        {hasMorningBreak && !isMorningBreakActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-green-50 text-green-600">
                            <CheckCircle2 size={12} />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-50 text-orange-600">
                            <AlertCircle size={12} />
                            {isMorningBreakActive ? "Running" : "Not started"}
                          </span>
                        )}
                      </div>

                      {isMorningBreakActive ? (
                        <>
                          <div className="text-center">
                            <div className="text-3xl font-black text-gray-800 tabular-nums">
                              {formatMMSS(countdown.morningRemainingSec)}
                            </div>
                            <div className="mt-3 flex justify-center">
                              {renderRemainingLines(
                                countdown.morningRemainingSec,
                                MORNING_BREAK_MIN,
                                60,
                              )}
                            </div>
                          </div>
                          <div className="mt-4">
                            <button
                              onClick={() => openConfirm("morning_break_end")}
                              disabled={isActionPending || isConfirmOpen}
                              className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                            >
                              End Now
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => openConfirm("morning_break_start")}
                          disabled={
                            isActionPending ||
                            isConfirmOpen ||
                            !isShiftActive ||
                            isAnyBreakActive ||
                            hasMorningBreak
                          }
                          className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-orange-200 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                        >
                          Start Morning Break
                        </button>
                      )}
                    </div>
                    {/* Lunch break */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="text-orange-500 font-bold text-sm uppercase tracking-widest mb-1">
                            Lunch Break
                          </p>
                          <p className="text-gray-500 text-xs font-medium">
                            {LUNCH_BREAK_MIN} minutes
                          </p>
                        </div>
                        {hasLunchBreak && !isLunchBreakActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-green-50 text-green-600">
                            <CheckCircle2 size={12} />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-50 text-orange-600">
                            <AlertCircle size={12} />
                            {isLunchBreakActive ? "Running" : "Not started"}
                          </span>
                        )}
                      </div>

                      {isLunchBreakActive ? (
                        <>
                          <div className="text-center">
                            <div className="text-3xl font-black text-gray-800 tabular-nums">
                              {formatMMSS(countdown.lunchRemainingSec)}
                            </div>
                            <div className="mt-3 flex justify-center">
                              {renderRemainingLines(
                                countdown.lunchRemainingSec,
                                30,
                                120,
                              )}
                            </div>
                          </div>
                          <div className="mt-4">
                            <button
                              onClick={() => openConfirm("lunch_break_end")}
                              disabled={isActionPending || isConfirmOpen}
                              className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                            >
                              End Now
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => openConfirm("lunch_break_start")}
                          disabled={
                            isActionPending ||
                            isConfirmOpen ||
                            !isShiftActive ||
                            isAnyBreakActive ||
                            hasLunchBreak
                          }
                          className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-orange-200 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                        >
                          Start Lunch Break
                        </button>
                      )}
                    </div>
                    {/* Afternoon break */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="text-orange-500 font-bold text-sm uppercase tracking-widest mb-1">
                            Afternoon Break
                          </p>
                          <p className="text-gray-500 text-xs font-medium">
                            {AFTERNOON_BREAK_MIN} minutes
                          </p>
                        </div>
                        {hasAfternoonBreak && !isAfternoonBreakActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-green-50 text-green-600">
                            <CheckCircle2 size={12} />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-50 text-orange-600">
                            <AlertCircle size={12} />
                            {isAfternoonBreakActive ? "Running" : "Not started"}
                          </span>
                        )}
                      </div>

                      {isAfternoonBreakActive ? (
                        <>
                          <div className="text-center">
                            <div className="text-3xl font-black text-gray-800 tabular-nums">
                              {formatMMSS(countdown.afternoonRemainingSec)}
                            </div>
                            <div className="mt-3 flex justify-center">
                              {renderRemainingLines(
                                countdown.afternoonRemainingSec,
                                AFTERNOON_BREAK_MIN,
                                60,
                              )}
                            </div>
                          </div>
                          <div className="mt-4">
                            <button
                              onClick={() => openConfirm("afternoon_break_end")}
                              disabled={isActionPending || isConfirmOpen}
                              className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                            >
                              End Now
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => openConfirm("afternoon_break_start")}
                          disabled={
                            isActionPending ||
                            isConfirmOpen ||
                            !isShiftActive ||
                            isAnyBreakActive ||
                            hasAfternoonBreak
                          }
                          className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-orange-200 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                        >
                          Start Afternoon Break
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Timeout intentionally removed */}
                </div>

                {/* History Table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">Recent Activity</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("My Logs")}
                      className="text-xs font-bold text-orange-500 hover:underline flex items-center gap-1"
                    >
                      VIEW ALL <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                          <th className="px-6 py-3 font-bold">Date</th>
                          <th className="px-6 py-3 font-bold">
                            Scheduled Time Shift
                          </th>
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
                          <th className="px-6 py-3 font-bold">
                            Overtime (Time In)
                          </th>
                          <th className="px-6 py-3 font-bold">
                            Overtime (Time Out)
                          </th>
                          <th className="px-6 py-3 font-bold text-right">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {history.map((log) => {
                          const hasClockIn = !!log.clock_in_at;
                          const hasClockOut = !!log.clock_out_at;
                          const hasMorningIn = !!log.morning_break_in_at;
                          const hasMorningOut = !!log.morning_break_out_at;
                          const hasAfternoonIn = !!log.afternoon_break_in_at;
                          const hasAfternoonOut = !!log.afternoon_break_out_at;
                          const hasLunchIn = !!log.lunch_break_in_at;
                          const hasLunchOut = !!log.lunch_break_out_at;

                          

                          const considerLate = isLate(
                            formatTime(log?.clock_in_at), // "04:41 PM"
                            weeklyShift?.shift_start_time, // "07:00:00"
                            5,
                          );

                   
                          const considerUnderTime = isUnderTime(
                            formatTime(log?.clock_out_at),
                            weeklyShift?.shift_end_time,
                          );

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

                          const statusTone = hasClockOut
                            ? "green"
                            : hasMorningIn && !hasMorningOut
                              ? "orange"
                              : hasAfternoonIn && !hasAfternoonOut
                                ? "orange"
                                : hasLunchIn && !hasLunchOut
                                  ? "orange"
                                  : "green";

                          return (
                            <tr key={log.id} className="text-sm">
                              <td className="px-6 py-4 font-bold text-gray-700">
                                {log.shift_date}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {log.scheduled_shift}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatTime(log.clock_in_at)}{" "}
                                {considerLate && (
                                  <span className="bg-orange-600 text-white px-2 rounded-2xl">
                                    Late
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatTime(log.morning_break_in_at)}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatTime(log.morning_break_out_at)}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatTime(log.afternoon_break_in_at)}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatTime(log.afternoon_break_out_at)}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatTime(log.lunch_break_in_at)}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatTime(log.lunch_break_out_at)}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatTime(log.clock_out_at)}{" "}
                                {considerUnderTime && (
                                  <span className="bg-orange-600 text-white px-2 rounded-2xl">
                                    Undertime
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatTime(log.overtime_start)}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formatTime(log.overtime_end)}
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
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <ConfirmationBox
        isModalOpen={isConfirmOpen}
        setIsModalOpen={setIsConfirmOpen}
        title={confirmModalCopy.title}
        description={confirmModalCopy.description}
        buttonText="Confirm"
        handleAction={handleConfirmAction}
      />
    </div>
  );
}
