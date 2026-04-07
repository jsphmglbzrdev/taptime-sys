import React, { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLoading } from "../../context/LoadingContext";
import { getCurrentUser } from "../../utils/auth";

const Header = ({ setIsSidebarOpen }) => {
  const { user } = useAuth();
  const { setLoading } = useLoading();
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);

      const { data, error } = await getCurrentUser(user.id);

      if (!isMounted) return;

      if (error) {
        console.error("Supabase error:", error);
        setUserData(null);
      } else {
        console.log("Fetched user:", data);
        setUserData(data);
      }

      setLoading(false);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
      <div className="flex items-center">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 mr-2 text-gray-500 hover:bg-gray-100 rounded-lg lg:hidden"
        >
          <Menu size={24} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:block text-right">
          <p className="text-sm font-bold text-gray-800 leading-none">
            {`${userData?.first_name} ${userData?.last_name}` || "No Name"}
          </p>
          <p className="text-[10px] text-orange-500 font-black uppercase tracking-wider mt-1">
            Admin Portal
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-100 flex items-center justify-center font-bold">
          {userData?.first_name?.charAt(0) || "A"}
        </div>
      </div>
    </header>
  );
};

export default Header;