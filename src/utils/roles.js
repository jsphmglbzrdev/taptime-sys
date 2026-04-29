export function isEmployerRole(role) {
  return role === "Employer" || role === "Admin";
}

export function getRoleLabel(role) {
  if (role === "Admin") return "Employer";
  return role ?? "";
}
