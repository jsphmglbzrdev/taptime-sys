import { useMemo, useState } from "react";
import { EyeOff, Eye, Lock, RefreshCw, ScanLine, User, Building2, X } from "lucide-react";
import {
  EMPLOYEE_CODE_LENGTH,
  generateRandomEmployeeCode,
  normalizeEmployeeCode,
} from "../../utils/attendanceQr";
import {
  CUSTOM_DEPARTMENT_VALUE,
  PREDEFINED_DEPARTMENTS,
  normalizeDepartmentValue,
} from "../../utils/departments";
import { getRoleLabel, isEmployerRole } from "../../utils/roles";

export default function SystemAccountEditModal({
  isOpen,
  onClose,
  profile,
  onSave,
  isSaving = false,
}) {
  const safeDepartment = String(profile?.department ?? "").trim();
  const isPredefinedDepartment = PREDEFINED_DEPARTMENTS.includes(safeDepartment);

  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [employeeCode, setEmployeeCode] = useState(profile?.employee_code ?? "");
  const [department, setDepartment] = useState(
    safeDepartment
      ? isPredefinedDepartment
        ? safeDepartment
        : CUSTOM_DEPARTMENT_VALUE
      : PREDEFINED_DEPARTMENTS[0],
  );
  const [customDepartment, setCustomDepartment] = useState(
    isPredefinedDepartment ? "" : safeDepartment,
  );

  const isEmployeeAccount = profile?.role === "Employee";
  const isEmployerAccount = isEmployerRole(profile?.role);
  const resolvedDepartment = normalizeDepartmentValue({
    selectedDepartment: department,
    customDepartment,
  });

  const canSave = useMemo(() => {
    if (!String(firstName ?? "").trim() || !String(lastName ?? "").trim()) {
      return false;
    }

    if (isEmployeeAccount) {
      return normalizeEmployeeCode(employeeCode).length === EMPLOYEE_CODE_LENGTH;
    }

    if (isEmployerAccount) {
      return String(resolvedDepartment ?? "").trim().length > 0;
    }

    return true;
  }, [employeeCode, firstName, isEmployeeAccount, isEmployerAccount, lastName, resolvedDepartment]);

  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-500">
              Manage Account
            </p>
            <h3 className="mt-2 text-2xl font-black text-gray-900">
              Edit {getRoleLabel(profile.role)}
            </h3>
            <p className="mt-1 text-sm font-medium text-gray-500 break-all">
              {profile.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
              Account Role
            </p>
            <p className="mt-1 font-bold text-gray-800">{getRoleLabel(profile.role)}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                First Name
              </span>
              <div className="relative mt-2">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                Last Name
              </span>
              <div className="relative mt-2">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">
              New Password
            </span>
            <div className="relative mt-2">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Leave blank to keep unchanged"
                className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-12 text-sm font-medium text-gray-800 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 cursor-pointer px-3 text-gray-400 transition-all hover:text-orange-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {isEmployerAccount && (
            <>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Department
                </span>
                <div className="relative mt-2">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <select
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  >
                    {PREDEFINED_DEPARTMENTS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                    <option value={CUSTOM_DEPARTMENT_VALUE}>Custom Department</option>
                  </select>
                </div>
              </label>

              {department === CUSTOM_DEPARTMENT_VALUE && (
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                    Custom Department
                  </span>
                  <div className="relative mt-2">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={customDepartment}
                      onChange={(event) => setCustomDepartment(event.target.value)}
                      placeholder="Enter custom department"
                      className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </label>
              )}
            </>
          )}

          {isEmployeeAccount && (
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                Employee ID
              </span>
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={employeeCode}
                    onChange={(event) =>
                      setEmployeeCode(normalizeEmployeeCode(event.target.value))
                    }
                    inputMode="numeric"
                    pattern={`\\d{${EMPLOYEE_CODE_LENGTH}}`}
                    maxLength={EMPLOYEE_CODE_LENGTH}
                    placeholder="7-digit employee ID"
                    className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEmployeeCode(generateRandomEmployeeCode())}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-gray-500 transition-all hover:bg-gray-50 hover:text-orange-600"
                  title="Generate employee ID"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </label>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-5 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="w-full cursor-pointer rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave || isSaving}
            onClick={() =>
              onSave({
                auth_id: profile.auth_id,
                first_name: firstName,
                last_name: lastName,
                password,
                employee_code: isEmployeeAccount ? employeeCode : undefined,
                department: isEmployerAccount ? resolvedDepartment : undefined,
              })
            }
            className="w-full cursor-pointer rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
