import { useState } from "react";
import {
  BookOpenText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Timer,
  User2,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ConfirmationBox from "../ConfirmationBox";
import { useLoading } from "../../context/LoadingContext";
import { signOut } from "../../utils/auth";
import NavItem from "./NavItem";
import jk2l2Logo from "/JK2L2_Crown.png";

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  setActiveTab,
  hasEmployees = true,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { setLoading } = useLoading();

  const menuItems = [
    { id: "Overview", icon: <LayoutDashboard size={20} />, label: "Overview" },
    { id: "Employee Logs", icon: <BookOpenText size={20} />, label: "Employee Logs" },
    { id: "Employees", icon: <Users size={20} />, label: "Employees" },
    {
      id: "Manage Shift",
      icon: <Timer size={20} />,
      label: "Manage Shift",
      disabled: !hasEmployees,
      infoText: "Add an employee account first",
    },
    { id: "My Account", icon: <User2 size={20} />, label: "My Account" },
  ];

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
        className={`fixed inset-y-0 left-0 z-50 border-r border-gray-200 bg-white transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isCollapsed ? "lg:w-24" : "lg:w-72"
        } ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-full flex-col">
          <div
            className={`relative flex h-20 items-center border-b border-gray-100 px-4 transition-all duration-300 ${
              isCollapsed ? "justify-center lg:px-3" : "justify-between lg:px-5"
            }`}
          >
            <div
              className={`flex min-w-0 items-center transition-all duration-300 ${
                isCollapsed ? "gap-0" : "gap-3"
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-orange-100">
                <img
                  src={jk2l2Logo}
                  alt="JK2L2 Crown"
                  className="h-10 w-10 object-contain"
                />
              </div>
              <div
                className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                  isCollapsed ? "w-0 opacity-0" : "w-40 opacity-100"
                }`}
              >
                <p className="text-xl font-extrabold tracking-tight text-orange-500">
                  TapTime
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                  Employer
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="ml-2 text-gray-400 hover:text-gray-600 lg:hidden"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {menuItems.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeTab === item.id}
                collapsed={isCollapsed}
                disabled={item.disabled}
                infoText={item.infoText}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
              />
            ))}
          </nav>

          <div className="border-t border-gray-100 p-3">
            <div className={`flex items-center gap-2 ${isCollapsed ? "justify-center" : ""}`}>
              <button
                type="button"
                title={isCollapsed ? "Sign Out" : undefined}
                onClick={() => setIsModalOpen(true)}
                className={`flex items-center rounded-xl py-3 text-sm font-semibold text-gray-500 transition-all hover:bg-orange-50 hover:text-orange-600 ${
                  isCollapsed ? "justify-center px-3" : "flex-1 px-4"
                }`}
              >
                <LogOut size={18} className={isCollapsed ? "" : "mr-3"} />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                    isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                  }`}
                >
                  Sign Out
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden shrink-0 rounded-xl border border-gray-200 p-3 text-gray-500 transition-all hover:bg-orange-50 hover:text-orange-600 lg:inline-flex"
              >
                {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
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
