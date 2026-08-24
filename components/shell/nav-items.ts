import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, KeyRound, Receipt, Dumbbell } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/passwords", label: "Passwords", icon: KeyRound },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/fitness", label: "Fitness", icon: Dumbbell },
];
