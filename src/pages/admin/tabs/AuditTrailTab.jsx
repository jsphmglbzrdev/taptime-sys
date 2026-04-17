import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCcw, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { listAuditTrailPage, clearAuditTrail } from "../../../utils/admin";
import ConfirmationBox from "../../../components/ConfirmationBox";

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,   
  });
}

function toneClasses(eventType) {
  if (eventType === "danger" || eventType === "error") {
    return "bg-red-50 text-red-600";
  }
  if (eventType === "warning") {
    return "bg-orange-50 text-orange-600";
  }
  return "bg-green-50 text-green-600";
}

export default function AuditTrailTab() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const loadAuditTrail = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const res = await listAuditTrailPage({ page, pageSize });
        if (!res.success) {
          toast.error(res.error || "Failed to load audit trail.");
          setRows([]);
          setTotalCount(0);
          return;
        }
        setRows(res.data ?? []);
        setTotalCount(res.count ?? 0);
        setCurrentPage(res.page ?? 1);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadAuditTrail(1);
  }, [loadAuditTrail]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleClearHistory = useCallback(async () => {
    setIsClearConfirmOpen(false);
    setIsClearing(true);
		console.log("Clearing audit trail...");
    try {
      const res = await clearAuditTrail();
      if (!res.success) {
        toast.error(res.error || "Failed to clear audit trail.");
        return;
      }
      toast.success("Audit trail cleared successfully.");
      setRows([]);
      setTotalCount(0);
      setCurrentPage(1);
    } finally {
      setIsClearing(false);
    }
  }, []);

  const summary = useMemo(
    () => ({
      total: totalCount,
      auth: rows.filter((row) => row.module === "auth").length,
      admin: rows.filter((row) => row.module === "admin").length,
      user: rows.filter((row) => row.module === "user").length,
    }),
    [rows, totalCount],
  );

  const handleExport = useCallback(() => {
    if (totalCount === 0) {
      toast.info("No audit trail records to export.");
      return;
    }

    setIsExporting(true);
    try {
      const data = rows.map((row) => ({
        Timestamp: formatDateTime(row.created_at),
        Module: row.module || "-",
        Action: row.action || "-",
        Event: row.event_type || "-",
        Description: row.description || "-",
        "Actor Name": row.actor_name || "-",
        "Actor Email": row.actor_email || "-",
        "Actor Role": row.actor_role || "-",
        "Target Name": row.target_name || "-",
        "Target Email": row.target_email || "-",
        "IP Address": row.ip_address || "-",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Audit Trail");
      XLSX.writeFile(
        wb,
        `audit-trail-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } catch {
      toast.error("Failed to export audit trail.");
    } finally {
      setIsExporting(false);
    }
  }, [totalCount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">
            Audit Trail
          </h2>
          <p className="text-gray-500 text-sm font-medium">
            Login activity, CRUD (Create, Read, Update, and Delete) events, and user actions across the system
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => loadAuditTrail(1)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold bg-white border border-gray-200 cursor-pointer hover:bg-gray-50 text-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={18} />
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isLoading || isExporting || totalCount === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold bg-orange-500 text-white cursor-pointer hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            {isExporting ? "Exporting..." : "Download Excel"}
          </button>
          {totalCount > 0 && (
            <button
              type="button"
              onClick={() => setIsClearConfirmOpen(true)}
              disabled={isLoading || isClearing}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold bg-red-500 text-white cursor-pointer hover:bg-red-600 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Trash2 size={18} />
              {isClearing ? "Clearing..." : "Clear History"}
            </button>
          )}
        </div>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">
            Total Events
          </p>
          <p className="mt-2 text-3xl font-black text-gray-800">{summary.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">
            Auth Events
          </p>
          <p className="mt-2 text-3xl font-black text-gray-800">{summary.auth}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">
            Admin Events
          </p>
          <p className="mt-2 text-3xl font-black text-gray-800">{summary.admin}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">
            User Events
          </p>
          <p className="mt-2 text-3xl font-black text-gray-800">{summary.user}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50/50">
                <th className="px-6 py-3 font-bold">Timestamp</th>
                <th className="px-6 py-3 font-bold">Module</th>
                <th className="px-6 py-3 font-bold">Action</th>
                <th className="px-6 py-3 font-bold">Description</th>
                <th className="px-6 py-3 font-bold">Actor</th>
                <th className="px-6 py-3 font-bold">Target</th>
                <th className="px-6 py-3 font-bold">IP Address</th>
                <th className="px-6 py-3 font-bold text-right">Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-gray-500 text-sm font-medium">
                    Loading audit trail...
                  </td>
                </tr>
              )}
              {!isLoading &&
                rows.map((row) => (
                  <tr key={row.id} className="text-sm align-top">
                    <td className="px-6 py-4 font-bold text-gray-700 whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {row.module || "-"}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {row.action || "-"}
                    </td>
                    <td className="px-6 py-4 text-gray-600 min-w-72">
                      {row.description || "-"}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="font-bold text-gray-700">
                        {row.actor_name || "-"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {row.actor_email || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="font-bold text-gray-700">
                        {row.target_name || "-"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {row.target_email || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium whitespace-nowrap">
                      {row.ip_address || "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold ${toneClasses(
                          row.event_type,
                        )}`}
                      >
                        {row.event_type || "info"}
                      </span>
                    </td>
                  </tr>
                ))}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-gray-400 text-sm font-medium">
                    No audit trail records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-600">
              Page {currentPage} of {totalPages} • Showing {rows.length} of {totalCount} records
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadAuditTrail(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 font-bold text-sm cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <button
                type="button"
                onClick={() => loadAuditTrail(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 font-bold text-sm cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
			
      {isClearConfirmOpen && (
        <ConfirmationBox
          isModalOpen={isClearConfirmOpen}
          setIsModalOpen={setIsClearConfirmOpen}
          title="Clear Audit Trail"
          description="Are you sure you want to delete all audit trail records? This action cannot be undone."
          buttonText="Clear All"
          handleAction={handleClearHistory}
        />
      )}
    </div>
  );
}
