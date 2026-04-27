import QRCode from "qrcode";

export const EMPLOYEE_CODE_LENGTH = 7;
export const ATTENDANCE_QR_TYPE = "taptime-attendance";

export function normalizeEmployeeCode(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, EMPLOYEE_CODE_LENGTH);
}

export function isValidEmployeeCode(value) {
  return new RegExp(`^\\d{${EMPLOYEE_CODE_LENGTH}}$`).test(
    String(value ?? ""),
  );
}

export function generateRandomEmployeeCode() {
  return Array.from({ length: EMPLOYEE_CODE_LENGTH }, () =>
    Math.floor(Math.random() * 10),
  ).join("");
}

export function buildAttendanceQrPayload(employeeCode) {
  return JSON.stringify({
    type: ATTENDANCE_QR_TYPE,
    employeeCode: normalizeEmployeeCode(employeeCode),
  });
}

export function parseAttendanceQrPayload(rawValue) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    return { success: false, error: "QR code is empty." };
  }

  if (isValidEmployeeCode(raw)) {
    return { success: true, employeeCode: raw };
  }

  try {
    const parsed = JSON.parse(raw);
    const employeeCode = normalizeEmployeeCode(parsed?.employeeCode);
    if (parsed?.type !== ATTENDANCE_QR_TYPE || !isValidEmployeeCode(employeeCode)) {
      return { success: false, error: "Unrecognized attendance QR code." };
    }
    return { success: true, employeeCode };
  } catch {
    return { success: false, error: "Invalid attendance QR code." };
  }
}

export async function generateAttendanceQrSvg(employeeCode) {
  const payload = buildAttendanceQrPayload(employeeCode);
  const svg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
    color: {
      dark: "#1f2937",
      light: "#ffffff",
    },
  });

  return {
    employeeCode: normalizeEmployeeCode(employeeCode),
    payload,
    svg,
  };
}

export function downloadAttendanceQrSvg(svgMarkup, employeeCode) {
  if (!svgMarkup || typeof window === "undefined") return;

  const blob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-qr-${normalizeEmployeeCode(employeeCode)}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}
