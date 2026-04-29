import { isEmployerRole } from "./roles";

export function matchesEmployerScope(viewerProfile, targetProfile) {
  if (!viewerProfile) return true;
  if (!isEmployerRole(viewerProfile.role)) return true;

  const viewerEmployerCode = String(viewerProfile.employer_code ?? "").trim();
  const targetEmployerCode = String(targetProfile?.employer_code ?? "").trim();

  if (!viewerEmployerCode) return false;
  return targetEmployerCode === viewerEmployerCode;
}
