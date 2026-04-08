import React, { useState, useEffect } from 'react';


import Header from '../../components/admin/Header';
import Sidebar from '../../components/admin/Sidebar';
import OverviewTab from './tabs/OverviewTab';
import EmployeesTab from './tabs/EmployeesTab';

export default function AdminDashboard() {
	
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [currentTime, setCurrentTime] = useState(new Date());

  

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-slate-900">
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
            {activeTab === 'Overview' ? (
              <OverviewTab currentTime={currentTime} />
            ) : (
              <EmployeesTab />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}







