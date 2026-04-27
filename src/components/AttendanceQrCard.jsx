import { Download, ScanLine } from "lucide-react";
import { downloadAttendanceQrSvg } from "../utils/attendanceQr";

export default function AttendanceQrCard({
  employeeCode,
  qrSvg,
  title = "Attendance QR",
  description = "Use this QR code as an optional way to clock in and clock out.",
}) {
  const hasQr = !!qrSvg && !!employeeCode;

  return (
    <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5">
      <div className="flex items-center gap-2 text-orange-600">
        <ScanLine size={18} />
        <h3 className="text-sm font-black uppercase tracking-wider">{title}</h3>
      </div>

      {hasQr ? (
        <>
          <div
            className="mx-auto mt-4 flex h-64 w-64 max-w-full items-center justify-center rounded-2xl bg-white p-4 shadow-sm"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />

          <div className="mt-4 space-y-1">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">
              Employee ID
            </p>
            <p className="text-lg font-black tracking-[0.2em] text-gray-800">
              {employeeCode}
            </p>
            <p className="text-xs font-medium text-gray-500">{description}</p>
          </div>

          <button
            type="button"
            onClick={() => downloadAttendanceQrSvg(qrSvg, employeeCode)}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
          >
            <Download size={16} />
            Download QR
          </button>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-orange-200 bg-white px-4 py-6 text-center">
          <p className="text-sm font-bold text-gray-600">
            Attendance QR is not available yet.
          </p>
          <p className="mt-1 text-xs font-medium text-gray-400">
            Create or refresh the employee QR configuration first.
          </p>
        </div>
      )}
    </div>
  );
}

