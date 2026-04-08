import { Mail, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import AccountCreationModal from "../../../components/admin/AccountCreationModal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listUserProfiles, updateUserAccount, deleteUserAccount } from "../../../utils/admin";
import { useLoading } from "../../../context/LoadingContext";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";

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
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md" onClick={onClose} />
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
            className="w-full px-4 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-50 transition-all"
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
            className="w-full px-4 py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteEmployeeModal({ isOpen, onClose, employee, confirmText, onConfirm, isSelf }) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (isOpen) setTyped("");
  }, [isOpen]);

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-100 shadow-2xl p-6">
        <h3 className="text-lg font-black text-gray-800">Delete Account</h3>
        <p className="text-sm text-gray-500 mt-1">
          This will permanently delete <span className="font-bold text-gray-800">{employee.email}</span>.
        </p>

        {isSelf && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold">
            You can’t delete your own admin account.
          </div>
        )}

        <div className="mt-5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Type <span className="text-gray-800">{confirmText}</span> to confirm
          </label>
          <input
            disabled={isSelf}
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 disabled:opacity-60"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSelf || typed !== confirmText}
            onClick={() => onConfirm(employee)}
            className="w-full px-4 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeesTab() {

	const [isFormOpen, setIsFormOpen] = useState(false);
  const { setLoading } = useLoading();
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUserProfiles();
      if (!res.success) {
        toast.error(res.error || "Failed to load accounts");
        return;
      }
      setEmployees(res.data);
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const confirmText = useMemo(() => selected?.email ?? "DELETE", [selected?.email]);
  const isSelf = useMemo(() => !!selected?.auth_id && !!user?.id && selected.auth_id === user.id, [selected, user]);

  const handleSave = useCallback(
    async ({ auth_id, first_name, last_name, password }) => {
      setLoading(true);
      try {
        const res = await updateUserAccount({ auth_id, first_name, last_name, password });
        if (!res.success) {
          toast.error(res.error || "Failed to update account");
          return;
        }
        toast.success("Account updated");
        setIsEditOpen(false);
        setSelected(null);
        await loadEmployees();
      } finally {
        setLoading(false);
      }
    },
    [loadEmployees, setLoading]
  );

  const handleDelete = useCallback(
    async (emp) => {
      if (emp?.auth_id === user?.id) {
        toast.error("You can’t delete your own account.");
        return;
      }

      setLoading(true);
      try {
        const res = await deleteUserAccount({ auth_id: emp.auth_id });
        if (!res.success) {
          toast.error(res.error || "Failed to delete account");
          return;
        }
        toast.success("Account deleted");
        setIsDeleteOpen(false);
        setSelected(null);
        await loadEmployees();
      } finally {
        setLoading(false);
      }
    },
    [loadEmployees, setLoading, user?.id]
  );

	
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Employee Directory</h2>
          <p className="text-gray-500 text-sm font-medium">Manage organization staff and roles</p>
        </div>
        <button onClick={() => setIsFormOpen(true)} className="flex cursor-pointer items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all">
          <Plus size={18} />
          Create Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((emp) => {
          const name = `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || emp.email;
          const canDelete = emp.auth_id !== user?.id;

          return (
          <div key={emp.auth_id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center font-black text-xl group-hover:bg-orange-500 group-hover:text-white transition-colors">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(emp);
                    setIsEditOpen(true);
                  }}
                  className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-all"
                  title="Edit"
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(emp);
                    setIsDeleteOpen(true);
                  }}
                  disabled={!canDelete}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  title={canDelete ? "Delete" : "You can't delete your own account"}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <h4 className="text-lg font-black text-gray-800">{name}</h4>
            <p className="text-sm font-bold text-orange-500 mb-4">{emp.role}</p>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center text-xs text-gray-500 font-medium">
                <Mail size={14} className="mr-2" /> {emp.email}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
              <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-green-50 text-green-600">
                ACTIVE
              </span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {emp.auth_id === user?.id ? "You" : "Member"}
              </span>
            </div>
          </div>
        )})}
      </div>
			
			<AccountCreationModal
        isOpen={isFormOpen}
        setIsFormOpen={(open) => {
          setIsFormOpen(open);
          if (!open) loadEmployees();
        }}
      />

      <EditEmployeeModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelected(null);
        }}
        employee={selected}
        onSave={handleSave}
      />

      <DeleteEmployeeModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setSelected(null);
        }}
        employee={selected}
        confirmText={confirmText}
        onConfirm={handleDelete}
        isSelf={isSelf}
      />
    </div>
  );
}

export default EmployeesTab;