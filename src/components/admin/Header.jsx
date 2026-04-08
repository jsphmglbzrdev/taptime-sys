import { Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";
import { getCurrentUser } from "../../utils/auth";

export default function Header({ setIsSidebarOpen, activeTab }) {
  const [currentUser, setCurrentUser] = useState(null);
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
  }, [user]);

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
          Admin Portal — {activeTab}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:block text-right">
          <p className="text-sm font-bold text-gray-800 leading-none">
            {currentUser?.first_name} {currentUser?.last_name}
          </p>
          <p className="text-[10px] text-orange-500 font-black uppercase tracking-wider mt-1">
            {currentUser?.role}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-100 flex items-center justify-center font-bold">
          A
        </div>
      </div>
    </header>
  );
}
