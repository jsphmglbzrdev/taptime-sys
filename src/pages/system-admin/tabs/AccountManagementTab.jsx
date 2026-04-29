import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Copy,
  Pencil,
  Trash2,
  Filter,
  FolderTree,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";
import AccountCreationModal from "../../../components/admin/AccountCreationModal";
import DeleteEmployeeModal from "../../../components/admin/DeleteEmployeeModal";
import SystemAccountEditModal from "../../../components/system-admin/SystemAccountEditModal";
import { useAuth } from "../../../context/AuthContext";
import {
  CUSTOM_DEPARTMENT_VALUE,
  PREDEFINED_DEPARTMENTS,
} from "../../../utils/departments";
import { deleteUserAccount, listUserProfiles, updateUserAccount } from "../../../utils/admin";
import {
  generateDepartmentCode,
  generateEmployerCode,
} from "../../../utils/organizationCodes";
import { getRoleLabel, isEmployerRole } from "../../../utils/roles";

const ACCOUNT_TABS = ["Employers", "Employees", "System Admins", "Departments"];
const ALL_FILTER_VALUE = "__all__";

function RoleBadge({ role }) {
  const tone =
    role === "System Admin"
      ? "bg-orange-100 text-orange-700"
      : isEmployerRole(role)
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${tone}`}>
      {getRoleLabel(role)}
    </span>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center text-sm font-medium text-gray-500">
      {children}
    </div>
  );
}

function getDepartmentLabel(profile) {
  const department = String(profile?.department ?? "").trim();
  if (department) return department;
  if (profile?.role === "Employee") return "Unassigned";
  return "";
}

export default function AccountManagementTab() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("Employers");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(ALL_FILTER_VALUE);
  const [roleFilter, setRoleFilter] = useState(ALL_FILTER_VALUE);

  const loadProfiles = useCallback(async () => {
    const response = await listUserProfiles();
    if (!response.success) {
      toast.error(response.error || "Failed to load user accounts.");
      return;
    }
    setProfiles(response.data ?? []);
  }, []);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      loadProfiles();
    }, 0);

    return () => {
      window.clearTimeout(loadId);
    };
  }, [loadProfiles]);

  const departmentOptions = useMemo(() => {
    const foundDepartments = new Set(PREDEFINED_DEPARTMENTS);

    for (const profile of profiles) {
      const department = String(profile.department ?? "").trim();
      if (department) foundDepartments.add(department);
    }

    return [
      { value: ALL_FILTER_VALUE, label: "All Departments" },
      ...[...foundDepartments]
        .sort((left, right) => left.localeCompare(right))
        .map((department) => ({
          value: department,
          label: department,
        })),
    ];
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesTab =
        activeTab === "Employers"
          ? isEmployerRole(profile.role)
          : activeTab === "Employees"
            ? profile.role === "Employee"
            : activeTab === "System Admins"
              ? profile.role === "System Admin"
            : true;

      if (!matchesTab) return false;

      if (departmentFilter !== ALL_FILTER_VALUE) {
        const department = getDepartmentLabel(profile);
        if (department !== departmentFilter) return false;
      }

      if (roleFilter !== ALL_FILTER_VALUE) {
        const label = getRoleLabel(profile.role);
        if (label !== roleFilter) return false;
      }

      if (!needle) return true;

      const name =
        `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim().toLowerCase();
      const email = String(profile.email ?? "").toLowerCase();
      const department = getDepartmentLabel(profile).toLowerCase();
      const code = String(profile.employer_code ?? profile.employee_code ?? "").toLowerCase();

      return (
        name.includes(needle) ||
        email.includes(needle) ||
        department.includes(needle) ||
        code.includes(needle)
      );
    });
  }, [activeTab, departmentFilter, profiles, roleFilter, search]);

  const roleOptions = useMemo(() => {
    const options = [
      { value: ALL_FILTER_VALUE, label: "All Roles" },
      { value: "Employer", label: "Employer" },
      { value: "Employee", label: "Employee" },
      { value: "System Admin", label: "System Admin" },
    ];

    if (activeTab === "Employers") {
      return options.filter(
        (option) => option.value === ALL_FILTER_VALUE || option.value === "Employer",
      );
    }

    if (activeTab === "Employees") {
      return options.filter(
        (option) => option.value === ALL_FILTER_VALUE || option.value === "Employee",
      );
    }

    if (activeTab === "System Admins") {
      return options.filter(
        (option) =>
          option.value === ALL_FILTER_VALUE || option.value === "System Admin",
      );
    }

    return options;
  }, [activeTab]);

  const departmentGroups = useMemo(() => {
    const groups = new Map();

    for (const profile of filteredProfiles) {
      const department = getDepartmentLabel(profile);
      if (!department) continue;
      if (!groups.has(department)) {
        groups.set(department, {
          name: department,
          employers: [],
          employees: [],
          systemAdmins: [],
        });
      }

      const target = groups.get(department);
      if (profile.role === "Employee") {
        target.employees.push(profile);
      } else if (profile.role === "System Admin") {
        target.systemAdmins.push(profile);
      } else {
        target.employers.push(profile);
      }
    }

    return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [filteredProfiles]);

  const copyDepartmentCode = useCallback(async (departmentName) => {
    try {
      const code = generateDepartmentCode({
        employerCode: generateEmployerCode(departmentName),
        departmentName:
          departmentName === "Unassigned" ? CUSTOM_DEPARTMENT_VALUE : departmentName,
      });
      await navigator.clipboard.writeText(code);
      toast.success("Department join code copied.");
    } catch {
      toast.error("Failed to copy department join code.");
    }
  }, []);

  const handleSaveAccount = useCallback(
    async (payload) => {
      setIsSavingEdit(true);
      try {
        const response = await updateUserAccount(payload);
        if (!response.success) {
          toast.error(response.error || "Failed to update account.");
          return;
        }

        toast.success("Account updated.");
        setIsEditOpen(false);
        setSelectedProfile(null);
        await loadProfiles();
      } finally {
        setIsSavingEdit(false);
      }
    },
    [loadProfiles],
  );

  const handleDeleteAccount = useCallback(
    async (profile) => {
      if (!profile?.auth_id) return;

      const response = await deleteUserAccount({ auth_id: profile.auth_id });
      if (!response.success) {
        toast.error(response.error || "Failed to delete account.");
        return;
      }

      toast.success("Account deleted.");
      setIsDeleteOpen(false);
      setSelectedProfile(null);
      await loadProfiles();
    },
    [loadProfiles],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-800">
            Accounts Workspace
          </h2>
          <p className="text-sm font-medium text-gray-500">
            Switch between employer, employee, and department views with shared account filters.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-orange-600"
        >
          <UserPlus size={18} />
          Create User Account
        </button>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-2xl px-4 py-2 text-sm font-black transition-all ${
                  activeTab === tab
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 border-b border-gray-100 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="space-y-2">
            <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
              <Search size={14} />
              Search
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, department, or code"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <FilterSelect
            label="Department Filter"
            value={departmentFilter}
            onChange={setDepartmentFilter}
            options={departmentOptions}
          />

          <FilterSelect
            label="Role Filter"
            value={roleFilter}
            onChange={setRoleFilter}
            options={roleOptions}
          />
        </div>

        <div className="p-6">
          {activeTab === "Departments" ? (
            departmentGroups.length === 0 ? (
              <EmptyState>No departments matched the current filters.</EmptyState>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {departmentGroups.map((group) => (
                  <div
                    key={group.name}
                    className="rounded-3xl border border-gray-100 bg-gray-50 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-black text-gray-900">{group.name}</p>
                        <p className="mt-1 text-sm font-medium text-gray-500">
                          {group.employers.length} employer(s), {group.employees.length} employee(s), {group.systemAdmins.length} system admin(s)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyDepartmentCode(group.name)}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                      >
                        <Copy size={15} />
                        Copy Code
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white px-4 py-4">
                        <div className="flex items-center gap-2 text-amber-600">
                          <Building2 size={16} />
                          <p className="text-xs font-black uppercase tracking-widest">
                            Employers
                          </p>
                        </div>
                        <p className="mt-3 text-2xl font-black text-gray-900">
                          {group.employers.length}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-4">
                        <div className="flex items-center gap-2 text-orange-600">
                          <Users size={16} />
                          <p className="text-xs font-black uppercase tracking-widest">
                            Employees
                          </p>
                        </div>
                        <p className="mt-3 text-2xl font-black text-gray-900">
                          {group.employees.length}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <FolderTree size={16} />
                          <p className="text-xs font-black uppercase tracking-widest">
                            Total
                          </p>
                        </div>
                        <p className="mt-3 text-2xl font-black text-gray-900">
                          {group.employers.length + group.employees.length + group.systemAdmins.length}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filteredProfiles.length === 0 ? (
            <EmptyState>No accounts matched the current filters.</EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProfiles.map((profile) => {
                const name =
                  `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
                  profile.email ||
                  "User";
                const isSelf = profile.auth_id === user?.id;

                return (
                  <div
                    key={profile.auth_id}
                    className="rounded-3xl border border-gray-100 bg-gray-50 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-gray-900">{name}</p>
                        <p className="mt-1 truncate text-sm font-medium text-gray-500">
                          {profile.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={profile.role} />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProfile(profile);
                            setIsEditOpen(true);
                          }}
                          className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-500 transition-all hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                          title="Edit account"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProfile(profile);
                            setIsDeleteOpen(true);
                          }}
                          className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-red-100 bg-white p-2 text-red-500 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                          title={
                            isSelf
                              ? "You can't delete your own system admin account here"
                              : "Delete account"
                          }
                          disabled={isSelf}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 text-sm">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                          Department
                        </p>
                        <p className="mt-1 font-bold text-gray-700">
                          {getDepartmentLabel(profile) || "Not shown for this role"}
                        </p>
                      </div>

                      {profile.employer_code && (
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                            Employer Code
                          </p>
                          <p className="mt-1 break-all font-black tracking-[0.14em] text-amber-700">
                            {profile.employer_code}
                          </p>
                        </div>
                      )}

                      {profile.employee_code && (
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                            Employee ID
                          </p>
                          <p className="mt-1 font-black tracking-[0.14em] text-orange-700">
                            {profile.employee_code}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AccountCreationModal
        isOpen={isCreateOpen}
        setIsFormOpen={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            loadProfiles();
          }
        }}
      />

      <SystemAccountEditModal
        key={isEditOpen ? selectedProfile?.auth_id ?? "system-account-edit" : "system-account-edit-closed"}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedProfile(null);
        }}
        profile={selectedProfile}
        onSave={handleSaveAccount}
        isSaving={isSavingEdit}
      />

      <DeleteEmployeeModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setSelectedProfile(null);
        }}
        employee={selectedProfile}
        confirmText={selectedProfile?.email ?? "DELETE"}
        onConfirm={handleDeleteAccount}
        isSelf={selectedProfile?.auth_id === user?.id}
      />
    </div>
  );
}
