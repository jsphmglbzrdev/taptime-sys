import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Download, X } from "lucide-react";
import { listTimeEntriesByAuthId, listUserProfiles } from "../../../utils/admin";
import { useLoading } from "../../../context/LoadingContext";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function EmployeeLogsModal({ isOpen, onClose, employee, rows, onExport, isExporting }) {
  if (!isOpen || !employee) return null;

  const displayName =
    `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || employee.email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-gray-800 truncate">
              {displayName} — Time Logs
            </h3>
            <p className="text-sm text-gray-500 truncate">{employee.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              {isExporting ? "Exporting..." : "Download Excel"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                <th className="px-6 py-3 font-bold">Date</th>
                <th className="px-6 py-3 font-bold">Clock In</th>
                <th className="px-6 py-3 font-bold">Morning Break Time (Time In)</th>
                <th className="px-6 py-3 font-bold">Morning Break Time (Time Out)</th>
                <th className="px-6 py-3 font-bold">Afternoon Break Time (Time In)</th>
                <th className="px-6 py-3 font-bold">Afternoon Break Time (Time Out)</th>
                <th className="px-6 py-3 font-bold">Lunch Break Time (Time In)</th>
                <th className="px-6 py-3 font-bold">Lunch Break Time (Time Out)</th>
                <th className="px-6 py-3 font-bold">Clock Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.id} className="text-sm">
                  <td className="px-6 py-4 font-bold text-gray-700">{r.shift_date}</td>
                  <td className="px-6 py-4 text-gray-500">{formatTime(r.clock_in_at)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatTime(r.morning_break_in_at)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatTime(r.morning_break_out_at)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatTime(r.afternoon_break_in_at)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatTime(r.afternoon_break_out_at)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatTime(r.lunch_break_in_at)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatTime(r.lunch_break_out_at)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatTime(r.clock_out_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-gray-400 text-sm font-medium">
                    No time logs found for this employee.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ currentTime }) {
  const { setLoading } = useLoading();
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUserProfiles();
      if (!res.success) {
        toast.error(res.error || "Failed to load employees");
        return;
      }
      // Only show employees (admins should not appear in monitoring logs)
      setEmployees((res.data ?? []).filter((u) => u?.role === "Employee"));
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const openEmployeeLogs = useCallback(
    async (emp) => {
      setSelected(emp);
      setIsLogsOpen(true);
      setLoading(true);
      try {
        const res = await listTimeEntriesByAuthId({ auth_id: emp.auth_id });
        if (!res.success) {
          toast.error(res.error || "Failed to load logs");
          setLogs([]);
          return;
        }
        setLogs(res.data ?? []);
      } finally {
        setLoading(false);
      }
    },
    [setLoading]
  );

  const exportSelectedExcel = useCallback(async () => {
    if (!selected) return;
    setIsExporting(true);
    try {
      const data = (logs ?? []).map((r) => ({
        Date: r.shift_date,
        "Clock In": r.clock_in_at ? new Date(r.clock_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        "Morning Break Time (Time In)": r.morning_break_in_at ? new Date(r.morning_break_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        "Morning Break Time (Time Out)": r.morning_break_out_at ? new Date(r.morning_break_out_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        "Afternoon Break Time (Time In)": r.afternoon_break_in_at ? new Date(r.afternoon_break_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        "Afternoon Break Time (Time Out)": r.afternoon_break_out_at ? new Date(r.afternoon_break_out_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        "Lunch Break Time (Time In)": r.lunch_break_in_at ? new Date(r.lunch_break_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        "Lunch Break Time (Time Out)": r.lunch_break_out_at ? new Date(r.lunch_break_out_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        "Clock Out": r.clock_out_at ? new Date(r.clock_out_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Employee Logs");

      const safeName =
        `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim().replace(/\s+/g, "-") ||
        (selected.email ?? "employee");
      XLSX.writeFile(wb, `employee-logs-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      toast.error("Failed to export Excel.");
    } finally {
      setIsExporting(false);
    }
  }, [logs, selected]);

  const employeeCards = useMemo(() => {
    return employees.map((emp) => {
      const name =
        `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() || emp.email;
      const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase();

      return (
        <button
          key={emp.auth_id}
          type="button"
          onClick={() => openEmployeeLogs(emp)}
          className="text-left bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center font-black text-lg shrink-0">
                {initials || "?"}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black text-gray-800 truncate">{name}</p>
                <p className="text-xs font-bold text-gray-400 truncate">{emp.email}</p>
              </div>
            </div>
            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-green-50 text-green-600 shrink-0">
              {String(emp.role ?? "Employee").toUpperCase()}
            </span>
          </div>
          <div className="mt-4 text-[10px] font-black text-orange-500 uppercase tracking-widest">
            View time logs
          </div>
        </button>
      );
    });
  }, [employees, openEmployeeLogs]);

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Monitoring Dashboard</h2>
          <p className="text-gray-500 text-sm font-medium">Real-time status for {currentTime.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-3 shadow-sm">
          <Clock size={18} className="text-orange-500" />
          <span className="text-lg font-bold tabular-nums">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-gray-800">Employees</h3>
            <p className="text-gray-500 text-sm font-medium">
              Click an employee card to view full time logs
            </p>
          </div>
          <button
            type="button"
            onClick={loadEmployees}
            className="text-xs font-bold text-orange-500 hover:underline"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employeeCards}
          {employees.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-sm text-gray-500">
              No employees found.
            </div>
          )}
        </div>
      </div>

      <EmployeeLogsModal
        isOpen={isLogsOpen}
        onClose={() => {
          setIsLogsOpen(false);
          setSelected(null);
          setLogs([]);
        }}
        employee={selected}
        rows={logs}
        onExport={exportSelectedExcel}
        isExporting={isExporting}
      />
    </>
  );
}

export default OverviewTab;