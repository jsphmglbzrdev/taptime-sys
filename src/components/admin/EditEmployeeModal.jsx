import { useMemo, useRef, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import AttendanceQrCard from "../AttendanceQrCard";

function EditEmployeeModal({
  isOpen,
  onClose,
  employee,
  onSave,
  avatarSrc = "",
  onAvatarFileChange,
  onViewAvatar,
  onDeleteAvatar,
  isAvatarBusy = false,
  avatarMaxSizeLabel = "5 MB",
}) {
  const [firstName, setFirstName] = useState(employee?.first_name ?? "");
  const [lastName, setLastName] = useState(employee?.last_name ?? "");
  const [password, setPassword] = useState("");
  const avatarInputRef = useRef(null);

  const displayName =
    `${firstName ?? ""} ${lastName ?? ""}`.trim() ||
    employee?.email ||
    "Employee";
  const initials = useMemo(() => {
    const parts = displayName.split(" ").filter(Boolean).slice(0, 2);
    if (parts.length === 0) return "?";
    return parts.map((part) => part[0]).join("").toUpperCase();
  }, [displayName]);

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-4 py-4 sm:px-6">
          <h3 className="text-lg font-black text-gray-800">Edit Account</h3>
          <p className="mt-1 text-sm text-gray-500 break-all">{employee.email}</p>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={`${displayName} profile`}
                    className="h-20 w-20 shrink-0 rounded-full border-4 border-orange-100 object-cover object-center"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-orange-100 bg-orange-50 text-2xl font-black text-orange-500">
                    {initials}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-gray-800">Profile picture</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    Upload and crop a JPG, PNG, or WebP image up to {avatarMaxSizeLabel}.
                  </p>

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isAvatarBusy}
                    onChange={onAvatarFileChange}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isAvatarBusy}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Change profile picture
                    </button>
                    <button
                      type="button"
                      onClick={onViewAvatar}
                      disabled={!avatarSrc}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Eye size={16} />
                      View photo
                    </button>
                    <button
                      type="button"
                      onClick={onDeleteAvatar}
                      disabled={!employee.avatar_url || isAvatarBusy}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      Delete photo
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                First name
              </label>
              <input
                className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Last name
              </label>
              <input
                className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Reset password (optional)
              </label>
              <input
                type="password"
                placeholder="Leave blank to keep unchanged"
                className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

            <AttendanceQrCard
              employeeCode={employee.employee_code}
              qrSvg={employee.attendance_qr_svg}
              title="Employee Attendance QR"
              description="This QR and employee ID can be used as an optional attendance credential."
            />
          </div>
        </div>

        <div className="border-t border-gray-100 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 cursor-pointer rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                auth_id: employee.auth_id,
                first_name: firstName,
                last_name: lastName,
                password,
              })
            }
            className="w-full cursor-pointer px-4 py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all"
          >
            Save
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditEmployeeModal;
