import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "react-toastify";
import { supabase } from "../../../utils/supabase";
import ManageShiftModal from "../../../components/admin/ManageShiftModal";
import { formatShiftTimeLabel } from "../../../utils/shiftSchedule";

function formatEmployeeName(emp) {
  if (!emp) return "-";
  const name = `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim();
  return name || emp.email || emp.auth_id || "-";
}

function formatShiftRange(start, end) {
  if (!start && !end) return "-";
  if (start && end) return `${start} - ${end}`;
  return start || end || "-";
}

export default function ManageShift() {
  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isManageShiftOpen, setIsManageShiftOpen] = useState(false);
  const [prefillEmployeeId, setPrefillEmployeeId] = useState("");

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
      setRows(res.data ?? []);
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

  const handleSave = useCallback(
    async (payload) => {
      setIsSaving(true);
      try {
        // Send only DB columns to avoid 400 errors from extra UI-only fields.
        const safePayload = {
          employee_auth_id: payload.employee_auth_id,
          week_start: payload.week_start,
          week_end: payload.week_end,
          shift_start_time: payload.shift_start_time,
          shift_end_time: payload.shift_end_time,
        };

        let saveError = null;
        const upsertRes = await supabase
          .from("employee_weekly_shifts")
          .upsert(safePayload, { onConflict: "employee_auth_id,week_start" });
        saveError = upsertRes.error;

        // Fallback when unique constraint for onConflict is not created yet.
        if (saveError) {
          const checkRes = await supabase
            .from("employee_weekly_shifts")
            .select("id")
            .eq("employee_auth_id", safePayload.employee_auth_id)
            .eq("week_start", safePayload.week_start)
            .maybeSingle();
          if (checkRes.error) throw checkRes.error;

          if (checkRes.data?.id) {
            const updateRes = await supabase
              .from("employee_weekly_shifts")
              .update(safePayload)
              .eq("id", checkRes.data.id);
            if (updateRes.error) throw updateRes.error;
          } else {
            const insertRes = await supabase
              .from("employee_weekly_shifts")
              .insert(safePayload);
            if (insertRes.error) throw insertRes.error;
          }
        }

        toast.success("Weekly shift saved.");
        setIsManageShiftOpen(false);
        setPrefillEmployeeId("");
        await loadWeeklyShifts();
      } catch (err) {
        toast.error(err?.message || "Failed to save shift schedule.");
      } finally {
        setIsSaving(false);
      }
    },
    [loadWeeklyShifts]
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
            setPrefillEmployeeId("");
            setIsManageShiftOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all cursor-pointer"
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
              {rows.map((r) => {

                const formattedTime = `${formatShiftTimeLabel(r.shift_start_time)} - ${formatShiftTimeLabel(r.shift_end_time)}`;
                console.log("Formatted Time : ", formattedTime)

                const emp = employeesById.get(r.employee_auth_id);
                return (
                  <tr key={r.id} className="text-sm">
                    <td className="px-6 py-4 font-bold text-gray-700">
                      {formatEmployeeName(emp)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{r.week_start}</td>
                    <td className="px-6 py-4 text-gray-500">{r.week_end}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {formattedTime}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setPrefillEmployeeId(r.employee_auth_id || "");
                          setIsManageShiftOpen(true);
                        }}
                        className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!isLoading && rows.length === 0 && (
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
          setPrefillEmployeeId("");
        }}
        employees={employees}
        prefillEmployeeId={prefillEmployeeId}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
}