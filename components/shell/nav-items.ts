import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, KeyRound, Receipt, Dumbbell, Music, FolderOpen } from "lucide-react";

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
  { href: "/music", label: "Music", icon: Music },
  { href: "/files", label: "Files", icon: FolderOpen },
];
