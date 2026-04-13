import {
  Clock,
  LayoutDashboard,
  Users,
  Plus,
  LogOut,
  X,
  User2,
  Timer,
  TruckElectricIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLoading } from "../../context/LoadingContext";
import { signOut } from "../../utils/auth";
import ConfirmationBox from "../ConfirmationBox";
import { useNavigate } from "react-router-dom";
import imgLogo from "../../../public/surf2sawa.png";

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  setActiveTab,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    { id: "Overview", icon: <LayoutDashboard size={20} />, label: "Overview" },
    { id: "Employees", icon: <Users size={20} />, label: "Employees" },
    { id: "Manage Shift", icon: <Timer size={20} />, label: "Manage Shift" },
    { id: "My Account", icon: <User2 size={20} />, label: "My Account" },
  ];

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
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 bg-orange-500 rounded-lg flex items-center justify-center text-white">
                <img src={imgLogo} alt="surf2sawa-logo" />
              </div>
              <span className="text-xl font-extrabold text-orange-500 tracking-tight">
                TapTime
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-gray-400 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeTab === item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
              />
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex cursor-pointer items-center w-full px-4 py-3 text-sm font-semibold text-gray-500 hover:bg-orange-50 hover:text-orange-600 rounded-xl transition-all"
            >
              <LogOut size={18} className="mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

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
        setIsModalOpen={setIsModalOpen}
        isModalOpen={isModalOpen}
        handleAction={handleLogout}
      />
    </>
  );
}

/**
 * Navigation Item Component
 */
function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center cursor-pointer justify-between w-full px-4 py-3 text-sm font-bold rounded-xl transition-all
        ${
          active
            ? "bg-orange-500 text-white shadow-lg shadow-orange-100"
            : "text-gray-500 hover:bg-orange-50 hover:text-orange-600"
        }
      `}
    >
      <div className="flex items-center">
        <span className="mr-3">{icon}</span>
        {label}
      </div>
      {badge && (
        <span
          className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
            active ? "bg-white text-orange-500" : "bg-orange-500 text-white"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
