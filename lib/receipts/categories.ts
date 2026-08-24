export const DEFAULT_EXPENSE_CATEGORIES = [
  "Vehicle/Mileage",
  "Meals & Entertainment",
  "Equipment/Supplies",
  "Payroll",
  "Travel",
  "Software/Subscriptions",
  "Utilities",
  "Professional Services",
  "Other",
] as const;

export type DefaultExpenseCategory = (typeof DEFAULT_EXPENSE_CATEGORIES)[number];
