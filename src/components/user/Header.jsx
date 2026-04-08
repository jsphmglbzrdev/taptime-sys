
import { useEffect, useMemo, useState } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getCurrentUser } from "../../utils/auth";

const Header = ({ setIsSidebarOpen }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      const response = await getCurrentUser(user.id);
      if (response?.error) {
        console.error("Failed to fetch current user:", response.error);
        return;
      }
      setProfile(response.data ?? null);
    };

    loadProfile();
  }, [user]);

  const displayName = useMemo(() => {
    const first = profile?.first_name?.trim();
    const last = profile?.last_name?.trim();
    const full = [first, last].filter(Boolean).join(" ");
    return full || profile?.email || "Loading...";
  }, [profile]);

  const initials = useMemo(() => {
    if (!displayName || displayName === "Loading...") return "?";
    const parts = displayName.split(" ").filter(Boolean);
    const first = parts[0]?.[0] ?? "?";
    const second = parts.length > 1 ? parts[1]?.[0] : "";
    return (first + second).toUpperCase();
  }, [displayName]);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
      <div className="flex items-center">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 mr-2 text-gray-500 hover:bg-gray-100 rounded-lg lg:hidden"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 hidden sm:block">
          Employee Dashboard
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:block text-right">
          <p className="text-sm font-bold text-gray-800 leading-none">
            {displayName}
          </p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
            {profile?.role ?? ""}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-orange-100 border-2 border-white shadow-sm flex items-center justify-center text-orange-600 font-bold">
          {initials}
        </div>
      </div>
    </header>
  );
};

export default Header;
