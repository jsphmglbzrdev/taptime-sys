import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

function displayEmployee(emp) {
  const name = `${emp?.first_name ?? ""} ${emp?.last_name ?? ""}`.trim();
  return name || emp?.email || emp?.auth_id || "Unknown";
}

function saturdayOfWeek(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = 6 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function fridayFromSaturday(saturdayStr) {
  if (!saturdayStr) return "";
  const d = new Date(`${saturdayStr}T00:00:00`);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

const SHIFT_OPTIONS = [
  { value: "07:00|16:00", label: "7:00 AM - 4:00 PM" },
  { value: "08:00|17:00", label: "8:00 AM - 5:00 PM" },
  { value: "09:00|18:00", label: "9:00 AM - 6:00 PM" },
  { value: "10:00|19:00", label: "10:00 AM - 7:00 PM" },
  { value: "11:00|20:00", label: "11:00 AM - 8:00 PM" },
];

const emptySchedule = () => {
  const weekStart = saturdayOfWeek(new Date().toISOString().slice(0, 10));
  const weekEnd = fridayFromSaturday(weekStart);
  return {
    employee_auth_id: "",
    week_start: weekStart,
    week_end: weekEnd,
    shift_template: "",
    shift_start_time: "",
    shift_end_time: "",
  };
};

export default function ManageShiftModal({
  isManageShiftOpen,
  onClose,
  employees = [],
  prefillEmployeeId = "",
  onSave,
  isSaving = false,
}) {
  const [form, setForm] = useState(() => emptySchedule());
  const employeeOptions = useMemo(
    () => (employees ?? []).slice().sort((a, b) => displayEmployee(a).localeCompare(displayEmployee(b))),
    [employees]
  );

  useEffect(() => {
    if (!isManageShiftOpen) return;
    setForm((prev) => {
      const next = { ...emptySchedule(), ...prev };
      if (prefillEmployeeId) next.employee_auth_id = prefillEmployeeId;
      next.week_start = saturdayOfWeek(next.week_start);
      next.week_end = fridayFromSaturday(next.week_start);
      return next;
    });
  }, [isManageShiftOpen, prefillEmployeeId]);

  if (!isManageShiftOpen) return null;

  const canSave =
    !!form.employee_auth_id &&
    !!form.week_start &&
    !!form.week_end &&
    !!form.shift_start_time &&
    !!form.shift_end_time &&
    !isSaving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <div className="font-black text-xl text-gray-800">Manage Shift</div>
            <div className="text-xs font-bold text-gray-400">Weekly shift template</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                Employee
              </label>
              <select
                value={form.employee_auth_id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, employee_auth_id: e.target.value }))
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                <option value="">Select employee...</option>
                {employeeOptions.map((emp) => (
                  <option key={emp.auth_id} value={emp.auth_id}>
                    {displayEmployee(emp)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                Week start (Saturday)
              </label>
              <input
                type="date"
                value={form.week_start}
                onChange={(e) =>
                  setForm((p) => {
                    const weekStart = saturdayOfWeek(e.target.value);
                    return {
                      ...p,
                      week_start: weekStart,
                      week_end: fridayFromSaturday(weekStart),
                    };
                  })
                }
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                Week end (Friday)
              </label>
              <input
                type="date"
                value={form.week_end}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                Time shift
              </label>
              <select
                value={form.shift_template}
                onChange={(e) => {
                  const [shiftStart, shiftEnd] = e.target.value.split("|");
                  setForm((p) => ({
                    ...p,
                    shift_template: e.target.value,
                    shift_start_time: shiftStart || "",
                    shift_end_time: shiftEnd || "",
                  }));
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                <option value="">Select time shift...</option>
                {SHIFT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl font-black bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave?.(form)}
            className="px-6 py-3 rounded-xl font-black bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? "Saving..." : "Save schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}