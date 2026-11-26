import { PARENT_BRAND, PRODUCT_NAME, PUBLIC_DESCRIPTION, TAGLINE } from '@allov/shared';
import { Logo } from '../components/logo';

/** The public page. It states only what is true: a product in development. */
export function PublicHomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="px-6 py-5">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">{PRODUCT_NAME}</h1>
        <p className="mt-3 font-display text-xl text-ink">{TAGLINE}</p>
        <p className="mt-6 max-w-prose text-base text-muted">{PUBLIC_DESCRIPTION}</p>
      </main>
      <footer className="px-6 py-6 text-center text-sm text-muted">{PARENT_BRAND}</footer>
    </div>
  );
}
