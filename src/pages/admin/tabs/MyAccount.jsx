import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Mail, Shield, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { useLoading } from "../../../context/LoadingContext";
import { getCurrentUser, signOut } from "../../../utils/auth";
import { deleteUserAccount, updateUserAccount } from "../../../utils/admin";
import DeleteEmployeeModal from "../../../components/admin/DeleteEmployeeModal";
import {
  AVATAR_MAX_SIZE_LABEL,
  deleteAvatarForUser,
  resolveAvatarSrc,
  saveAvatarForUser,
  validateAvatarFile,
} from "../../../utils/avatar";
import AvatarEditorModal from "../../../components/AvatarEditorModal";
import AvatarViewerModal from "../../../components/AvatarViewerModal";
import ConfirmationBox from "../../../components/ConfirmationBox";
import { logAuditEvent } from "../../../utils/auditTrail";

const MyAccount = () => {
  const { user } = useAuth();
  const { setLoading } = useLoading();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [avatarSrc, setAvatarSrc] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarDraftFile, setAvatarDraftFile] = useState(null);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const [isDeleteAvatarModalOpen, setIsDeleteAvatarModalOpen] = useState(false);
  const avatarInputRef = useRef(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await getCurrentUser(user.id);
      if (res.error) {
        const msg =
          typeof res.error === "string"
            ? res.error
            : res.error?.message ?? "Failed to load profile";
        toast.error(msg);
        return;
      }
      const data = res.data;
      setProfile(data ?? null);
      setFirstName(data?.first_name ?? "");
      setLastName(data?.last_name ?? "");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }, [setLoading, user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;

    const loadAvatarSrc = async () => {
      try {
        const nextAvatarSrc = await resolveAvatarSrc(profile?.avatar_url);
        if (!cancelled) setAvatarSrc(nextAvatarSrc);
      } catch {
        if (!cancelled) setAvatarSrc("");
      }
    };

    loadAvatarSrc();

    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_url]);

  const confirmText = useMemo(
    () => profile?.email ?? "DELETE",
    [profile?.email],
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user?.id || !profile) return;

    setLoading(true);
    try {
      const res = await updateUserAccount({
        auth_id: user.id,
        first_name: firstName,
        last_name: lastName,
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
        action: "update_admin_account",
        description: `Updated admin account for ${profile?.email ?? user.id}.`,
        actor: {
          auth_id: user?.id,
          email: profile?.email ?? user?.email,
          name: `${firstName ?? ""} ${lastName ?? ""}`.trim(),
          role: "Admin",
        },
        target: {
          auth_id: user?.id,
          email: profile?.email ?? user?.email,
          name: `${firstName ?? ""} ${lastName ?? ""}`.trim(),
        },
        metadata: { password_changed: Boolean(password?.trim()) },
      });
      setPassword("");
      await loadProfile();
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAvatar = useCallback(
    async (e) => {
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
    },
    [],
  );

  const handleSaveAvatar = useCallback(
    async (file) => {
      if (!user?.id) return;

      setIsUploadingAvatar(true);
      setLoading(true);
      try {
        const nextPath = await saveAvatarForUser({
          authId: user.id,
          file,
          previousAvatarRef: profile?.avatar_url,
        });
        const nextAvatarSrc = await resolveAvatarSrc(nextPath);
      setAvatarSrc(nextAvatarSrc);
      setIsAvatarEditorOpen(false);
      setAvatarDraftFile(null);
      toast.success("Profile picture updated.");
      await logAuditEvent({
        eventType: "info",
        module: "admin",
        action: "update_admin_avatar",
        description: `Updated admin profile picture for ${profile?.email ?? user?.email}.`,
        actor: {
          auth_id: user?.id,
          email: profile?.email ?? user?.email,
          name: displayName,
          role: "Admin",
        },
      });
      await loadProfile();
      } catch (err) {
        toast.error(
          err?.message ??
            "Failed to upload profile picture. Check the avatars storage bucket.",
        );
      } finally {
        setIsUploadingAvatar(false);
        setLoading(false);
      }
    },
    [loadProfile, profile?.avatar_url, setLoading, user?.id],
  );

  const handleDeleteAvatar = useCallback(async () => {
    if (!user?.id || !profile?.avatar_url) return;

    setIsUploadingAvatar(true);
    setLoading(true);
    try {
      await deleteAvatarForUser({
        authId: user.id,
        avatarRef: profile.avatar_url,
      });
      setAvatarSrc("");
      setIsAvatarViewerOpen(false);
      toast.success("Profile picture removed.");
      await logAuditEvent({
        eventType: "warning",
        module: "admin",
        action: "delete_admin_avatar",
        description: `Removed admin profile picture for ${profile?.email ?? user?.email}.`,
        actor: {
          auth_id: user?.id,
          email: profile?.email ?? user?.email,
          name: displayName,
          role: "Admin",
        },
      });
      await loadProfile();
    } catch (err) {
      toast.error(err?.message ?? "Failed to remove profile picture.");
    } finally {
      setIsUploadingAvatar(false);
      setLoading(false);
    }
  }, [loadProfile, profile?.avatar_url, setLoading, user?.id]);

  const handleDeleteAccount = async () => {
    if (!profile?.auth_id) return;

    setLoading(true);
    try {
      const res = await deleteUserAccount({ auth_id: profile.auth_id });
      if (!res.success) {
        toast.error(res.error || "Failed to delete account");
        return;
      }
      toast.success("Account deleted");
      await logAuditEvent({
        eventType: "warning",
        module: "admin",
        action: "delete_admin_account",
        description: `Deleted admin account for ${profile?.email ?? user?.email}.`,
        actor: {
          auth_id: profile?.auth_id ?? user?.id,
          email: profile?.email ?? user?.email,
          name: displayName,
          role: "Admin",
        },
      });
      setIsDeleteOpen(false);
      await signOut();
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const displayName =
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
    profile?.email ||
    "…";

  const initials = useMemo(() => {
    const parts = displayName.split(" ").filter(Boolean).slice(0, 2);
    if (parts.length === 0) return "?";
    return parts.map((p) => p[0]).join("").toUpperCase();
  }, [displayName]);

  if (!user) {
    return (
      <div className="text-sm font-medium text-gray-500">
        You need to be signed in to view this page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">
          My account
        </h2>
        <p className="text-gray-500 text-sm font-medium">
          View and update your admin profile
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6 pb-6 border-b border-gray-50">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="Admin profile"
              className="w-24 h-24 rounded-full object-cover object-center border-4 border-orange-100 shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center font-black text-2xl border-4 border-orange-100 shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-lg font-black text-gray-800 truncate">
              {displayName}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <Mail size={14} className="text-orange-500" />
                {profile?.email ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-orange-600">
                <Shield size={14} />
                {String(profile?.role ?? "Admin")}
              </span>
            </div>
            <div className="pt-1">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadAvatar}
                disabled={isUploadingAvatar}
                className="hidden"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Change profile picture
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsAvatarViewerOpen(true)}
                  disabled={!avatarSrc}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Eye size={16} />
                  View photo
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteAvatarModalOpen(true)}
                  disabled={!profile?.avatar_url || isUploadingAvatar}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Delete photo
                </button>
              </div>
              <p className="text-[11px] text-gray-400 font-medium mt-2">
                Upload and crop a JPG, PNG, or WebP image up to {AVATAR_MAX_SIZE_LABEL}.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              First name
            </label>
            <input
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
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
              autoComplete="family-name"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              New password (optional)
            </label>
            <input
              type="password"
              placeholder="Leave blank to keep your current password"
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              className="cursor-pointer w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all"
            >
              Save changes
            </button>
            <button
              type="button"
              disabled={!profile}
              onClick={() => setIsDeleteOpen(true)}
              className="cursor-pointer w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={18} />
              Delete my account
            </button>
          </div>
        </form>
      </div>

      <DeleteEmployeeModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        employee={profile}
        confirmText={confirmText}
        onConfirm={handleDeleteAccount}
        isSelf={false}
      />

      <AvatarEditorModal
        isOpen={isAvatarEditorOpen}
        file={avatarDraftFile}
        isSaving={isUploadingAvatar}
        title="Edit admin profile picture"
        onClose={() => {
          if (isUploadingAvatar) return;
          setIsAvatarEditorOpen(false);
          setAvatarDraftFile(null);
        }}
        onSave={handleSaveAvatar}
      />

      <AvatarViewerModal
        isOpen={isAvatarViewerOpen}
        src={avatarSrc}
        title={`${displayName} profile photo`}
        onClose={() => setIsAvatarViewerOpen(false)}
      />

      <ConfirmationBox
        isModalOpen={isDeleteAvatarModalOpen}
        setIsModalOpen={setIsDeleteAvatarModalOpen}
        title="Delete profile photo?"
        description="Your current profile picture will be removed from your account."
        buttonText="Delete photo"
        handleAction={async () => {
          setIsDeleteAvatarModalOpen(false);
          await handleDeleteAvatar();
        }}
      />
    </div>
  );
};

export default MyAccount;
