import { Mail, Pencil, Plus, Trash2 } from "lucide-react";
import AccountCreationModal from "../../../components/admin/AccountCreationModal";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listUserProfiles,
  updateUserAccount,
  deleteUserAccount,
} from "../../../utils/admin";
import { useLoading } from "../../../context/LoadingContext";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import DeleteEmployeeModal from "../../../components/admin/DeleteEmployeeModal";
import EditEmployeeModal from "../../../components/admin/EditEmployeeModal";
import ManageShiftModal from "../../../components/admin/ManageShiftModal";
import AvatarEditorModal from "../../../components/AvatarEditorModal";
import AvatarViewerModal from "../../../components/AvatarViewerModal";
import ConfirmationBox from "../../../components/ConfirmationBox";
import {
  AVATAR_MAX_SIZE_LABEL,
  deleteAvatarForUser,
  resolveAvatarSrc,
  saveAvatarForUser,
  validateAvatarFile,
} from "../../../utils/avatar";
import { logAuditEvent } from "../../../utils/auditTrail";

function EmployeesTab() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { setLoading } = useLoading();
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [avatarSrcByAuthId, setAvatarSrcByAuthId] = useState({});
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isManageShiftOpen, setIsManageShiftOpen] = useState(false);
  const [isAvatarBusy, setIsAvatarBusy] = useState(false);
  const [avatarDraftFile, setAvatarDraftFile] = useState(null);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const [isDeleteAvatarModalOpen, setIsDeleteAvatarModalOpen] = useState(false);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUserProfiles();
      if (!res.success) {
        toast.error(res.error || "Failed to load accounts");
        return [];
      }
      const nextEmployees = res.data ?? [];
      setEmployees(nextEmployees);
      return nextEmployees;
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    let cancelled = false;

    const loadAvatarSources = async () => {
      const nextAvatarMap = {};

      await Promise.all(
        employees.map(async (emp) => {
          try {
            const url = await resolveAvatarSrc(emp?.avatar_url);
            if (url) {
              nextAvatarMap[emp.auth_id] = url;
            }
          } catch {
            nextAvatarMap[emp.auth_id] = "";
          }
        }),
      );

      if (!cancelled) {
        setAvatarSrcByAuthId(nextAvatarMap);
      }
    };

    loadAvatarSources();

    return () => {
      cancelled = true;
    };
  }, [employees, resolveAvatarSrc]);

  const confirmText = useMemo(
    () => selected?.email ?? "DELETE",
    [selected?.email],
  );
  const isSelf = useMemo(
    () => !!selected?.auth_id && !!user?.id && selected.auth_id === user.id,
    [selected, user],
  );

  const handleSave = useCallback(
    async ({ auth_id, first_name, last_name, password }) => {
      setLoading(true);
      try { 
        const res = await updateUserAccount({
          auth_id,
          first_name,
          last_name,
          password,
        });
        if (!res.success) {
          toast.error(res.error || "Failed to update account");
          return;
        }
        toast.success("Account updated");
        await logAuditEvent({
          eventType: "info",
          module: "admin",
          action: "update_user",
          description: `Updated employee account for ${selected?.email ?? auth_id}.`,
          actor: {
            auth_id: user?.id,
            email: user?.email,
            role: "Admin",
          },
          target: {
            auth_id,
            email: selected?.email ?? null,
            name: `${first_name ?? ""} ${last_name ?? ""}`.trim(),
          },
          metadata: { password_changed: Boolean(password?.trim()) },
        });
        setIsEditOpen(false);
        setSelected(null);
        await loadEmployees();
      } finally {
        setLoading(false);
      }
    },
    [loadEmployees, setLoading],
  );

  const refreshSelected = useCallback((authId, nextEmployees) => {
    if (!authId) return;
    const nextSelected = (nextEmployees ?? []).find(
      (emp) => emp.auth_id === authId,
    );
    setSelected(nextSelected ?? null);
  }, []);

  const handleUploadAvatar = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationMessage = validateAvatarFile(file);
    if (validationMessage) {
      toast.error(validationMessage);
      e.target.value = "";
      return;
    }

    setAvatarDraftFile(file);
    setIsAvatarEditorOpen(true);
    e.target.value = "";
  }, []);

  const handleSaveAvatar = useCallback(
    async (file) => {
      if (!selected?.auth_id) return;

      setIsAvatarBusy(true);
      setLoading(true);
      try {
        await saveAvatarForUser({
          authId: selected.auth_id,
          file,
          previousAvatarRef: selected.avatar_url,
        });
        setIsAvatarEditorOpen(false);
        setAvatarDraftFile(null);
        toast.success("Profile picture updated.");
        await logAuditEvent({
          eventType: "info",
          module: "admin",
          action: "update_employee_avatar",
          description: `Updated profile picture for ${selected?.email ?? selected?.auth_id}.`,
          actor: {
            auth_id: user?.id,
            email: user?.email,
            role: "Admin",
          },
          target: {
            auth_id: selected?.auth_id,
            email: selected?.email,
            name: `${selected?.first_name ?? ""} ${selected?.last_name ?? ""}`.trim(),
          },
        });
        const nextEmployees = await loadEmployees();
        refreshSelected(selected.auth_id, nextEmployees);
      } catch (err) {
        toast.error(
          err?.message ??
            "Failed to upload profile picture. Check the avatars storage bucket.",
        );
      } finally {
        setIsAvatarBusy(false);
        setLoading(false);
      }
    },
    [
      loadEmployees,
      refreshSelected,
      selected?.auth_id,
      selected?.avatar_url,
      setLoading,
    ],
  );

  const handleDeleteAvatar = useCallback(async () => {
    if (!selected?.auth_id || !selected?.avatar_url) return;

    setIsAvatarBusy(true);
    setLoading(true);
    try {
      await deleteAvatarForUser({
        authId: selected.auth_id,
        avatarRef: selected.avatar_url,
      });
      setIsAvatarViewerOpen(false);
      toast.success("Profile picture removed.");
      await logAuditEvent({
        eventType: "warning",
        module: "admin",
        action: "delete_employee_avatar",
        description: `Removed profile picture for ${selected?.email ?? selected?.auth_id}.`,
        actor: {
          auth_id: user?.id,
          email: user?.email,
          role: "Admin",
        },
        target: {
          auth_id: selected?.auth_id,
          email: selected?.email,
          name: `${selected?.first_name ?? ""} ${selected?.last_name ?? ""}`.trim(),
        },
      });
      const nextEmployees = await loadEmployees();
      refreshSelected(selected.auth_id, nextEmployees);
    } catch (err) {
      toast.error(err?.message ?? "Failed to remove profile picture.");
    } finally {
      setIsAvatarBusy(false);
      setLoading(false);
    }
  }, [
    loadEmployees,
    refreshSelected,
    selected?.auth_id,
    selected?.avatar_url,
    setLoading,
  ]);

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
        await logAuditEvent({
          eventType: "warning",
          module: "admin",
          action: "delete_user",
          description: `Deleted employee account for ${emp.email ?? emp.auth_id}.`,
          actor: {
            auth_id: user?.id,
            email: user?.email,
            role: "Admin",
          },
          target: {
            auth_id: emp.auth_id,
            email: emp.email,
            name: `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim(),
          },
        });
        setIsDeleteOpen(false);
        setSelected(null);
        await loadEmployees();
      } finally {
        setLoading(false);
      }
    },
    [loadEmployees, setLoading, user?.id],
  );

  const closeEditModal = useCallback(() => {
    setIsEditOpen(false);
    setSelected(null);
    setIsAvatarEditorOpen(false);
    setIsAvatarViewerOpen(false);
    setIsDeleteAvatarModalOpen(false);
    setAvatarDraftFile(null);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">
            Employee Accounts
          </h2>
          <p className="text-gray-500 text-sm font-medium">
            Manage organization employee account
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex cursor-pointer items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all"
        >
          <Plus size={18} />
          Create Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((emp) => {
          const name =
            `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() ||
            emp.email;
          const avatarSrc = avatarSrcByAuthId[emp.auth_id] ?? "";
          const initials = name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase();
          const canDelete = emp.auth_id !== user?.id;

          return (
            emp.role === "Employee" && (
              <div
                key={emp.auth_id}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={`${name} profile`}
                      className="w-20 h-20 rounded-full object-cover object-center border-2 border-orange-100 shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center font-black text-2xl border-2 border-orange-100 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                      {initials || "?"}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(emp);
                        setIsEditOpen(true);
                      }}
                      className="p-2 cursor-pointer rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-all"
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
                      className="p-2 rounded-lg cursor-pointer text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      title={
                        canDelete
                          ? "Delete"
                          : "You can't delete your own account"
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <h4 className="text-lg font-black text-gray-800">{name}</h4>
                <p className="text-sm font-bold text-orange-500 mb-4">
                  {emp.role}
                </p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center text-xs text-gray-500 font-medium">
                    <Mail size={14} className="mr-2" /> {emp.email}
                  </div>
                </div>
              </div>
            )
          );
        })}
      </div>
      <ManageShiftModal
        isManageShiftOpen={isManageShiftOpen}
        onClose={() => {
          setIsManageShiftOpen(false);
        }}
      />

      <AccountCreationModal
        isOpen={isFormOpen}
        setIsFormOpen={(open) => {
          setIsFormOpen(open);
          if (!open) loadEmployees();
        }}
      />

      <EditEmployeeModal
        isOpen={isEditOpen}
        onClose={closeEditModal}
        employee={selected}
        avatarSrc={selected ? avatarSrcByAuthId[selected.auth_id] ?? "" : ""}
        onAvatarFileChange={handleUploadAvatar}
        onViewAvatar={() => setIsAvatarViewerOpen(true)}
        onDeleteAvatar={() => setIsDeleteAvatarModalOpen(true)}
        isAvatarBusy={isAvatarBusy}
        avatarMaxSizeLabel={AVATAR_MAX_SIZE_LABEL}
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

      <AvatarEditorModal
        isOpen={isAvatarEditorOpen}
        file={avatarDraftFile}
        isSaving={isAvatarBusy}
        title="Edit employee profile picture"
        onClose={() => {
          if (isAvatarBusy) return;
          setIsAvatarEditorOpen(false);
          setAvatarDraftFile(null);
        }}
        onSave={handleSaveAvatar}
      />

      <AvatarViewerModal
        isOpen={isAvatarViewerOpen}
        src={selected ? avatarSrcByAuthId[selected.auth_id] ?? "" : ""}
        title={`${
          `${selected?.first_name ?? ""} ${selected?.last_name ?? ""}`.trim() ||
          selected?.email ||
          "Employee"
        } profile photo`}
        onClose={() => setIsAvatarViewerOpen(false)}
      />

      <ConfirmationBox
        isModalOpen={isDeleteAvatarModalOpen}
        setIsModalOpen={setIsDeleteAvatarModalOpen}
        title="Delete profile photo?"
        description="This employee's current profile picture will be removed from their account."
        buttonText="Delete photo"
        handleAction={async () => {
          setIsDeleteAvatarModalOpen(false);
          await handleDeleteAvatar();
        }}
      />
    </div>
  );
}

export default EmployeesTab;
