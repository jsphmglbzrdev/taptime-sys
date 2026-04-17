import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Sidebar from "../../components/user/Sidebar";
import Header from "../../components/user/Header";
import { useAuth } from "../../context/AuthContext";
import { useAppShell } from "../../context/AppShellContext";
import { useLoading } from "../../context/LoadingContext";
import { signOut } from "../../utils/auth";
import { supabase } from "../../utils/supabase";
import { toast } from "react-toastify";
import ConfirmationBox from "../../components/ConfirmationBox";
import MyLogsTab from "./tabs/MyLogsTab";
import ProfileTab from "./tabs/ProfileTab";
import { logAuditEvent } from "../../utils/auditTrail";
import { emitAvatarUpdated } from "../../utils/avatar";
import {
  buildUserAccountNotification,
  buildUserShiftNotification,
} from "../../utils/notificationEvents";
import {
  getAutoClockOutDeadline,
  getEntryShiftTimes,
  isLate,
  isUnderTime,
  evaluateClockIn,
  formatShiftTimeLabel,
  getClockInWindow,
  parseTimeToMinutes,
  formatDayRange,
} from "../../utils/shiftSchedule";

/** Local clock: when each break may be started (default schedule). */
function getBreakStartWindowStatus(date = new Date()) {
  const hour = date.getHours();
  return {
    canStartMorning: hour < 12,
    canStartLunch: hour === 12,
    canStartAfternoon: hour >= 13 && hour <= 17,
  };
}

const ATTENDANCE_GUIDE_ITEMS = [
  {
    title: "Time In",
    description:
      "Clock-in opens 1 hour before your shift starts. You can still time in after start, but anything beyond the 5-minute grace period is marked late.",
  },
  {
    title: "Time Out",
    description:
      "Clock out when your workday ends. If you forget, the system automatically records clock-out 10 minutes after your scheduled shift end.",
  },
  {
    title: "Break Time",
    description:
      "Morning and afternoon breaks are 15 minutes each. If a break stays open too long, the system closes it automatically based on the break rules.",
  },
  {
    title: "Lunch Break",
    description:
      "Lunch break is 60 minutes and is intended for the 12:00 PM to 1:00 PM window. Please end lunch on time so your attendance stays accurate.",
  },
  {
    title: "Overtime",
    description:
      "Start overtime only after your regular shift has been completed. Overtime keeps running until you manually end it.",
  },
];

export default function UserDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const { user } = useAuth();
  const { addNotification } = useAppShell();
  const { setLoading } = useLoading();
  const [history, setHistory] = useState([]);
  const [todayEntry, setTodayEntry] = useState(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState(null);
  const [weeklyShift, setWeeklyShift] = useState(null);
  const autoEndedRef = useRef({
    morning: false,
    afternoon: false,
    lunch: false,
  });
  const profileNotificationSnapshotRef = useRef(null);
  const shiftNotificationSnapshotRef = useRef(null);
  const lastAutoResetKeyRef = useRef(null);
  const todayEntryRef = useRef(null);
  const updateTodayEntryRef = useRef(null);
  const fetchAttendanceRef = useRef(null);

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

  const syncNotificationSnapshots = useCallback(
    async ({ notify = false } = {}) => {
      if (!user?.id) return;

      const today = getShiftDate(new Date());
      const [profileRes, shiftRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("auth_id, first_name, last_name, email, role, avatar_url")
          .eq("auth_id", user.id)
          .maybeSingle(),
        supabase
          .from("employee_weekly_shifts")
          .select("employee_auth_id, week_start, week_end, shift_start_time, shift_end_time")
          .eq("employee_auth_id", user.id)
          .lte("week_start", today)
          .gte("week_end", today)
          .maybeSingle(),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (shiftRes.error) throw shiftRes.error;

      const profileRow = profileRes.data ?? null;
      const shiftRow = shiftRes.data ?? null;
      setWeeklyShift(shiftRow);

      const nextProfileSnapshot = profileRow
        ? JSON.stringify({
            first_name: profileRow.first_name ?? "",
            last_name: profileRow.last_name ?? "",
            email: profileRow.email ?? "",
            role: profileRow.role ?? "",
            avatar_url: profileRow.avatar_url ?? "",
          })
        : null;

      const nextShiftSnapshot = shiftRow
        ? JSON.stringify({
            week_start: shiftRow.week_start ?? "",
            week_end: shiftRow.week_end ?? "",
            shift_start_time: shiftRow.shift_start_time ?? "",
            shift_end_time: shiftRow.shift_end_time ?? "",
          })
        : null;

      if (
        notify &&
        profileNotificationSnapshotRef.current &&
        nextProfileSnapshot &&
        profileNotificationSnapshotRef.current !== nextProfileSnapshot
      ) {
        await addNotification({
          dedupeKey: `user-profile-snapshot-${user.id}-${nextProfileSnapshot}`,
          kind: "account",
          title: "Account updated",
          message:
            "Your account details were updated. Review your profile for the latest changes.",
        });
      }

      if (notify && shiftNotificationSnapshotRef.current !== nextShiftSnapshot) {
        if (!shiftNotificationSnapshotRef.current && nextShiftSnapshot) {
          const insertPayload = {
            eventType: "INSERT",
            new: shiftRow,
            commit_timestamp: new Date().toISOString(),
          };
          const nextNotification = buildUserShiftNotification(insertPayload);
          if (nextNotification) {
            await addNotification(nextNotification);
          }
        } else if (shiftNotificationSnapshotRef.current && nextShiftSnapshot) {
          const prevShift = JSON.parse(shiftNotificationSnapshotRef.current);
          const updatePayload = {
            eventType: "UPDATE",
            old: prevShift,
            new: shiftRow,
            commit_timestamp: new Date().toISOString(),
          };
          const nextNotification = buildUserShiftNotification(updatePayload);
          if (nextNotification) {
            await addNotification(nextNotification);
          }
        } else if (shiftNotificationSnapshotRef.current && !nextShiftSnapshot) {
          const prevShift = JSON.parse(shiftNotificationSnapshotRef.current);
          const deletePayload = {
            eventType: "DELETE",
            old: prevShift,
            commit_timestamp: new Date().toISOString(),
          };
          const nextNotification = buildUserShiftNotification(deletePayload);
          if (nextNotification) {
            await addNotification(nextNotification);
          }
        }
      }

      profileNotificationSnapshotRef.current = nextProfileSnapshot;
      shiftNotificationSnapshotRef.current = nextShiftSnapshot;
    },
    [addNotification, getShiftDate, user?.id],
  );

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchAttendance(), fetchWeeklyShift()]).catch(() => {
      toast.error("Failed to load dashboard data.");
    });
  }, [user, fetchAttendance, fetchWeeklyShift]);

  useEffect(() => {
    if (!user?.id) return undefined;

    syncNotificationSnapshots({ notify: false }).catch(() => {});
    const pollId = window.setInterval(() => {
      syncNotificationSnapshots({ notify: true }).catch(() => {});
    }, 20000);

    return () => {
      window.clearInterval(pollId);
    };
  }, [syncNotificationSnapshots, user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const notificationChannel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_profiles",
          filter: `auth_id=eq.${user.id}`,
        },
        async (payload) => {
          const nextRow = payload?.new ?? null;

          // Extract old data from snapshot BEFORE updating it
          let oldData = null;
          if (profileNotificationSnapshotRef.current) {
            try {
              oldData = JSON.parse(profileNotificationSnapshotRef.current);
            } catch {
              oldData = null;
            }
          }

          // Update snapshot with new data
          profileNotificationSnapshotRef.current = nextRow
            ? JSON.stringify({
                first_name: nextRow.first_name ?? "",
                last_name: nextRow.last_name ?? "",
                email: nextRow.email ?? "",
                role: nextRow.role ?? "",
                avatar_url: nextRow.avatar_url ?? "",
              })
            : profileNotificationSnapshotRef.current;

          emitAvatarUpdated();

          // Build proper payload for notification
          const notificationPayload = {
            eventType: "UPDATE",
            old: oldData,
            new: nextRow,
            commit_timestamp: new Date().toISOString(),
          };
          const nextNotification = buildUserAccountNotification(notificationPayload);
          if (nextNotification) {
            await addNotification(nextNotification);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "employee_weekly_shifts",
          filter: `employee_auth_id=eq.${user.id}`,
        },
        async (payload) => {
          const nextRow = payload?.new ?? null;
          const eventType = payload?.eventType?.toUpperCase() || payload?.event?.toUpperCase();

          // For UPDATE and DELETE, extract old data from snapshot BEFORE updating it
          let oldData = null;
          if ((eventType === "UPDATE" || eventType === "DELETE") && shiftNotificationSnapshotRef.current) {
            try {
              oldData = JSON.parse(shiftNotificationSnapshotRef.current);
            } catch {
              oldData = null;
            }
          }

          // Update snapshot with new data
          shiftNotificationSnapshotRef.current = nextRow
            ? JSON.stringify({
                week_start: nextRow.week_start ?? "",
                week_end: nextRow.week_end ?? "",
                shift_start_time: nextRow.shift_start_time ?? "",
                shift_end_time: nextRow.shift_end_time ?? "",
              })
            : null;

          await fetchWeeklyShift();

          // Build proper payload for notification
          let notificationPayload = null;
          if (eventType === "INSERT" && nextRow) {
            notificationPayload = {
              eventType: "INSERT",
              new: nextRow,
              commit_timestamp: new Date().toISOString(),
            };
          } else if (eventType === "UPDATE" && nextRow && oldData) {
            notificationPayload = {
              eventType: "UPDATE",
              old: oldData,
              new: nextRow,
              commit_timestamp: new Date().toISOString(),
            };
          } else if (eventType === "DELETE" && oldData) {
            notificationPayload = {
              eventType: "DELETE",
              old: oldData,
              commit_timestamp: new Date().toISOString(),
            };
          }

          if (notificationPayload) {
            const nextNotification = buildUserShiftNotification(notificationPayload);
            if (nextNotification) {
              await addNotification(nextNotification);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
  }, [addNotification, fetchWeeklyShift, user?.id]);

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
  /** After break allowance + this many minutes with no break-out, end break and sign out. */
  const FORGOT_BREAK_SIGNOUT_AFTER_MIN = 15;

  const breakStartWindows = useMemo(
    () => getBreakStartWindowStatus(currentTime),
    [currentTime],
  );

  const isShiftActive = !!todayEntry?.clock_in_at && !todayEntry?.clock_out_at;

  const isShiftCompleted = !!todayEntry?.clock_out_at;
  const hasOvertimeStart = !!todayEntry?.overtime_start;
  const hasOvertimeEnd = !!todayEntry?.overtime_end;
  const isOvertimeActive = hasOvertimeStart && !hasOvertimeEnd;
  const hasAssignedShift =
    !!weeklyShift?.shift_start_time && !!weeklyShift?.shift_end_time;

  const canClockInNow = useMemo(() => {
    if (isShiftActive) return true;
    if (isShiftCompleted) return false;
    if (!hasAssignedShift) return false;
    return clockInEval.allowed;
  }, [clockInEval.allowed, hasAssignedShift, isShiftActive, isShiftCompleted]);

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
    if (isOvertimeActive) return { label: "Overtime", tone: "orange" };
    if (hasOvertimeStart && hasOvertimeEnd)
      return { label: "Completed with Overtime", tone: "green" };
    if (todayEntry?.clock_out_at) return { label: "Completed", tone: "green" };
    if (isMorningBreakActive) return { label: "Morning Break", tone: "orange" };
    if (isAfternoonBreakActive)
      return { label: "Afternoon Break", tone: "orange" };
    if (isLunchBreakActive) return { label: "Lunch Break", tone: "orange" };
    return { label: "Working", tone: "green" };
  }, [
    hasOvertimeEnd,
    hasOvertimeStart,
    isAfternoonBreakActive,
    isLunchBreakActive,
    isMorningBreakActive,
    isOvertimeActive,
    todayEntry,
  ]);

  const auditActor = useMemo(
    () => ({
      auth_id: user?.id,
      email: user?.email,
      role: "Employee",
    }),
    [user?.email, user?.id],
  );

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

  useEffect(() => {
    todayEntryRef.current = todayEntry;
  }, [todayEntry]);

  useEffect(() => {
    updateTodayEntryRef.current = updateTodayEntry;
  }, [updateTodayEntry]);

  useEffect(() => {
    fetchAttendanceRef.current = fetchAttendance;
  }, [fetchAttendance]);

  const handleClockIn = useCallback(async () => {
    if (!user || isShiftActive) return;
    if (!hasAssignedShift) {
      toast.error("You cannot clock in until an admin assigns your shift.");
      return;
    }

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
      await logAuditEvent({
        eventType: ev.late ? "warning" : "info",
        module: "user",
        action: "clock_in",
        description: `${user.email} clocked in${ev.late ? " late" : ""}.`,
        actor: auditActor,
        metadata: { shift_date: shiftDate, late: Boolean(ev.late) },
      });
    } catch (err) {
      toast.error("Failed to clock in.");
    } finally {
      setLoading(false);
      setIsActionPending(false);
    }
  }, [
    fetchAttendance,
    getShiftDate,
    hasAssignedShift,
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

      toast.success("Clocked out.");
      await logAuditEvent({
        eventType: "info",
        module: "user",
        action: "clock_out",
        description: `${user.email} clocked out.`,
        actor: auditActor,
        metadata: { clock_out_at: nowIso },
      });
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

      const windows = getBreakStartWindowStatus();
      if (breakType === "morning") {
        if (!windows.canStartMorning) {
          toast.error(
            "Morning break is only available before noon (12:00 PM).",
          );
          return;
        }
      } else if (breakType === "lunch") {
        if (!windows.canStartLunch) {
          toast.error(
            "Lunch break is only available between 12:00 and 1:00 PM.",
          );
          return;
        }
      } else if (breakType === "afternoon") {
        if (!windows.canStartAfternoon) {
          toast.error(
            "Afternoon break is only available between 1:00 and 5:00 PM.",
          );
          return;
        }
      }

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
        await logAuditEvent({
          eventType: "info",
          module: "user",
          action: `${breakType}_break_start`,
          description: `${user.email} started ${breakType} break.`,
          actor: auditActor,
        });
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
      toast.success("Overtime started.");
      await logAuditEvent({
        eventType: "info",
        module: "user",
        action: "overtime_start",
        description: `${user.email} started overtime.`,
        actor: auditActor,
      });
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
      toast.success("Overtime ended.");
      await logAuditEvent({
        eventType: "info",
        module: "user",
        action: "overtime_end",
        description: `${user.email} ended overtime.`,
        actor: auditActor,
      });
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
        await logAuditEvent({
          eventType: silent ? "warning" : "info",
          module: "user",
          action: `${breakType}_break_end`,
          description: `${user.email} ${silent ? "automatically ended" : "ended"} ${breakType} break.`,
          actor: auditActor,
          metadata: { automatic: silent },
        });
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

  // If break-out is never recorded after allowance + grace, close break and sign out
  useEffect(() => {
    if (!user) return;

    const graceMs = FORGOT_BREAK_SIGNOUT_AFTER_MIN * 60 * 1000;
    const configs = [
      {
        active: isMorningBreakActive,
        breakInAt: todayEntry?.morning_break_in_at,
        durationMin: MORNING_BREAK_MIN,
        verify: (e, breakIn) =>
          e?.morning_break_in_at === breakIn && !e?.morning_break_out_at,
        patch: () => ({
          morning_break_out_at: new Date().toISOString(),
        }),
        toastMsg:
          "Signed out: morning break was left open past the allowed time plus 15 minutes.",
      },
      {
        active: isAfternoonBreakActive,
        breakInAt: todayEntry?.afternoon_break_in_at,
        durationMin: AFTERNOON_BREAK_MIN,
        verify: (e, breakIn) =>
          e?.afternoon_break_in_at === breakIn && !e?.afternoon_break_out_at,
        patch: () => ({
          afternoon_break_out_at: new Date().toISOString(),
        }),
        toastMsg:
          "Signed out: afternoon break was left open past the allowed time plus 15 minutes.",
      },
      {
        active: isLunchBreakActive,
        breakInAt: todayEntry?.lunch_break_in_at,
        durationMin: LUNCH_BREAK_MIN,
        verify: (e, breakIn) =>
          e?.lunch_break_in_at === breakIn && !e?.lunch_break_out_at,
        patch: () => ({
          lunch_break_out_at: new Date().toISOString(),
        }),
        toastMsg:
          "Signed out: lunch break was left open past the allowed time plus 15 minutes.",
      },
    ];

    const timerIds = [];

    for (const cfg of configs) {
      if (!cfg.active || !cfg.breakInAt) continue;

      const breakIn = cfg.breakInAt;
      const startMs = new Date(breakIn).getTime();
      const fireAt = startMs + cfg.durationMin * 60 * 1000 + graceMs;
      const delay = Math.max(0, fireAt - Date.now());

      const id = window.setTimeout(async () => {
        const e = todayEntryRef.current;
        if (!cfg.verify(e, breakIn)) return;
        const patchFn = updateTodayEntryRef.current;
        try {
          if (patchFn) await patchFn(cfg.patch());
        } catch {
          toast.error("Could not record break end automatically.");
        }
        toast.info(cfg.toastMsg);
        await signOut();
      }, delay);

      timerIds.push(id);
    }

    return () => {
      for (const id of timerIds) window.clearTimeout(id);
    };
  }, [
    user,
    FORGOT_BREAK_SIGNOUT_AFTER_MIN,
    isMorningBreakActive,
    isAfternoonBreakActive,
    isLunchBreakActive,
    todayEntry?.morning_break_in_at,
    todayEntry?.afternoon_break_in_at,
    todayEntry?.lunch_break_in_at,
    MORNING_BREAK_MIN,
    AFTERNOON_BREAK_MIN,
    LUNCH_BREAK_MIN,
  ]);

  useEffect(() => {
    if (!user) return;
    if (!isShiftActive || isShiftCompleted || isOvertimeActive) return;
    if (!todayEntry?.shift_date || !weeklyShift?.shift_end_time) return;

    const autoClockOutAt = getAutoClockOutDeadline(
      todayEntry.shift_date,
      weeklyShift.shift_end_time,
    );
    if (!autoClockOutAt) return;

    const delay = Math.max(0, autoClockOutAt.getTime() - Date.now());

    const id = window.setTimeout(async () => {
      const entry = todayEntryRef.current;
      const patchFn = updateTodayEntryRef.current;
      const refreshFn = fetchAttendanceRef.current;

      if (
        !entry?.clock_in_at ||
        entry?.clock_out_at ||
        entry?.overtime_start ||
        entry?.shift_date !== todayEntry.shift_date
      ) {
        return;
      }

      const autoClockOutIso = autoClockOutAt.toISOString();
      const patch = {
        clock_out_at: autoClockOutIso,
      };

      if (entry.morning_break_in_at && !entry.morning_break_out_at) {
        patch.morning_break_out_at = autoClockOutIso;
      }
      if (entry.afternoon_break_in_at && !entry.afternoon_break_out_at) {
        patch.afternoon_break_out_at = autoClockOutIso;
      }
      if (entry.lunch_break_in_at && !entry.lunch_break_out_at) {
        patch.lunch_break_out_at = autoClockOutIso;
      }

      try {
        if (!patchFn) return;
        await patchFn(patch);
        if (refreshFn) await refreshFn();
        toast.info(
          `You were automatically clocked out at ${autoClockOutAt.toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
            },
          )} after the 10-minute grace period.`,
        );
        await logAuditEvent({
          eventType: "warning",
          module: "user",
          action: "auto_clock_out",
          description: `${user.email} was automatically clocked out after missing shift end.`,
          actor: auditActor,
          metadata: {
            shift_date: entry.shift_date,
            scheduled_shift_end: weeklyShift.shift_end_time,
            auto_clock_out_at: autoClockOutIso,
          },
        });
      } catch {
        toast.error("Failed to record automatic clock out.");
      }
    }, delay);

    return () => window.clearTimeout(id);
  }, [
    auditActor,
    isOvertimeActive,
    isShiftActive,
    isShiftCompleted,
    todayEntry?.shift_date,
    user,
    weeklyShift?.shift_end_time,
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
        description:
          "Confirm you want to start the 15-minute morning break (available before 12:00 PM).",
      };
    if (confirmType === "morning_break_end")
      return {
        title: "End Morning Break",
        description: "Confirm you want to end the morning break now.",
      };

    if (confirmType === "afternoon_break_start")
      return {
        title: "Start Afternoon Break",
        description:
          "Confirm you want to start the 15-minute afternoon break (available 1:00–5:00 PM).",
      };
    if (confirmType === "afternoon_break_end")
      return {
        title: "End Afternoon Break",
        description: "Confirm you want to end the afternoon break now.",
      };

    if (confirmType === "lunch_break_start")
      return {
        title: "Start Lunch Break",
        description:
          "Confirm you want to start the 60-minute lunch break (available 12:00–1:00 PM).",
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
    <div className="user-portal flex h-screen bg-gray-50 overflow-hidden">
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
            ) : activeTab === "Profile" ? (
              <ProfileTab />
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm space-y-2">
                  <p className="text-orange-500 font-bold text-xs uppercase tracking-widest">
                    Scheduled shift
                  </p>
                  {hasAssignedShift ? (
                    <>
                      <p className="text-gray-800 font-black text-lg">
                        {formatShiftTimeLabel(weeklyShift.shift_start_time)} –{" "}
                        {formatShiftTimeLabel(weeklyShift.shift_end_time)}
                      </p>
                      <p className="text-gray-500 text-sm font-medium">
                        Week {weeklyShift.week_start} → {weeklyShift.week_end} (
                        {formatDayRange(
                          weeklyShift.week_start,
                          weeklyShift.week_end,
                        )}
                        )
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
                      No shift is assigned for this week. Clock-in stays disabled
                      until an admin assigns your schedule.
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-orange-500 font-bold text-xs uppercase tracking-widest">
                        Attendance Guide
                      </p>
                      <h3 className="text-lg font-black text-gray-800">
                        How this attendance system works
                      </h3>
                      <p className="text-sm text-gray-500 font-medium">
                        Follow these rules so your time-in, breaks, lunch,
                        time-out, and overtime are recorded correctly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsGuideOpen((open) => !open)}
                      className="inline-flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-600 hover:bg-orange-100 cursor-pointer"
                    >
                      {isGuideOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {isGuideOpen ? "Hide Guide" : "Show Guide"}
                    </button>
                  </div>

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      isGuideOpen
                        ? "max-h-[32rem] opacity-100 mt-4"
                        : "max-h-0 opacity-0 mt-0"
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                      {ATTENDANCE_GUIDE_ITEMS.map((item) => (
                        <div
                          key={item.title}
                          className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4"
                        >
                          <p className="text-sm font-black text-gray-800">
                            {item.title}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-gray-600 font-medium">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
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
                          hasOvertimeStart
                        }
                        className="w-full md:w-auto px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        <Clock size={22} />
                        Start Overtime
                      </button>
                    ) : isShiftCompleted && isOvertimeActive ? (
                      <button
                        onClick={() => openConfirm("overtime_end")}
                        disabled={isActionPending || isConfirmOpen || !user}
                        className="w-full md:w-auto px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer bg-orange-50 text-orange-600 border-2 border-orange-100 hover:bg-orange-100 disabled:opacity-70 disabled:cursor-not-allowed"
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
                        className={`w-full md:w-auto px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer ${
                          isShiftActive
                            ? "bg-red-50 text-red-600 border-2 border-red-100 hover:bg-red-100"
                            : "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200"
                        } disabled:opacity-70 disabled:cursor-not-allowed`}
                      >
                        <Clock size={22} />
                        {isShiftActive ? "Clock Out" : "Clock In"}
                      </button>
                    )}
                    {!isShiftActive && !hasAssignedShift && (
                      <p className="text-xs font-bold text-center md:text-right text-gray-500">
                        Clock-in is unavailable because no weekly shift is assigned yet.
                      </p>
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
                            {MORNING_BREAK_MIN} min · default before 12:00 PM
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
                              className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all"
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
                            hasMorningBreak ||
                            !breakStartWindows.canStartMorning
                          }
                          className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-orange-200 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all"
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
                            {LUNCH_BREAK_MIN} min · default 12:00–1:00 PM
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
                              className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all"
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
                            hasLunchBreak ||
                            !breakStartWindows.canStartLunch
                          }
                          className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-orange-200 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all"
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
                            {AFTERNOON_BREAK_MIN} min · default 1:00–5:00 PM
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
                              className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all"
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
                            hasAfternoonBreak ||
                            !breakStartWindows.canStartAfternoon
                          }
                          className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-orange-200 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all"
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
                      className="text-xs cursor-pointer font-bold text-orange-500 hover:underline flex items-center gap-1"
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
                          const hasOvertimeIn = !!log.overtime_start;
                          const hasOvertimeOut = !!log.overtime_end;
                          const hasOvertimeActive =
                            hasOvertimeIn && !hasOvertimeOut;
                          const hasOvertimeCompleted =
                            hasOvertimeIn && hasOvertimeOut;

                          const { shiftStart, shiftEnd } = getEntryShiftTimes(
                            log,
                            weeklyShift,
                          );
                          const formattedLogClockIn = formatTime(log?.clock_in_at);
                          const formattedLogClockOut = formatTime(log?.clock_out_at);
                          const considerLate =
                            formattedLogClockIn !== "-" &&
                            !!shiftStart &&
                            isLate(
                              formattedLogClockIn, // "04:41 PM"
                              shiftStart, // "07:00 AM" or "07:00:00"
                              5,
                            );

                          const considerUnderTime =
                            formattedLogClockOut !== "-" &&
                            !!shiftEnd &&
                            isUnderTime(formattedLogClockOut, shiftEnd);

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

                          const statusTone = hasOvertimeActive
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
                            <tr key={log.id} className="text-sm">
                              <td className="px-6 py-4 font-bold text-gray-700">
                                {log.shift_date}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {log.scheduled_shift}
                              </td>
                              <td className="px-6 py-4 text-gray-500">
                                {formattedLogClockIn}{" "}
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
                                {formattedLogClockOut}

                                {log.clock_out_at && considerUnderTime && (
                                  <span className="bg-orange-600 ml-1 text-white px-2 rounded-2xl">
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
