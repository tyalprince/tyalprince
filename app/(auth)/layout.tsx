export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Life OS
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Passwords, receipts, and fitness — all in one place.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
