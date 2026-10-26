import Link from "next/link";
import { KeyRound, Receipt, Dumbbell, FolderOpen } from "lucide-react";
import { auth } from "@/auth";
import { getDashboardSummary } from "@/lib/dashboard/queries";
import { getMusicDashboard } from "@/lib/music/dashboard";
import { DashboardMusic } from "@/components/music/dashboard-music";
import { getUsage } from "@/lib/files/queries";
import { formatBytes } from "@/lib/files/names";

export default async function DashboardPage() {
  const session = await auth();
  const [summary, music, files] = await Promise.all([
    getDashboardSummary(session!.user.id),
    getMusicDashboard(session!.user.id),
    getUsage(session!.user.id),
  ]);

  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(summary.receiptsThisMonthTotal);

  const cards = [
    {
      href: "/passwords",
      icon: KeyRound,
      label: "Passwords stored",
      value: summary.passwordCount,
      sub: "in your vault",
    },
    {
      href: "/receipts",
      icon: Receipt,
      label: "Receipts this month",
      value: summary.receiptsThisMonthCount,
      sub: `${currency} total`,
    },
    {
      href: "/fitness",
      icon: Dumbbell,
      label: "Workouts this week",
      value: summary.workoutsThisWeekCount,
      sub: "logged in the last 7 days",
    },
    {
      href: "/files",
      icon: FolderOpen,
      label: "Files stored",
      value: files.fileCount.toLocaleString(),
      sub: `${formatBytes(files.totalBytes)} used`,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
      <DashboardMusic data={music} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
          >
            <card.icon className="mb-2 h-5 w-5 text-neutral-400" />
            <p className="text-2xl font-semibold">{card.value}</p>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {card.label}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{card.sub}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
