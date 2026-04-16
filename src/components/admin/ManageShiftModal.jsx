import React, { useEffect, useMemo, useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CUSTOM_SHIFT_VALUE = "custom";

function displayEmployee(emp) {
  const name = `${emp?.first_name ?? ""} ${emp?.last_name ?? ""}`.trim();
  return name || emp?.email || emp?.auth_id || "Unknown";
}

const SHIFT_OPTIONS = [
  { value: "07:00|16:00", label: "7:00 AM - 4:00 PM" },
  { value: "08:00|17:00", label: "8:00 AM - 5:00 PM" },
  { value: "09:00|18:00", label: "9:00 AM - 6:00 PM" },
  { value: "10:00|19:00", label: "10:00 AM - 7:00 PM" },
  { value: "11:00|20:00", label: "11:00 AM - 8:00 PM" },
];
const CUSTOM_TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  const value = `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
  const date = new Date(2026, 0, 1, hours, minutes);

  return {
    value,
    label: format(date, "h:mm aa"),
  };
});

function emptyForm() {
  return {
    id: null,
    employee_auth_id: "",
    week_start: "",
    week_end: "",
    shift_template: "",
    shift_start_time: "",
    shift_end_time: "",
  };
}

function isPresetShift(value) {
  return SHIFT_OPTIONS.some((option) => option.value === value);
}

function formatDateLabel(value) {
  if (!value) return "Pick a date";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Pick a date";
  return format(parsed, "PPP");
}

function normalizeTimeValue(value) {
  if (!value) return "";
  return value.slice(0, 5);
}

function toDateValue(value) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toYmd(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ManageShiftModal({
  isManageShiftOpen,
  onClose,
  employees = [],
  prefillData = null,
  /** auth_ids that already have a row in `employee_weekly_shifts` (for create flow) */
  employeeAuthIdsWithShift = [],
  onSave,
  isSaving = false,
}) {
  const [form, setForm] = useState(emptyForm);
  const blockedIds = useMemo(
    () => new Set(employeeAuthIdsWithShift ?? []),
    [employeeAuthIdsWithShift],
  );
  const isEdit = Boolean(prefillData?.id);

  const employeeOptions = useMemo(
    () =>
      (employees ?? [])
        .slice()
        .sort((a, b) => displayEmployee(a).localeCompare(displayEmployee(b))),
    [employees],
  );

  const selectableEmployees = useMemo(() => {
    if (isEdit) return employeeOptions;
    return employeeOptions.filter((emp) => !blockedIds.has(emp.auth_id));
  }, [employeeOptions, blockedIds, isEdit]);

  useEffect(() => {
    if (!isManageShiftOpen) return;

    if (prefillData?.id) {
      const shiftTemplate = `${prefillData.shift_start_time}|${prefillData.shift_end_time}`;
      setForm({
        id: prefillData.id,
        employee_auth_id: prefillData.employee_auth_id || "",
        week_start: prefillData.week_start || "",
        week_end: prefillData.week_end || "",
        shift_template: isPresetShift(shiftTemplate)
          ? shiftTemplate
          : CUSTOM_SHIFT_VALUE,
        shift_start_time: normalizeTimeValue(prefillData.shift_start_time),
        shift_end_time: normalizeTimeValue(prefillData.shift_end_time),
      });
    } else {
      setForm(emptyForm());
    }
  }, [isManageShiftOpen, prefillData]);

  if (!isManageShiftOpen) return null;

  const canSave =
    !!form.employee_auth_id &&
    !!form.week_start &&
    !!form.week_end &&
    !!form.shift_start_time &&
    !!form.shift_end_time &&
    !isSaving;
  const isCustomShift = form.shift_template === CUSTOM_SHIFT_VALUE;

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
            <div className="text-xs font-bold text-gray-400">
              Weekly shift template
            </div>
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
              <Select
                value={form.employee_auth_id || undefined}
                disabled={isEdit}
                onValueChange={(value) =>
                  setForm((p) => ({ ...p, employee_auth_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {(isEdit ? employeeOptions : selectableEmployees).map((emp) => (
                    <SelectItem key={emp.auth_id} value={emp.auth_id}>
                    {displayEmployee(emp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                Week start
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-12 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-bold text-gray-700 shadow-sm transition hover:border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  >
                    <span className={form.week_start ? "text-gray-700" : "text-gray-400"}>
                      {formatDateLabel(form.week_start)}
                    </span>
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={toDateValue(form.week_start)}
                    onSelect={(date) =>
                      setForm((p) => ({
                        ...p,
                        week_start: toYmd(date),
                      }))
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                Week end
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-12 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-bold text-gray-700 shadow-sm transition hover:border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  >
                    <span className={form.week_end ? "text-gray-700" : "text-gray-400"}>
                      {formatDateLabel(form.week_end)}
                    </span>
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={toDateValue(form.week_end)}
                    onSelect={(date) =>
                      setForm((p) => ({
                        ...p,
                        week_end: toYmd(date),
                      }))
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                Time shift
              </label>
              <Select
                value={form.shift_template || undefined}
                onValueChange={(value) => {
                  if (value === CUSTOM_SHIFT_VALUE) {
                    setForm((p) => ({
                      ...p,
                      shift_template: CUSTOM_SHIFT_VALUE,
                    }));
                    return;
                  }
                  const [shiftStart, shiftEnd] = value.split("|");
                  setForm((p) => ({
                    ...p,
                    shift_template: value,
                    shift_start_time: shiftStart || "",
                    shift_end_time: shiftEnd || "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time shift..." />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_SHIFT_VALUE}>
                    Customize Time Shift
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCustomShift && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                  Custom shift start
                </label>
                <Select
                  value={form.shift_start_time || undefined}
                  onValueChange={(value) =>
                    setForm((p) => ({
                      ...p,
                      shift_start_time: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select start time..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_TIME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-gray-600 uppercase tracking-wider">
                  Custom shift end
                </label>
                <Select
                  value={form.shift_end_time || undefined}
                  onValueChange={(value) =>
                    setForm((p) => ({
                      ...p,
                      shift_end_time: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select end time..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_TIME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
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
