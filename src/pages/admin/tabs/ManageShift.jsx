import React, { useCallback, useEffect, useMemo, useState } from "react";
import { History, Plus } from "lucide-react";
import { toast } from "react-toastify";
import { supabase } from "../../../utils/supabase";
import ManageShiftModal from "../../../components/admin/ManageShiftModal";
import ShiftHistoryModal from "../../../components/admin/ShiftHistoryModal";
import {
  formatShiftTimeLabel,
  normalizeTimeString,
} from "../../../utils/shiftSchedule";

function formatEmployeeName(emp) {
  if (!emp) return "-";
  const name = `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim();
  return name || emp.email || emp.auth_id || "-";
}

function pickLatestShiftPerEmployee(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.employee_auth_id;
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, r);
      continue;
    }
    const rank = (row) =>
      `${row.week_start ?? ""}\x00${row.created_at ?? ""}`;
    if (rank(r) > rank(prev)) map.set(key, r);
  }
  return Array.from(map.values());
}

export default function ManageShift() {
  const [employees, setEmployees] = useState([]);
  const [shiftRows, setShiftRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isManageShiftOpen, setIsManageShiftOpen] = useState(false);
  const [prefillShift, setPrefillShift] = useState(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);

  const employeesById = useMemo(() => {
    const map = new Map();
    for (const emp of employees) map.set(emp.auth_id, emp);
    return map;
  }, [employees]);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await supabase
        .from("user_profiles")
        .select("auth_id, first_name, last_name, email, role")
        .eq("role", "Employee")
        .order("created_at", { ascending: false });

      if (res.error) throw res.error;
      setEmployees(res.data ?? []);
    } catch (err) {
      toast.error("Failed to load employees.");
    }
  }, []);

  const loadWeeklyShifts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await supabase
        .from("employee_weekly_shifts")
        .select(
          `
          id,
          employee_auth_id,
          week_start,
          week_end,
          shift_start_time,
          shift_end_time,
          created_at
        `
        )
        .order("week_start", { ascending: false })
        .order("created_at", { ascending: false });

      if (res.error) throw res.error;
      setShiftRows(res.data ?? []);
    } catch (err) {
      toast.error(
        "Failed to load weekly shifts. (Make sure you created the `employee_weekly_shifts` table.)"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
    loadWeeklyShifts();
  }, [loadEmployees, loadWeeklyShifts]);

  const employeeAuthIdsWithShift = useMemo(
    () =>
      pickLatestShiftPerEmployee(shiftRows)
        .map((r) => r.employee_auth_id)
        .filter(Boolean),
    [shiftRows],
  );

  const displayRows = useMemo(() => {
    const deduped = pickLatestShiftPerEmployee(shiftRows);
    const nameOf = (authId) => {
      const emp = employees.find((e) => e.auth_id === authId);
      return formatEmployeeName(emp);
    };
    return deduped.sort((a, b) =>
      nameOf(a.employee_auth_id).localeCompare(nameOf(b.employee_auth_id)),
    );
  }, [shiftRows, employees]);

  const hasAssignableEmployee = useMemo(
    () => employees.some((e) => !employeeAuthIdsWithShift.includes(e.auth_id)),
    [employees, employeeAuthIdsWithShift],
  );

  const handleSave = useCallback(
    async (payload) => {
      setIsSaving(true);
      try {
        const safePayload = {
          employee_auth_id: payload.employee_auth_id,
          week_start: payload.week_start,
          week_end: payload.week_end,
          shift_start_time: payload.shift_start_time,
          shift_end_time: payload.shift_end_time,
        };

        if (payload.id) {
          const existingRes = await supabase
            .from("employee_weekly_shifts")
            .select("*")
            .eq("id", payload.id)
            .maybeSingle();
          if (existingRes.error) throw existingRes.error;
          if (!existingRes.data) throw new Error("Shift not found.");

          const prev = existingRes.data;
          const sameStart =
            normalizeTimeString(prev.shift_start_time) ===
            normalizeTimeString(safePayload.shift_start_time);
          const sameEnd =
            normalizeTimeString(prev.shift_end_time) ===
            normalizeTimeString(safePayload.shift_end_time);
          const hasChanges =
            prev.week_start !== safePayload.week_start ||
            prev.week_end !== safePayload.week_end ||
            !sameStart ||
            !sameEnd ||
            prev.employee_auth_id !== safePayload.employee_auth_id;

          if (hasChanges) {
            const histRes = await supabase
              .from("employee_weekly_shift_history")
              .insert({
                employee_auth_id: prev.employee_auth_id,
                week_start: prev.week_start,
                week_end: prev.week_end,
                shift_start_time: prev.shift_start_time,
                shift_end_time: prev.shift_end_time,
              });
            if (histRes.error) throw histRes.error;
          }

          const updateRes = await supabase
            .from("employee_weekly_shifts")
            .update(safePayload)
            .eq("id", payload.id);
          if (updateRes.error) throw updateRes.error;
        } else {
          const dupRes = await supabase
            .from("employee_weekly_shifts")
            .select("id")
            .eq("employee_auth_id", safePayload.employee_auth_id)
            .limit(1);
          if (dupRes.error) throw dupRes.error;
          if (dupRes.data?.length) {
            throw new Error(
              "This employee already has a shift. Use Edit to update it.",
            );
          }
          const insertRes = await supabase
            .from("employee_weekly_shifts")
            .insert(safePayload);
          if (insertRes.error) throw insertRes.error;
        }

        toast.success("Weekly shift saved.");
        setIsManageShiftOpen(false);
        setPrefillShift(null);
        await loadWeeklyShifts();
      } catch (err) {
        toast.error(err?.message || "Failed to save shift schedule.");
      } finally {
        setIsSaving(false);
      }
    },
    [loadWeeklyShifts],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">
            Manage Shift
          </h2>
          <p className="text-gray-500 text-sm font-medium">
            Create and update weekly shifts (Saturday to Friday)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!hasAssignableEmployee) {
              toast.info(
                "Every employee already has a shift. Use Edit to change one.",
              );
              return;
            }
            setPrefillShift(null);
            setIsManageShiftOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!hasAssignableEmployee && displayRows.length > 0}
        >
          <Plus size={18} />
          Manage Shift
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                <th className="px-6 py-3 font-bold">Employee</th>
                <th className="px-6 py-3 font-bold">Week Start</th>
                <th className="px-6 py-3 font-bold">Week End</th>
                <th className="px-6 py-3 font-bold">Shift Time</th>
                <th className="px-6 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr>
                  <td
                    className="px-6 py-10 text-gray-500 text-sm font-medium"
                    colSpan={5}
                  >
                    Loading shifts…
                  </td>
                </tr>
              )}

              {!isLoading &&
                displayRows.map((r) => {
                  const formattedTime = `${formatShiftTimeLabel(r.shift_start_time)} - ${formatShiftTimeLabel(r.shift_end_time)}`;

                  const emp = employeesById.get(r.employee_auth_id);
                  const name = formatEmployeeName(emp);
                  return (
                    <tr key={r.id} className="text-sm">
                      <td className="px-6 py-4 font-bold text-gray-700">
                        {name}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {r.week_start}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{r.week_end}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {formattedTime}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setPrefillShift(r);
                              setIsManageShiftOpen(true);
                            }}
                            className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryTarget({
                                authId: r.employee_auth_id,
                                label: name,
                              });
                              setHistoryOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-orange-500 hover:underline cursor-pointer"
                          >
                            <History size={14} aria-hidden />
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!isLoading && displayRows.length === 0 && (
                <tr>
                  <td
                    className="px-6 py-10 text-gray-400 text-sm font-medium"
                    colSpan={5}
                  >
                    No weekly shifts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ManageShiftModal
        isManageShiftOpen={isManageShiftOpen}
        onClose={() => {
          setIsManageShiftOpen(false);
          setPrefillShift(null);
        }}
        employees={employees}
        prefillData={prefillShift}
        employeeAuthIdsWithShift={employeeAuthIdsWithShift}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <ShiftHistoryModal
        isOpen={historyOpen}
        onClose={() => {
          setHistoryOpen(false);
          setHistoryTarget(null);
        }}
        employeeAuthId={historyTarget?.authId ?? ""}
        employeeLabel={historyTarget?.label ?? ""}
      />
    </div>
  );
}