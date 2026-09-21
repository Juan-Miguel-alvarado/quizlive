export function CenteredMessage({ title, message, children }: {
  title: string;
  message?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 pb-[calc(1.5rem+var(--badge-space))] text-center">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      {message && <p className="max-w-md text-lg text-ink-soft">{message}</p>}
      {children}
    </main>
  );
}
