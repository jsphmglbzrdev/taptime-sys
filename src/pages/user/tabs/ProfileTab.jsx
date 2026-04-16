import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { getCurrentUser } from "../../../utils/auth";
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
import { supabase } from "../../../utils/supabase";
import { logAuditEvent } from "../../../utils/auditTrail";

function getInitials(profile) {
  const first = profile?.first_name?.trim();
  const last = profile?.last_name?.trim();
  const full = [first, last].filter(Boolean).join(" ").trim();
  const base = full || profile?.email || "";
  const parts = base.split(" ").filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function ProfileTab() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState("");
  const [avatarDraftFile, setAvatarDraftFile] = useState(null);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);
  const [isDeleteAvatarModalOpen, setIsDeleteAvatarModalOpen] = useState(false);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const avatarInputRef = useRef(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await getCurrentUser(user.id);
      if (res?.error) throw res.error;
      const p = res.data ?? null;
      setProfile(p);
      try {
        const url = await resolveAvatarSrc(p?.avatar_url);
        setAvatarSrc(url);
      } catch {
        setAvatarSrc("");
      }
    } catch {
      toast.error("Failed to load profile.");
    }
  }, [resolveAvatarSrc, user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const displayName = useMemo(() => {
    const first = profile?.first_name?.trim();
    const last = profile?.last_name?.trim();
    const full = [first, last].filter(Boolean).join(" ");
    return full || profile?.email || "—";
  }, [profile]);

  const initials = useMemo(() => getInitials(profile), [profile]);
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

      setIsBusy(true);
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
          module: "user",
          action: "update_profile_avatar",
          description: `Updated profile picture for ${profile?.email ?? user?.email}.`,
          actor: {
            auth_id: user?.id,
            email: profile?.email ?? user?.email,
            name: displayName,
            role: profile?.role ?? "Employee",
          },
        });
        await loadProfile();
      } catch (err) {
        toast.error(
          err?.message ??
            "Failed to upload profile picture. Check the avatars storage bucket.",
        );
      } finally {
        setIsBusy(false);
      }
    },
    [loadProfile, profile?.avatar_url, user?.id],
  );

  const handleDeleteAvatar = useCallback(async () => {
    if (!user?.id || !profile?.avatar_url) return;

    setIsBusy(true);
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
        module: "user",
        action: "delete_profile_avatar",
        description: `Removed profile picture for ${profile?.email ?? user?.email}.`,
        actor: {
          auth_id: user?.id,
          email: profile?.email ?? user?.email,
          name: displayName,
          role: profile?.role ?? "Employee",
        },
      });
      await loadProfile();
    } catch (err) {
      toast.error(err?.message ?? "Failed to remove profile picture.");
    } finally {
      setIsBusy(false);
    }
  }, [loadProfile, profile?.avatar_url, user?.id]);

  const handleUpdatePassword = useCallback(
    async (e) => {
      e.preventDefault();
      if (!user) return;
      const a = (pw ?? "").trim();
      const b = (pw2 ?? "").trim();

      if (!a) {
        toast.error("Please enter a new password.");
        return;
      }
      if (a.length < 6) {
        toast.error("Password must be at least 6 characters.");
        return;
      }
      if (a !== b) {
        toast.error("Passwords do not match.");
        return;
      }

      setIsBusy(true);
      try {
        const res = await supabase.auth.updateUser({ password: a });
        if (res.error) throw res.error;
        toast.success("Password updated.");
        await logAuditEvent({
          eventType: "info",
          module: "user",
          action: "update_password",
          description: `Updated password for ${profile?.email ?? user?.email}.`,
          actor: {
            auth_id: user?.id,
            email: profile?.email ?? user?.email,
            name: displayName,
            role: profile?.role ?? "Employee",
          },
        });
        setPw("");
        setPw2("");
      } catch (err) {
        toast.error(err?.message ?? "Failed to update password.");
      } finally {
        setIsBusy(false);
      }
    },
    [pw, pw2, user],
  );

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
          Profile
        </h2>
        <p className="text-gray-500 text-sm font-medium">
          View your information and update your account
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="shrink-0">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover object-center border-4 border-orange-100 shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center font-black text-2xl border-4 border-orange-100 shrink-0">
                {initials}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-lg font-black text-gray-800 truncate">
              {displayName}
            </p>
            <div className="text-sm text-gray-500 font-medium space-y-0.5">
              <p>
                <span className="font-bold text-gray-600">Email:</span>{" "}
                {profile?.email ?? user?.email ?? "—"}
              </p>
              <p>
                <span className="font-bold text-gray-600">Role:</span>{" "}
                {profile?.role ?? "Employee"}
              </p>
            </div>

            <div className="pt-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadAvatar}
                disabled={isBusy}
                className="hidden"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isBusy}
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
                  disabled={!profile?.avatar_url || isBusy}
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
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-lg font-black text-gray-800">Update password</h3>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Choose a strong password you haven’t used before.
        </p>

        <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              New password
            </label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              disabled={isBusy}
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Confirm new password
            </label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              disabled={isBusy}
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className="cursor-pointer w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            Update password
          </button>
        </form>
      </div>


      <AvatarEditorModal
        isOpen={isAvatarEditorOpen}
        file={avatarDraftFile}
        isSaving={isBusy}
        title="Edit profile picture"
        onClose={() => {
          if (isBusy) return;
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
}
