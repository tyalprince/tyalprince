import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth-actions";
import { QuickGeneratorButton } from "@/components/password-generator/quick-generator-button";

export function Topbar({ userLabel }: { userLabel: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-sm text-neutral-500 dark:text-neutral-400">{userLabel}</div>
      <div className="flex items-center gap-2">
        <QuickGeneratorButton />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
