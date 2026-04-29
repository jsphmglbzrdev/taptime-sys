import { useState } from "react";
import { Navigate } from "react-router-dom";
import Header from "../../components/admin/Header";
import Sidebar from "../../components/system-admin/Sidebar";
import { useAuth } from "../../context/AuthContext";
import MyAccount from "../admin/tabs/MyAccount";
import EmployeeLogsTab from "../admin/tabs/EmployeeLogsTab";
import AccountManagementTab from "./tabs/AccountManagementTab";
import OverviewTab from "./tabs/OverviewTab";

export default function SystemAdminDashboard() {
  const { profile } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");

  if (profile && profile.role !== "System Admin") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="admin-portal flex h-screen overflow-hidden bg-gray-50 font-[roboto] text-slate-900">
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header setIsSidebarOpen={setIsSidebarOpen} activeTab={activeTab} />

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {activeTab === "Dashboard" && <OverviewTab />}
            {activeTab === "Accounts" && <AccountManagementTab />}
            {activeTab === "User Activity" && <EmployeeLogsTab />}
            {activeTab === "My Account" && <MyAccount />}
          </div>
        </div>
      </main>
    </div>
  );
}
