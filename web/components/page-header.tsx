export function PageHeader({ title, helper }: { title: string; helper: string }) {
  return (
    <header className="mb-6">
      {/* On wide screens the top bar shows the title, so only one heading is ever visible. */}
      <h1 className="font-display text-2xl font-semibold text-ink lg:hidden">{title}</h1>
      <p className="mt-1 text-base text-muted">{helper}</p>
    </header>
  );
}
