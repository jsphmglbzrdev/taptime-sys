import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Header from "../../components/admin/Header";
import Sidebar from "../../components/admin/Sidebar";
import OverviewTab from "./tabs/OverviewTab";
import EmployeeLogsTab from "./tabs/EmployeeLogsTab";
import EmployeesTab from "./tabs/EmployeesTab";
import MyAccount from "./tabs/MyAccount";
import ManageShift from "./tabs/ManageShift";
import { listUserProfiles } from "../../utils/admin";
import { supabase } from "../../utils/supabase";
import {
  buildAdminAttendanceNotifications,
  getProfileDisplayName,
} from "../../utils/notificationEvents";
import { useAppShell } from "../../context/AppShellContext";


export default function AdminDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [logsTargetView, setLogsTargetView] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employeeProfiles, setEmployeeProfiles] = useState([]);
  const attendanceSnapshotRef = useRef(new Map());
  const employeeSnapshotRef = useRef(new Map());
  const { addNotification } = useAppShell();

  useEffect(() => {
    const id = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const loadEmployeeProfiles = useCallback(async () => {
    const res = await listUserProfiles();
    if (!res.success) return;
    setEmployeeProfiles((res.data ?? []).filter((row) => row?.role === "Employee"));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      loadEmployeeProfiles();
    }, 0);

    return () => {
      window.clearTimeout(id);
    };
  }, [loadEmployeeProfiles]);

  const employeeProfileMap = useMemo(() => {
    const map = new Map();
    for (const profile of employeeProfiles) {
      map.set(profile.auth_id, profile);
    }
    return map;
  }, [employeeProfiles]);

  const syncAdminNotificationSnapshots = useCallback(
    async ({ notify = false } = {}) => {
      const todayShiftDate = new Date().toLocaleDateString("en-CA");

      const [profilesRes, entriesRes] = await Promise.all([
        listUserProfiles(),
        supabase
          .from("time_entries")
          .select(
            "id, auth_id, shift_date, clock_in_at, clock_out_at, personal_break_started_at, personal_break_last_started_at, personal_break_ended_at, personal_break_remaining_seconds, personal_break_is_paused, overtime_start, overtime_end",
          )
          .eq("shift_date", todayShiftDate)
          .order("created_at", { ascending: false }),
      ]);

      if (!profilesRes.success) {
        throw new Error(profilesRes.error || "Failed to load employee snapshots.");
      }
      if (entriesRes.error) throw entriesRes.error;

      const nextProfiles = (profilesRes.data ?? []).filter(
        (row) => row?.role === "Employee",
      );
      setEmployeeProfiles(nextProfiles);

      const nextProfileMap = new Map(
        nextProfiles.map((row) => [row.auth_id, row]),
      );
      const nextEmployeeSnapshotMap = new Map(
        nextProfiles.map((row) => [
          row.auth_id,
          JSON.stringify({
            first_name: row.first_name ?? "",
            last_name: row.last_name ?? "",
            email: row.email ?? "",
            role: row.role ?? "",
            avatar_url: row.avatar_url ?? "",
          }),
        ]),
      );

      if (notify) {
        for (const row of nextProfiles) {
          const previousSnapshot = employeeSnapshotRef.current.get(row.auth_id) ?? null;
          const nextSnapshot = nextEmployeeSnapshotMap.get(row.auth_id) ?? null;
          if (previousSnapshot && previousSnapshot !== nextSnapshot) {
            await addNotification({
              dedupeKey: `admin-profile-snapshot-${row.auth_id}-${nextSnapshot}`,
              kind: "employee",
              title: "Employee account updated",
              message: `${getProfileDisplayName(row, row.auth_id)} account details changed.`,
            });
          }
        }
      }

      employeeSnapshotRef.current = nextEmployeeSnapshotMap;

      const entryRows = entriesRes.data ?? [];
      const nextAttendanceMap = new Map(entryRows.map((row) => [row.id, row]));

      if (notify) {
        for (const row of entryRows) {
          const previousRow = attendanceSnapshotRef.current.get(row.id) ?? null;
          const payload = previousRow
            ? { eventType: "UPDATE", old: previousRow, new: row }
            : { eventType: "INSERT", new: row };
          const nextNotifications = buildAdminAttendanceNotifications(
            payload,
            nextProfileMap,
          );
          for (const notification of nextNotifications) {
            await addNotification(notification);
          }
        }
      }

      attendanceSnapshotRef.current = nextAttendanceMap;
    },
    [addNotification],
  );

  useEffect(() => {
    syncAdminNotificationSnapshots({ notify: false }).catch(() => {});

    const pollId = window.setInterval(() => {
      syncAdminNotificationSnapshots({ notify: true }).catch(() => {});
    }, 20000);

    return () => {
      window.clearInterval(pollId);
    };
  }, [syncAdminNotificationSnapshots]);

  useEffect(() => {
    const adminNotificationChannel = supabase
      .channel("admin-attendance-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_entries",
        },
        async (payload) => {
          const nextRow = payload?.new ?? null;
          const previousRow = payload?.old ?? null;
          const snapshotRow = nextRow ?? previousRow ?? null;
          if (snapshotRow?.id) {
            if (nextRow) {
              attendanceSnapshotRef.current.set(snapshotRow.id, nextRow);
            } else {
              attendanceSnapshotRef.current.delete(snapshotRow.id);
            }
          }
          const nextNotifications = buildAdminAttendanceNotifications(
            payload,
            employeeProfileMap,
          );
          for (const notification of nextNotifications) {
            await addNotification(notification);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_profiles",
        },
        async (payload) => {
          await loadEmployeeProfiles();

          const nextRow = payload?.new ?? null;
          const previousRow = payload?.old ?? null;
          const target = nextRow ?? previousRow;
          if (!target || target.role !== "Employee") return;

          if (nextRow) {
            employeeSnapshotRef.current.set(
              target.auth_id,
              JSON.stringify({
                first_name: target.first_name ?? "",
                last_name: target.last_name ?? "",
                email: target.email ?? "",
                role: target.role ?? "",
                avatar_url: target.avatar_url ?? "",
              }),
            );
          } else {
            employeeSnapshotRef.current.delete(target.auth_id);
          }

          await addNotification({
            dedupeKey: `admin-profile-${payload.eventType}-${target.auth_id}-${payload.commit_timestamp}`,
            kind: "employee",
            title: "Employee account updated",
            message: `${getProfileDisplayName(target, target.auth_id)} account details changed.`,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(adminNotificationChannel);
    };
  }, [addNotification, employeeProfileMap, loadEmployeeProfiles]);

  return (
    <div className="admin-portal flex h-screen bg-gray-50 overflow-hidden font-[roboto] text-slate-900">
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab} 
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header setIsSidebarOpen={setIsSidebarOpen} activeTab={activeTab} />

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {activeTab === "Overview" && (
              <OverviewTab
                currentTime={currentTime}
                onOpenEmployeeLogs={(view) => {
                  if (typeof view === "string") {
                    setLogsTargetView({ authId: view });
                  } else {
                    setLogsTargetView(view ?? null);
                  }
                  setActiveTab("Employee Logs");
                }}
              />
            )}
            {activeTab === "Employee Logs" && (
              <EmployeeLogsTab
                initialEmployeeAuthId={logsTargetView?.authId ?? null}
                initialTab={logsTargetView?.tab ?? null}
                initialShiftDate={logsTargetView?.shiftDate ?? null}
                onConsumeInitialEmployeeAuthId={() => setLogsTargetView(null)}
              />
            )}
            {activeTab === "Employees" && (<EmployeesTab />)}
            {activeTab === "Manage Shift" && (<ManageShift />)}
            {activeTab === "My Account" && (<MyAccount />)}
          </div>
        </div>
      </main>
    </div>
  );
}
