import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
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
  Search,
  Filter,
  MoreVertical
} from 'lucide-react';
import Header from '../../components/admin/Header';
import Sidebar from '../../components/admin/Sidebar';



export default function AdminDashboard() {


  const [admin] = useState({ name: 'Admin User', role: 'System Administrator', id: 'ADM-001' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [employeeAttendance, setEmployeeAttendance] = useState([

  ]);



  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-slate-900">
      
      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

      {/* 3. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
      <Header setIsSidebarOpen={setIsSidebarOpen}/>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Admin Summary Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800 tracking-tight">Monitoring Dashboard</h2>
                <p className="text-gray-500 text-sm font-medium">Real-time status for {currentTime.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-3">
                <Clock size={18} className="text-orange-500" />
                <span className="text-lg font-bold tabular-nums">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

  

            {/* Main Monitoring Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-gray-800">Live Attendance Monitoring</h3>
                  <span className="px-2 py-0.5 bg-green-100 text-green-600 text-[10px] font-bold rounded-full animate-pulse">LIVE</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg border border-gray-100">
                    <Filter size={16} />
                  </button>
                  <button className="px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors">
                    GENERATE REPORT
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                      <th className="px-6 py-4 font-bold">Employee</th>
                      <th className="px-6 py-4 font-bold">Department</th>
                      <th className="px-6 py-4 font-bold">Clock In</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {employeeAttendance.map((emp, i) => (
                      <tr key={i} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-800">{emp.name}</p>
                              <p className="text-[10px] text-gray-400 font-medium">{emp.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                            {emp.dept}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">{emp.clockIn}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            emp.status === 'Present' ? 'bg-green-50 text-green-600' : 
                            emp.status === 'Late' ? 'bg-orange-50 text-orange-600' : 
                            'bg-red-50 text-red-600'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              emp.status === 'Present' ? 'bg-green-500' : 
                              emp.status === 'Late' ? 'bg-orange-500' : 
                              'bg-red-500'
                            }`} />
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-1 hover:bg-gray-200 rounded-md text-gray-400 transition-colors">
                            <MoreVertical size={16} />
                          </button>
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


