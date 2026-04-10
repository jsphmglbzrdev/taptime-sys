import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Shield, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { useLoading } from "../../../context/LoadingContext";
import { getCurrentUser, signOut } from "../../../utils/auth";
import { deleteUserAccount, updateUserAccount } from "../../../utils/admin";
import DeleteEmployeeModal from "../../../components/admin/DeleteEmployeeModal";

const MyAccount = () => {
  const { user } = useAuth();
  const { setLoading } = useLoading();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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
      setPassword("");
      await loadProfile();
    } finally {
      setLoading(false);
    }
  };

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
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center font-black text-xl shrink-0">
            {initials}
          </div>
          <div className="min-w-0 space-y-1">
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
    </div>
  );
};

export default MyAccount;
