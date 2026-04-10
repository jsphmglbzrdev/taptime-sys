import {Download, X} from "lucide-react";


function formatTime(value) {
  if (!value) return "-";
  const raw = String(value).trim();
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function EmployeeLogsModal({
  isOpen,
  onClose,
  employee,
  rows,
  onExport,
  isExporting,
}) {
  if (!isOpen || !employee) return null;

  const displayName =
    `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
    employee.email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md"
        onClick={onClose}
      />

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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              {isExporting ? "Exporting..." : "Download Excel"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
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
                <th className="px-6 py-3 font-bold">
                  Morning Break Time (Time In)
                </th>
                <th className="px-6 py-3 font-bold">
                  Morning Break Time (Time Out)
                </th>
                <th className="px-6 py-3 font-bold">
                  Afternoon Break Time (Time In)
                </th>
                <th className="px-6 py-3 font-bold">
                  Afternoon Break Time (Time Out)
                </th>
                <th className="px-6 py-3 font-bold">
                  Lunch Break Time (Time In)
                </th>
                <th className="px-6 py-3 font-bold">
                  Lunch Break Time (Time Out)
                </th>
                <th className="px-6 py-3 font-bold">Clock Out</th>
                <th className="px-6 py-3 font-bold">Overtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.id} className="text-sm">
                  <td className="px-6 py-4 font-bold text-gray-700">
                    {r.shift_date}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatTime(r.clock_in_at)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatTime(r.morning_break_in_at)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatTime(r.morning_break_out_at)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatTime(r.afternoon_break_in_at)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatTime(r.afternoon_break_out_at)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatTime(r.lunch_break_in_at)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatTime(r.lunch_break_out_at)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatTime(r.clock_out_at)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {r.overtime_start && r.overtime_end
                      ? `${formatTime(r.overtime_start)} - ${formatTime(r.overtime_end)}`
                      : r.overtime_start
                        ? `${formatTime(r.overtime_start)} - Ongoing`
                        : "-"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-10 text-gray-400 text-sm font-medium"
                  >
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

export default EmployeeLogsModal;
