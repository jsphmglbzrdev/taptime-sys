import { useCallback, useMemo, useRef, useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  Camera,
  CameraOff,
  ScanLine,
  UserRoundCheck,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { recordAttendanceByQr } from "../../utils/admin";
import { useAuth } from "../../context/AuthContext";

function formatScannedAt(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatActionLabel(action) {
  if (action === "clock_in") return "Clock In";
  if (action === "clock_out") return "Clock Out";
  if (action === "overtime_start") return "Overtime In";
  if (action === "overtime_end") return "Overtime Out";
  return "Attendance";
}

export default function QrAttendanceScannerPanel({
  onAttendanceRecorded,
  title = "QR Attendance Scanner",
  description = "Scan your attendance QR as an optional way to clock in or clock out.",
  idleHint = "Start the camera, then place your attendance QR inside the frame.",
  restrictToEmployeeCode = false,
  mode = "panel",
  isOpen = true,
  onClose = null,
}) {
  const { user } = useAuth();
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanSummary, setScanSummary] = useState(null);
  const lastScanRef = useRef({ rawValue: "", at: 0 });

  const actor = useMemo(
    () => ({
      auth_id: user?.id,
      email: user?.email,
      role: restrictToEmployeeCode ? "Employee" : "Admin",
    }),
    [restrictToEmployeeCode, user?.email, user?.id],
  );

  const showInlineHeading = mode !== "modal";

  const handleScan = useCallback(
    async (detectedCodes) => {
      const rawValue = detectedCodes?.[0]?.rawValue ?? "";
      if (!rawValue || isProcessing) return;

      const nowMs = Date.now();
      if (
        lastScanRef.current.rawValue === rawValue &&
        nowMs - lastScanRef.current.at < 2500
      ) {
        return;
      }

      lastScanRef.current = { rawValue, at: nowMs };
      setIsProcessing(true);

      try {
        const result = await recordAttendanceByQr({
          rawValue,
          actor,
          expectedAuthId: restrictToEmployeeCode ? user?.id : null,
        });
        if (!result.success) {
          toast.error(result.error || "Failed to record attendance.");
          return;
        }

        const employeeName =
          `${result.employee?.first_name ?? ""} ${result.employee?.last_name ?? ""}`.trim() ||
          result.employee?.email ||
          result.employee?.auth_id ||
          "Employee";

        setScanSummary({
          action: result.action,
          employeeCode: result.employeeCode,
          employeeName,
          scannedAt: result.scannedAt,
        });
        toast.success(`${employeeName} ${formatActionLabel(result.action).toLowerCase()} recorded via QR scan.`);
        await onAttendanceRecorded?.();
      } finally {
        setIsProcessing(false);
      }
    },
    [actor, isProcessing, onAttendanceRecorded, restrictToEmployeeCode, user?.id],
  );

  const scannerBody = (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {showInlineHeading ? (
          <div>
            <h3 className="text-lg font-black text-gray-800">{title}</h3>
            <p className="text-sm font-medium text-gray-500">{description}</p>
          </div>
        ) : (
          <div className="hidden lg:block" />
        )}

        <button
          type="button"
          onClick={() => setIsScannerActive((prev) => !prev)}
          className={`inline-flex items-center justify-center gap-2 self-start rounded-xl px-4 py-2 text-sm font-bold transition-all ${
            isScannerActive
              ? "border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {isScannerActive ? <CameraOff size={16} /> : <Camera size={16} />}
          {isScannerActive ? "Stop Scanner" : "Start Scanner"}
        </button>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-gray-50">
          {isScannerActive ? (
            <div className="relative mx-auto aspect-[4/3] min-h-[280px] w-full overflow-hidden bg-slate-950 sm:aspect-[1/1] sm:max-w-[30rem]">
              <div className="h-full w-full [&_*]:![transform:scaleX(-1)]">
                <Scanner
                  onScan={handleScan}
                  onError={(error) => {
                    toast.error(
                      error?.message || "Unable to access the QR scanner camera.",
                    );
                  }}
                  paused={isProcessing}
                  sound={false}
                  scanDelay={700}
                  allowMultiple={false}
                  constraints={{
                    facingMode: "environment",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    aspectRatio: { ideal: 1 },
                  }}
                />
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-44 w-44 rounded-3xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)] sm:h-52 sm:w-52" />
              </div>
            </div>
          ) : (
            <div className="flex aspect-[4/3] min-h-[280px] flex-col items-center justify-center px-6 text-center sm:aspect-[1/1] sm:max-w-[30rem] sm:mx-auto">
              <ScanLine size={28} className="text-gray-300" />
              <p className="mt-3 text-sm font-bold text-gray-600">
                Scanner is idle.
              </p>
              <p className="mt-1 text-xs font-medium text-gray-400">
                {idleHint}
              </p>
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-orange-100 bg-orange-50/50 p-4 xl:max-w-none">
          <div className="flex items-center gap-2 text-orange-600">
            <UserRoundCheck size={18} />
            <h4 className="text-sm font-black uppercase tracking-wider">
              Last Scan
            </h4>
          </div>

          {scanSummary ? (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Employee
                </p>
                <p className="text-base font-black text-gray-800">
                  {scanSummary.employeeName}
                </p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Employee ID
                </p>
                <p className="text-sm font-bold tracking-[0.18em] text-gray-700">
                  {scanSummary.employeeCode}
                </p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Recorded Action
                </p>
                <p className="text-sm font-bold text-gray-700">
                  {formatActionLabel(scanSummary.action)}
                </p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Scanned At
                </p>
                <p className="text-sm font-bold text-gray-700">
                  {formatScannedAt(scanSummary.scannedAt)}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-orange-200 bg-white px-4 py-6 text-center">
              <p className="text-sm font-bold text-gray-600">
                No scan recorded yet.
              </p>
              <p className="mt-1 text-xs font-medium text-gray-400">
                Successful scans will appear here with the attendance action taken.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (mode === "modal") {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
          onClick={onClose}
        />
        <div className="relative my-auto flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-gray-800">{title}</p>
              <p className="mt-1 text-sm font-medium text-gray-500">
                {description}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-gray-200 p-2 text-gray-500 transition-all hover:bg-gray-50 hover:text-gray-700"
            >
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto p-4 sm:p-6">{scannerBody}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      {scannerBody}
    </div>
  );
}
