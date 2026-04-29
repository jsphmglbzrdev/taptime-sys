import { Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "../../utils/auth";
import { AVATAR_UPDATED_EVENT, resolveAvatarSrc } from "../../utils/avatar";
import NotificationBell from "../NotificationBell";
import { getRoleLabel } from "../../utils/roles";

export default function Header({ setIsSidebarOpen }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [avatarSrc, setAvatarSrc] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchCurrentUser = async () => {
      const response = await getCurrentUser(user.id);

      if (response.error) {
        return;
      }

      setCurrentUser(response.data);
    };

    fetchCurrentUser();
    window.addEventListener(AVATAR_UPDATED_EVENT, fetchCurrentUser);

    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, fetchCurrentUser);
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const loadAvatarSrc = async () => {
      try {
        const nextAvatarSrc = await resolveAvatarSrc(currentUser?.avatar_url);
        if (!cancelled) setAvatarSrc(nextAvatarSrc);
      } catch {
        if (!cancelled) setAvatarSrc("");
      }
    };

    loadAvatarSrc();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.avatar_url]);

  const initials = useMemo(() => {
    const name = `${currentUser?.first_name ?? ""} ${currentUser?.last_name ?? ""}`
      .trim()
      || currentUser?.email
      || "";
    const parts = name.split(" ").filter(Boolean).slice(0, 2);
    if (parts.length === 0) return "A";
    return parts.map((part) => part[0]).join("").toUpperCase();
  }, [currentUser?.email, currentUser?.first_name, currentUser?.last_name]);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 mr-2 text-gray-500 hover:bg-gray-100 rounded-lg lg:hidden cursor-pointer"
        >
          <Menu size={24} />
        </button>
     
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />
        <div className="hidden md:block text-right">
          <p className="text-sm font-bold text-gray-800 leading-none">
            {currentUser?.first_name} {currentUser?.last_name}
          </p>
          <p className="text-[10px] text-orange-500 font-black uppercase tracking-wider mt-1">
            {getRoleLabel(currentUser?.role)}
          </p>
        </div>
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt="Employer profile"
            className="w-10 h-10 rounded-full object-cover object-center border-2 border-orange-100 shadow-sm"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-100 flex items-center justify-center font-bold">
            {initials}
          </div>
        )}
      </div>
    </header>
  );
}
