import { useState, useEffect } from "react";

function EditEmployeeModal({ isOpen, onClose, employee, onSave }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!employee) return;
    setFirstName(employee.first_name ?? "");
    setLastName(employee.last_name ?? "");
    setPassword("");
  }, [employee]);

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-100 shadow-2xl p-6">
        <h3 className="text-lg font-black text-gray-800">Edit Account</h3>
        <p className="text-sm text-gray-500 mt-1">{employee.email}</p>

        <div className="mt-5 space-y-4">
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

        <div className="mt-6 flex items-center gap-3">
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
  );
}

export default EditEmployeeModal;