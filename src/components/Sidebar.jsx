import React from "react";

/**
 * Sidebar Navigation Item
 */
function NavItem({ icon, label, active = false }) {
  return (
    <a
      href="#"
      className={`
        flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all
        ${
          active
            ? "bg-orange-500 text-white shadow-lg shadow-orange-100"
            : "text-gray-500 hover:bg-orange-50 hover:text-orange-600"
        }
      `}
    >
      <span className="mr-3">{icon}</span>
      {label}
    </a>
  );
}

const Sidebar = () => {
  return (
    <div>
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
              <span className="text-xl font-bold text-gray-800">Attendly</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 p-4 space-y-1">
            <NavItem
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
              active
            />
            <NavItem icon={<Calendar size={20} />} label="My Logs" />
            <NavItem icon={<User size={20} />} label="Profile" />
            <NavItem icon={<Settings size={20} />} label="Settings" />
          </nav>

          {/* Bottom Logout */}
          <div className="p-4 border-t border-gray-100">
            <button className="flex items-center w-full px-4 py-3 text-sm font-semibold text-gray-500 hover:bg-orange-50 hover:text-orange-600 rounded-xl transition-all">
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
    </div>
  );
};

export default Sidebar;
