import { Button } from "@/components/ui/button";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.2v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.2 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z" />
    </svg>
  );
}

/**
 * Real OAuth entry points. When a provider isn't configured the button is disabled
 * with an explanation — sign-in is never simulated.
 */
export function OAuthButtons({ status, next }: { status: { google: boolean; github: boolean }; next: string }) {
  const q = `?next=${encodeURIComponent(next)}`;
  const providers = [
    { id: "google", label: "Continue with Google", mark: <GoogleMark />, enabled: status.google, env: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET" },
    { id: "github", label: "Continue with GitHub", mark: <GitHubMark />, enabled: status.github, env: "GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET" },
  ];
  return (
    <div className="grid gap-2">
      {providers.map((p) =>
        p.enabled ? (
          <Button key={p.id} variant="outline" size="lg" className="h-10 w-full" asChild>
            <a href={`/api/auth/oauth/${p.id}${q}`}>
              {p.mark}
              {p.label}
            </a>
          </Button>
        ) : (
          <div key={p.id}>
            <Button variant="outline" size="lg" className="h-10 w-full" disabled aria-describedby={`${p.id}-cfg`}>
              {p.mark}
              {p.label}
            </Button>
            <p id={`${p.id}-cfg`} className="mt-1 text-[0.7rem] text-muted-foreground">
              Not configured on this deployment — set {p.env}.
            </p>
          </div>
        ),
      )}
    </div>
  );
}
