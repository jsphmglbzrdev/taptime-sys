import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  User,
  LogOut,
  Settings,
  Bell,
  Clock,
  Calendar,
  UserCheck,
  UserX,
  CheckCircle2,
  AlertCircle,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

/**
 * Main Application Component
 * A simplified Employee Attendance Recording System.
 */
export default function UserDashboard() {
  const [user] = useState({
    name: "Alex Johnson",
    role: "Senior Developer",
    id: "EMP-2024-089",
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [attendanceHistory, setAttendanceHistory] = useState([
    {
      date: "2024-05-20",
      clockIn: "08:55 AM",
      clockOut: "05:30 PM",
      status: "Present",
    },
    {
      date: "2024-05-19",
      clockIn: "09:02 AM",
      clockOut: "06:15 PM",
      status: "Late",
    },
    {
      date: "2024-05-18",
      clockIn: "08:45 AM",
      clockOut: "05:00 PM",
      status: "Present",
    },
  ]);

  // Real-time clock effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClockAction = () => {
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const today = new Date().toLocaleDateString("en-GB");

    if (!isClockedIn) {
      const newEntry = {
        date: today,
        clockIn: now,
        clockOut: "-",
        status: "Present",
      };
      setAttendanceHistory([newEntry, ...attendanceHistory]);
      setIsClockedIn(true);
    } else {
      const updatedHistory = [...attendanceHistory];
      updatedHistory[0].clockOut = now;
      setAttendanceHistory(updatedHistory);
      setIsClockedIn(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
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

      {/* 3. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
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
                {user.name}
              </p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                {user.id}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-100 border-2 border-white shadow-sm flex items-center justify-center text-orange-600 font-bold">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Clock-In Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-orange-500 font-bold text-sm uppercase tracking-widest mb-1">
                  Time Attendance
                </p>
                <h2 className="text-4xl font-black text-gray-800 tabular-nums tracking-tight">
                  {currentTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </h2>
                <p className="text-gray-400 font-medium mt-1">
                  {currentTime.toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              <button
                onClick={handleClockAction}
                className={`
                  w-full md:w-auto px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg transform active:scale-95 flex items-center justify-center gap-3
                  ${
                    isClockedIn
                      ? "bg-red-50 text-red-600 border-2 border-red-100 hover:bg-red-100"
                      : "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200"
                  }
                `}
              >
                <Clock size={22} />
                {isClockedIn ? "Finish Shift" : "Start Shift"}
              </button>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Recent Activity</h3>
                <button className="text-xs font-bold text-orange-500 hover:underline flex items-center gap-1">
                  VIEW ALL <ChevronRight size={14} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                      <th className="px-6 py-3 font-bold">Date</th>
                      <th className="px-6 py-3 font-bold">In</th>
                      <th className="px-6 py-3 font-bold">Out</th>
                      <th className="px-6 py-3 font-bold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {attendanceHistory.map((log, i) => (
                      <tr key={i} className="text-sm">
                        <td className="px-6 py-4 font-bold text-gray-700">
                          {log.date}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {log.clockIn}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {log.clockOut}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                              log.status === "Present"
                                ? "bg-green-50 text-green-600"
                                : "bg-orange-50 text-orange-600"
                            }`}
                          >
                            {log.status === "Present" ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <AlertCircle size={12} />
                            )}
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

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
