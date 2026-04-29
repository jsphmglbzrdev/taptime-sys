const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sanitizePrefix(value, fallback) {
  const clean = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (clean.length >= 3) return clean.slice(0, 3);
  if (clean.length > 0) return clean.padEnd(3, "X");
  return fallback;
}

function randomChunk(length = 6) {
  let output = "";
  for (let index = 0; index < length; index += 1) {
    output += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return output;
}

export function generateEmployerCode(employerName = "") {
  return `${sanitizePrefix(employerName, "EMP")}${randomChunk(7)}`;
}

export function generateDepartmentCode({
  employerCode = "",
  departmentName = "",
} = {}) {
  const employerPrefix = sanitizePrefix(employerCode, "EMP");
  const departmentPrefix = sanitizePrefix(departmentName, "DEP");
  return `${employerPrefix}${departmentPrefix}${randomChunk(4)}`;
}
