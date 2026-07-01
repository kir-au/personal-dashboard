import { redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { auth, isAuthConfigured, signIn } from '@/auth';

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'var(--background)',
} satisfies CSSProperties;

const cardStyle = {
  width: 'min(100%, 440px)',
  minWidth: '320px',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--surface)',
  padding: '24px',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
} satisfies CSSProperties;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = isAuthConfigured ? await auth() : null;
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl || '/';

  if (!isAuthConfigured) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              PD
            </div>
            <div>
              <h1 className="text-lg font-semibold text-on-surface">Personal Dashboard</h1>
              <p className="text-sm text-on-surface-variant">Authentication is not configured yet.</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Add Google OAuth credentials and an auth secret to enable sign-in. Until then, local access stays open for
            development.
          </p>
          <pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-variant p-3 text-xs text-on-surface">
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
          </pre>
          <a
            href="/"
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-on-surface-variant hover:bg-hover"
          >
            Back to dashboard
          </a>
        </section>
      </main>
    );
  }

  if (session) redirect(callbackUrl);

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            PD
          </div>
          <div>
            <h1 className="text-lg font-semibold text-on-surface">Sign in to Personal Dashboard</h1>
            <p className="text-sm text-on-surface-variant">Use your Google account to access the vault surface.</p>
          </div>
        </div>
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: callbackUrl });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Continue with Google
          </button>
        </form>
      </section>
    </main>
  );
}
