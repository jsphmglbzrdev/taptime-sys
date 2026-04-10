import React, { useEffect, useState } from "react";

import Header from "../../components/admin/Header";
import Sidebar from "../../components/admin/Sidebar";
import OverviewTab from "./tabs/OverviewTab";
import EmployeesTab from "./tabs/EmployeesTab";
import MyAccount from "./tabs/MyAccount";
import ManageShift from "./tabs/ManageShift";


export default function AdminDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const id = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="admin-portal flex h-screen bg-gray-50 overflow-hidden font-sans text-slate-900">
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header setIsSidebarOpen={setIsSidebarOpen} activeTab={activeTab} />

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {activeTab === "Overview" && (
              <OverviewTab currentTime={currentTime} />
            )}
            {activeTab === "Employees" && (<EmployeesTab />)}
            {activeTab === "Manage Shift" && (<ManageShift />)}
            {activeTab === "My Account" && (<MyAccount />)}
          </div>
        </div>
      </main>
    </div>
  );
}
