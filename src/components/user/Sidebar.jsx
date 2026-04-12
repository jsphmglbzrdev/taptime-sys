import { useState } from "react";
import {
  Clock,
  Calendar,
  LogOut,
  X,
  LayoutDashboard,
} from "lucide-react";
import ConfirmationBox from "../ConfirmationBox";
import { useLoading } from "../../context/LoadingContext";
import { signOut } from "../../utils/auth";
import { useNavigate } from "react-router-dom";

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen, activeTab, setActiveTab }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { setLoading } = useLoading();

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      {/* 1. SIDEBAR NAVIGATION */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-0
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white">
                <Clock size={18} strokeWidth={3} />
              </div>
              <span className="text-xl font-bold text-orange-600">TapTime</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-gray-400 cursor-pointer hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 p-4 space-y-1">
            <NavItem
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
              active={activeTab === "Dashboard"}
              onClick={() => {
                setActiveTab("Dashboard");
                setIsSidebarOpen(false);
              }}
            />
            <NavItem
              icon={<Calendar size={20} />}
              label="My Logs"
              active={activeTab === "My Logs"}
              onClick={() => {
                setActiveTab("My Logs");
                setIsSidebarOpen(false);
              }}
            />
          </nav>

          {/* Bottom Logout */}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center w-full px-4 py-3 text-sm font-semibold text-gray-500 cursor-pointer hover:bg-orange-50 hover:text-orange-600 rounded-xl transition-all"
            >
              <LogOut size={18} className="mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* 2. OVERLAY (Mobile only) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <ConfirmationBox
        title="Logout"
        description="Are you sure you want to logout?"
        buttonText="Logout"
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
				handleAction={handleLogout}
      />
    </>
  );
};

export default Sidebar;

/**
 * Sidebar Navigation Item
 */
function NavItem({ icon, label, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all w-full text-left cursor-pointer
        ${
          active
            ? "bg-orange-500 text-white shadow-lg shadow-orange-100"
            : "text-gray-500 hover:bg-orange-50 hover:text-orange-600"
        }
      `}
    >
      <span className="mr-3">{icon}</span>
      {label}
    </button>
  );
}
