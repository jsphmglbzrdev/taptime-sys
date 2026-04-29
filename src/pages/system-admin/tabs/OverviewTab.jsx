import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  PieChart,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";
import { listUserProfiles } from "../../../utils/admin";
import { getRoleLabel, isEmployerRole } from "../../../utils/roles";

function ChartCard({ title, subtitle, icon, children }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
        <div>
          <h3 className="text-lg font-black text-gray-900">{title}</h3>
          <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-orange-50 p-3 text-orange-500">{icon}</div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function HorizontalBars({ rows, colorClass = "bg-orange-500", emptyLabel }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm font-medium text-gray-500">
        {emptyLabel}
      </div>
    );
  }

  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-bold text-gray-700">{row.label}</p>
            <p className="shrink-0 text-sm font-black text-gray-900">{row.value}</p>
          </div>
          <div className="h-3 rounded-full bg-gray-100">
            <div
              className={`h-3 rounded-full ${colorClass}`}
              style={{ width: `${Math.max(8, (row.value / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function getDepartmentLabel(profile) {
  const department = String(profile?.department ?? "").trim();
  if (department) return department;
  if (profile?.role === "Employee") return "Unassigned";
  return "";
}

export default function OverviewTab() {
  const [profiles, setProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await listUserProfiles();
      if (!response.success) {
        toast.error(response.error || "Failed to load system admin dashboard.");
        return;
      }
      setProfiles(response.data ?? []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const summary = useMemo(
    () => ({
      total: profiles.length,
      employees: profiles.filter((profile) => profile.role === "Employee").length,
      employers: profiles.filter((profile) => isEmployerRole(profile.role)).length,
      systemAdmins: profiles.filter((profile) => profile.role === "System Admin").length,
    }),
    [profiles],
  );

  const roleRows = useMemo(
    () => [
      { label: "Employees", value: summary.employees },
      { label: "Employers", value: summary.employers },
      { label: "System Admins", value: summary.systemAdmins },
    ],
    [summary.employees, summary.employers, summary.systemAdmins],
  );

  const departmentRows = useMemo(() => {
    const counts = new Map();
    for (const profile of profiles) {
      const label = getDepartmentLabel(profile);
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
  }, [profiles]);

  const recentProfiles = useMemo(() => {
    return [...profiles]
      .sort((left, right) => {
        const leftAt = new Date(left.created_at ?? 0).getTime();
        const rightAt = new Date(right.created_at ?? 0).getTime();
        return rightAt - leftAt;
      })
      .slice(0, 6);
  }, [profiles]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-gray-800">
          System Admin Dashboard
        </h2>
        <p className="text-sm font-medium text-gray-500">
          Track user distribution, department coverage, and newly created accounts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
            Total Users
          </p>
          <p className="mt-3 text-3xl font-black text-gray-800">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
            Employers
          </p>
          <p className="mt-3 text-3xl font-black text-gray-800">{summary.employers}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
            Employees
          </p>
          <p className="mt-3 text-3xl font-black text-gray-800">{summary.employees}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
            System Admins
          </p>
          <p className="mt-3 text-3xl font-black text-gray-800">{summary.systemAdmins}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ChartCard
          title="User Distribution"
          subtitle="How your accounts are split by role."
          icon={<PieChart size={20} />}
        >
          <HorizontalBars
            rows={roleRows}
            colorClass="bg-orange-500"
            emptyLabel="No user role data available."
          />
        </ChartCard>

        <ChartCard
          title="Department Coverage"
          subtitle="Every account grouped by department."
          icon={<Building2 size={20} />}
        >
          <HorizontalBars
            rows={departmentRows}
            colorClass="bg-amber-500"
            emptyLabel="No department data available."
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <ChartCard
          title="Latest Accounts"
          subtitle="Most recently added users."
          icon={<Users size={20} />}
        >
          <div className="space-y-3">
            {recentProfiles.map((profile) => {
              const name =
                `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                profile.email ||
                "User";
              return (
                <div
                  key={profile.auth_id}
                  className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-900">{name}</p>
                      <p className="mt-1 truncate text-xs font-medium text-gray-500">
                        {profile.email}
                      </p>
                    </div>
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-black text-orange-700">
                      {getRoleLabel(profile.role)}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    {getDepartmentLabel(profile) || "Department not tracked here"}
                  </p>
                </div>
              );
            })}

            {!isLoading && recentProfiles.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm font-medium text-gray-500">
                No accounts available yet.
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard
          title="Quick Notes"
          subtitle="What the current data says."
          icon={<ShieldCheck size={20} />}
        >
          <div className="space-y-4 text-sm font-medium text-gray-600">
            <div className="rounded-2xl bg-orange-50 px-4 py-4">
              <p className="font-black text-orange-700">
                {departmentRows[0]?.label ?? "No department yet"}
              </p>
              <p className="mt-1">
                {departmentRows[0]
                  ? `Currently the largest department with ${departmentRows[0].value} account(s).`
                  : "Create users with departments to start charting organization coverage."}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 px-4 py-4">
              <p className="font-black text-gray-800">
                {summary.employers} employer account(s)
              </p>
              <p className="mt-1">
                Employers are created with automatic alphanumeric employer codes and assigned departments.
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-4">
              <p className="font-black text-amber-700">
                {summary.employees} employee account(s)
              </p>
              <p className="mt-1">
                Employee attendance continues to use employee IDs and QR-based attendance tracking.
              </p>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
