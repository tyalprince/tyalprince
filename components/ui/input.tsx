import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  // iOS Safari gives date/time inputs an intrinsic min-width that overflows
  // narrow mobile cards; reset it so they respect w-full.
  const isDateLike = props.type === "date" || props.type === "time" || props.type === "datetime-local";
  return (
    <input
      className={cn(
        isDateLike && "block min-w-0 max-w-full appearance-none text-left",
        "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400",
        className,
      )}
      {...props}
    />
  );
}
