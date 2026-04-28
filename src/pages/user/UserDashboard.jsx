import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import confetti from "canvas-confetti";

import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ScanLine,
} from "lucide-react";
import Sidebar from "../../components/user/Sidebar";
import Header from "../../components/user/Header";
import { useAuth } from "../../context/AuthContext";
import { useAppShell } from "../../context/AppShellContext";
import { useLoading } from "../../context/LoadingContext";
import { supabase } from "../../utils/supabase";
import { toast } from "react-toastify";
import ConfirmationBox from "../../components/ConfirmationBox";
import MyLogsTab from "./tabs/MyLogsTab";
import ProfileTab from "./tabs/ProfileTab";
import QrAttendanceScannerPanel from "../../components/admin/QrAttendanceScannerPanel";
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
  formatDayRange,
} from "../../utils/shiftSchedule";
import {
  appendPersonalBreakHistoryEvent,
  formatPersonalBreakLogValue,
  getPersonalBreakState,
  PERSONAL_BREAK_TOTAL_MINUTES,
  PERSONAL_BREAK_TOTAL_SECONDS,
} from "../../utils/personalBreak";

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
      "You have one 60-minute personal break for the day. Start it, pause it, and resume it anytime while your shift is active until the countdown reaches zero.",
  },
  {
    title: "Overtime",
    description:
      "Start overtime only after your regular shift has been completed. Overtime keeps running until you manually end it.",
  },
];

function playClockOutConfetti() {
  const end = Date.now() + 4 * 1000;
  const colors = ["#f97316", "#fb923c", "#fdba74", "#facc15", "#22c55e"];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error.details === "string" && error.details.trim()) {
    return error.details.trim();
  }
  return fallback;
}

export default function UserDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  const { user } = useAuth();
  const { addNotification } = useAppShell();
  const { setLoading } = useLoading();
  const [todayEntry, setTodayEntry] = useState(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmType, setConfirmType] = useState(null);
  const [weeklyShift, setWeeklyShift] = useState(null);
  const autoEndedRef = useRef(false);
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

    const todayRes = await supabase
      .from("time_entries")
      .select("*")
      .eq("auth_id", user.id)
      .eq("shift_date", shiftDate)
      .maybeSingle();

    if (todayRes.error) throw todayRes.error;

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

  const isShiftActive = !!todayEntry?.clock_in_at && !todayEntry?.clock_out_at;

  const isShiftCompleted = !!todayEntry?.clock_out_at;
  const hasOvertimeStart = !!todayEntry?.overtime_start;
  const hasOvertimeEnd = !!todayEntry?.overtime_end;
  const isOvertimeActive = hasOvertimeStart && !hasOvertimeEnd;
  const isQrScannerDisabled = hasOvertimeStart && hasOvertimeEnd;
  const hasAssignedShift =
    !!weeklyShift?.shift_start_time && !!weeklyShift?.shift_end_time;

  const canClockInNow = useMemo(() => {
    if (isShiftActive) return true;
    if (isShiftCompleted) return false;
    if (!hasAssignedShift) return false;
    return clockInEval.allowed;
  }, [clockInEval.allowed, hasAssignedShift, isShiftActive, isShiftCompleted]);

  const personalBreakState = useMemo(
    () => getPersonalBreakState(todayEntry, currentTime),
    [currentTime, todayEntry],
  );
  const isPersonalBreakActive = personalBreakState.isRunning;
  const isAnyBreakActive = isPersonalBreakActive;

  const computedStatus = useMemo(() => {
    if (!todayEntry?.clock_in_at)
      return { label: "Not started", tone: "orange" };
    if (isOvertimeActive) return { label: "Overtime", tone: "orange" };
    if (hasOvertimeStart && hasOvertimeEnd)
      return { label: "Completed with Overtime", tone: "green" };
    if (todayEntry?.clock_out_at) return { label: "Completed", tone: "green" };
    if (isPersonalBreakActive) return { label: "Personal Break", tone: "orange" };
    return { label: "Working", tone: "green" };
  }, [
    hasOvertimeEnd,
    hasOvertimeStart,
    isOvertimeActive,
    isPersonalBreakActive,
    todayEntry,
  ]);

  const todayShiftTimes = useMemo(
    () => getEntryShiftTimes(todayEntry ?? {}, weeklyShift),
    [todayEntry, weeklyShift],
  );

  const todayScheduledShift = useMemo(() => {
    if (todayEntry?.scheduled_shift) return todayEntry.scheduled_shift;
    if (!weeklyShift?.shift_start_time || !weeklyShift?.shift_end_time) return "No shift assigned";
    return `${formatShiftTimeLabel(weeklyShift.shift_start_time)} - ${formatShiftTimeLabel(weeklyShift.shift_end_time)}`;
  }, [
    todayEntry?.scheduled_shift,
    weeklyShift?.shift_end_time,
    weeklyShift?.shift_start_time,
  ]);

  const todayClockInLabel = useMemo(
    () => formatTime(todayEntry?.clock_in_at),
    [formatTime, todayEntry?.clock_in_at],
  );

  const todayClockOutLabel = useMemo(
    () => formatTime(todayEntry?.clock_out_at),
    [formatTime, todayEntry?.clock_out_at],
  );

  const isTodayLate = useMemo(
    () =>
      todayClockInLabel !== "-" &&
      !!todayShiftTimes?.shiftStart &&
      isLate(todayClockInLabel, todayShiftTimes.shiftStart, 5),
    [todayClockInLabel, todayShiftTimes?.shiftStart],
  );

  const isTodayUnderTime = useMemo(
    () =>
      todayClockOutLabel !== "-" &&
      !!todayShiftTimes?.shiftEnd &&
      isUnderTime(todayClockOutLabel, todayShiftTimes.shiftEnd),
    [todayClockOutLabel, todayShiftTimes?.shiftEnd],
  );

  const todayLogHighlights = useMemo(
    () => [
      {
        label: "Clock In",
        value: todayClockInLabel,
        accent: isTodayLate ? "Late" : null,
      },
      {
        label: "Clock Out",
        value: todayClockOutLabel,
        accent: isTodayUnderTime ? "Undertime" : null,
      },
      {
        label: "Personal Break",
        value: formatPersonalBreakLogValue(todayEntry, currentTime),
      },
      {
        label: "Overtime",
        value:
          todayEntry?.overtime_start || todayEntry?.overtime_end
            ? `${formatTime(todayEntry?.overtime_start)} - ${formatTime(todayEntry?.overtime_end)}`
            : "-",
      },
    ],
    [
      formatTime,
      isTodayLate,
      isTodayUnderTime,
      todayClockInLabel,
      todayClockOutLabel,
      todayEntry?.overtime_end,
      todayEntry?.overtime_start,
      currentTime,
    ],
  );

  const countdown = useMemo(
    () => ({
      personalBreakRemainingSec: isPersonalBreakActive
        ? personalBreakState.remainingSeconds
        : null,
    }),
    [isPersonalBreakActive, personalBreakState.remainingSeconds],
  );

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
      if (error) {
        console.error("Failed updating time_entries", { shiftDate, patch, error });
        throw new Error(
          getErrorMessage(error, "Failed updating today's attendance record."),
        );
      }
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
          personal_break_started_at: null,
          personal_break_last_started_at: null,
          personal_break_ended_at: null,
          personal_break_remaining_seconds: PERSONAL_BREAK_TOTAL_SECONDS,
          personal_break_is_paused: false,
          personal_break_history: [],
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
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to clock in."));
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

      playClockOutConfetti();

      toast.success("Clocked out.");
    } catch {
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

  const startPersonalBreak = useCallback(async () => {
    const entry = todayEntryRef.current ?? todayEntry;
    const now = new Date().toISOString();
    const breakState = getPersonalBreakState(entry, now);

    if (!user || !isShiftActive || breakState.isRunning) return;
    if (breakState.remainingSeconds <= 0) {
      toast.info("Your 1-hour personal break has already been used.");
      return;
    }

    const patch = {
      personal_break_started_at: entry?.personal_break_started_at ?? now,
      personal_break_last_started_at: now,
      personal_break_ended_at: null,
      personal_break_remaining_seconds: breakState.remainingSeconds,
      personal_break_is_paused: false,
      personal_break_history: appendPersonalBreakHistoryEvent(
        entry?.personal_break_history,
        {
          type: breakState.hasStarted ? "resume" : "start",
          at: now,
          remainingSeconds: breakState.remainingSeconds,
        },
      ),
    };

    setIsActionPending(true);
    setLoading(true);
    try {
      await updateTodayEntry(patch);
      await fetchAttendance();
      toast.success(
        breakState.hasStarted ? "Personal break resumed." : "Personal break started.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to start personal break."));
    } finally {
      setLoading(false);
      setIsActionPending(false);
    }
  }, [
    fetchAttendance,
    isShiftActive,
    setLoading,
    todayEntry,
    todayEntry?.personal_break_started_at,
    updateTodayEntry,
    user,
  ]);

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
    } catch {
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
    } catch {
      toast.error("Failed to end overtime.");
    } finally {
      setLoading(false);
      setIsActionPending(false);
    }
  }, [fetchAttendance, isOvertimeActive, setLoading, updateTodayEntry, user]);

  const pausePersonalBreak = useCallback(
    async ({ silent = false, completed = false } = {}) => {
      const entry = todayEntryRef.current ?? todayEntry;
      const now = new Date().toISOString();
      const breakState = getPersonalBreakState(entry, now);

      if (!user || !isShiftActive || !breakState.isRunning) return;

      const didComplete = completed || breakState.remainingSeconds === 0;
      const patch = {
        personal_break_last_started_at: null,
        personal_break_ended_at: now,
        personal_break_remaining_seconds: breakState.remainingSeconds,
        personal_break_is_paused: !didComplete && breakState.remainingSeconds > 0,
        personal_break_history: appendPersonalBreakHistoryEvent(
          entry?.personal_break_history,
          {
            type: didComplete ? "complete" : "pause",
            at: now,
            remainingSeconds: breakState.remainingSeconds,
            note: silent ? "automatic" : "",
          },
        ),
      };

      setIsActionPending(true);
      setLoading(true);
      try {
        await updateTodayEntry(patch);
        await fetchAttendance();
        if (!silent) {
          toast.success(
            didComplete ? "Personal break completed." : "Personal break paused.",
          );
        }
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to pause personal break."));
      } finally {
        setLoading(false);
        setIsActionPending(false);
      }
    },
    [
      fetchAttendance,
      isShiftActive,
      setLoading,
      todayEntry,
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
      autoEndedRef.current = false;
      lastAutoResetKeyRef.current = key;
    }
  }, [todayEntry?.id, todayEntry?.shift_date, todayEntry?.auth_id]);

  // Automatically “Break Out” when the countdown hits 0
  useEffect(() => {
    if (isActionPending) return;

    if (
      isPersonalBreakActive &&
      countdown.personalBreakRemainingSec === 0 &&
      !autoEndedRef.current
    ) {
      autoEndedRef.current = true;
      pausePersonalBreak({ silent: true, completed: true });
    }
  }, [
    countdown.personalBreakRemainingSec,
    isActionPending,
    isPersonalBreakActive,
    pausePersonalBreak,
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

      const breakState = getPersonalBreakState(entry, autoClockOutIso);
      if (breakState.isRunning || breakState.remainingSeconds === 0) {
        const didComplete = breakState.remainingSeconds === 0;
        patch.personal_break_last_started_at = null;
        patch.personal_break_ended_at = autoClockOutIso;
        patch.personal_break_remaining_seconds = breakState.remainingSeconds;
        patch.personal_break_is_paused = !didComplete && breakState.remainingSeconds > 0;
        patch.personal_break_history = appendPersonalBreakHistoryEvent(
          entry?.personal_break_history,
          {
            type: didComplete ? "complete" : "pause",
            at: autoClockOutIso,
            remainingSeconds: breakState.remainingSeconds,
            note: "auto_clock_out",
          },
        );
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
      } catch {
        toast.error("Failed to record automatic clock out.");
      }
    }, delay);

    return () => window.clearTimeout(id);
  }, [
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
    if (type === "personal_break_start") return startPersonalBreak();
    if (type === "personal_break_pause")
      return pausePersonalBreak({ completed: false });
    if (type === "overtime_start") return startOvertime();
    if (type === "overtime_end") return endOvertime();
  }, [
    confirmType,
    endOvertime,
    handleClockIn,
    handleClockOut,
    pausePersonalBreak,
    startPersonalBreak,
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

    if (confirmType === "personal_break_start")
      return {
        title: personalBreakState.hasStarted
          ? "Resume Personal Break"
          : "Start Personal Break",
        description:
          "Confirm you want to use your personal break time now.",
      };
    if (confirmType === "personal_break_pause")
      return {
        title: "Pause Personal Break",
        description: "Confirm you want to pause your personal break now.",
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
  }, [confirmType, personalBreakState.hasStarted]);

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
                        Follow these rules so your time-in, personal break,
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

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-orange-500 font-bold text-xs uppercase tracking-widest">
                        Optional QR Attendance
                      </p>
                      <p className="mt-2 text-base font-black text-gray-800">
                        Open the camera only when you need to scan.
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-500">
                        Use your attendance QR from Profile as an alternative for clock in, clock out, overtime in, and overtime out.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsQrScannerOpen(true)}
                      disabled={isQrScannerDisabled}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${
                        isQrScannerDisabled
                          ? "cursor-not-allowed bg-gray-200 text-gray-500"
                          : "bg-orange-500 text-white hover:bg-orange-600"
                      }`}
                    >
                      <ScanLine size={18} />
                      Open QR Scanner
                    </button>
                  </div>
                  {isQrScannerDisabled && (
                    <p className="text-xs font-bold text-gray-500">
                      QR scanning is disabled because today&apos;s overtime is already completed.
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-orange-500 font-bold text-sm uppercase tracking-widest mb-1">
                          Personal Break
                        </p>
                        <p className="text-gray-500 text-xs font-medium">
                          {PERSONAL_BREAK_TOTAL_MINUTES} min total for the day
                        </p>
                        <p className="mt-3 text-sm font-medium text-gray-500">
                          Use it in one stretch or split it across your shift by pausing and resuming.
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          personalBreakState.isCompleted
                            ? "bg-green-50 text-green-600"
                            : personalBreakState.isRunning
                              ? "bg-orange-50 text-orange-600"
                              : personalBreakState.canResume
                                ? "bg-amber-50 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {personalBreakState.isCompleted ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <AlertCircle size={12} />
                        )}
                        {personalBreakState.isCompleted
                          ? "Completed"
                          : personalBreakState.isRunning
                            ? "Running"
                            : personalBreakState.canResume
                              ? "Paused"
                              : "Not started"}
                      </span>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="text-center md:text-left">
                        <div className="text-3xl font-black text-gray-800 tabular-nums">
                          {formatMMSS(
                            isPersonalBreakActive
                              ? countdown.personalBreakRemainingSec
                              : personalBreakState.remainingSeconds,
                          )}
                        </div>
                        <div className="mt-3 flex justify-center md:justify-start">
                          {renderRemainingLines(
                            isPersonalBreakActive
                              ? countdown.personalBreakRemainingSec
                              : personalBreakState.remainingSeconds,
                            PERSONAL_BREAK_TOTAL_MINUTES,
                            60,
                          )}
                        </div>
                        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-gray-400">
                          {formatPersonalBreakLogValue(todayEntry, currentTime)}
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-3 md:w-56">
                        {isPersonalBreakActive ? (
                          <button
                            onClick={() => openConfirm("personal_break_pause")}
                            disabled={isActionPending || isConfirmOpen}
                            className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                          >
                            Pause Break
                          </button>
                        ) : (
                          <button
                            onClick={() => openConfirm("personal_break_start")}
                            disabled={
                              isActionPending ||
                              isConfirmOpen ||
                              !isShiftActive ||
                              isAnyBreakActive ||
                              personalBreakState.remainingSeconds <= 0
                            }
                            className="w-full px-6 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-orange-200 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                          >
                            {personalBreakState.canResume
                              ? "Resume Break"
                              : "Start Break"}
                          </button>
                        )}

                        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500">
                          <p>{formatPersonalBreakLogValue(todayEntry, currentTime)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="overflow-hidden rounded-[28px] border border-orange-100/70 bg-white shadow-[0_24px_60px_-32px_rgba(249,115,22,0.35)]">
                  <div className="border-b border-orange-100/70 bg-gradient-to-r from-orange-50 via-amber-50 to-white p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-500">
                          Today Log
                        </p>
                        <h3 className="mt-2 text-2xl font-black tracking-tight text-gray-900">
                          Today&apos;s attendance snapshot
                        </h3>
                        <p className="mt-2 text-sm font-medium text-gray-500">
                          Focus on today here, then open My Logs for your full attendance history.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
                            Scheduled Shift
                          </p>
                          <p className="mt-1 text-sm font-black text-gray-800">
                            {todayScheduledShift}
                          </p>
                        </div>

                        <div
                          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black shadow-sm ${
                            computedStatus.tone === "green"
                              ? "bg-green-50 text-green-700"
                              : "bg-orange-50 text-orange-700"
                          }`}
                        >
                          {computedStatus.tone === "green" ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertCircle size={16} />
                          )}
                          {computedStatus.label}
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab("My Logs")}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-black text-orange-600 transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50"
                        >
                          Open My Logs
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {todayLogHighlights.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-orange-50/40 p-5 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">
                              {item.label}
                            </p>
                            {item.accent && (
                              <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-orange-700">
                                {item.accent}
                              </span>
                            )}
                          </div>
                          <p className="mt-4 text-lg font-black text-gray-900">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {!todayEntry?.clock_in_at && (
                      <div className="mt-5 rounded-2xl border border-dashed border-orange-200 bg-orange-50/70 px-5 py-4">
                        <p className="text-sm font-bold text-orange-700">
                          No attendance record has been started for today yet.
                        </p>
                        <p className="mt-1 text-sm text-orange-600/90">
                          Once you clock in, this panel will show your live time-in, personal break, clock-out, and overtime details.
                        </p>
                      </div>
                    )}
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

      <QrAttendanceScannerPanel
        mode="modal"
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        restrictToEmployeeCode
        title="QR Attendance"
        description="Scan your own attendance QR for clock in, clock out, overtime in, or overtime out."
        idleHint="Start the camera, then place your own attendance QR in front of the lens."
        disabled={isQrScannerDisabled}
        disabledMessage="Today's QR attendance flow is complete because overtime has already ended."
        onAttendanceRecorded={async (result) => {
          await Promise.all([fetchAttendance(), fetchWeeklyShift()]);
          if (result?.action === "clock_out") {
            playClockOutConfetti();
          }
          setIsQrScannerOpen(false);

        }}
      />
    </div>
  );
}


