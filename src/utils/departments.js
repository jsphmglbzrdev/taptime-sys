export const CUSTOM_DEPARTMENT_VALUE = "__custom__";

export const PREDEFINED_DEPARTMENTS = [
  "Human Resources",
  "Operations",
  "Finance",
  "Information Technology",
  "Sales",
  "Marketing",
  "Customer Support",
  "Logistics",
  "Procurement",
  "Administration",
];

export function isPredefinedDepartment(value) {
  return PREDEFINED_DEPARTMENTS.includes(String(value ?? "").trim());
}

export function normalizeDepartmentValue({
  selectedDepartment,
  customDepartment,
}) {
  const selected = String(selectedDepartment ?? "").trim();
  const custom = String(customDepartment ?? "").trim();

  if (selected === CUSTOM_DEPARTMENT_VALUE) return custom;
  return selected;
}
