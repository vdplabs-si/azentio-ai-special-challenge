import "server-only";
import { GitHub, Google } from "arctic";
import { env, oauthConfigured } from "@/lib/env";

export type OAuthProvider = "google" | "github";

const callback = (p: OAuthProvider) => `${env().AUTH_URL.replace(/\/$/, "")}/api/auth/oauth/${p}/callback`;

export function googleClient() {
  if (!oauthConfigured.google()) return null;
  return new Google(env().GOOGLE_CLIENT_ID!, env().GOOGLE_CLIENT_SECRET!, callback("google"));
}

export function githubClient() {
  if (!oauthConfigured.github()) return null;
  return new GitHub(env().GITHUB_CLIENT_ID!, env().GITHUB_CLIENT_SECRET!, callback("github"));
}

/** Public, non-secret status for the sign-in page. */
export function providerStatus() {
  return { google: oauthConfigured.google(), github: oauthConfigured.github() };
}

/** Only allow same-site relative redirect targets after sign-in. */
export function safeNext(next: string | null | undefined, fallback = "/portal") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next.slice(0, 300);
}

export interface GitHubIdentity {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
}

export async function fetchGitHubIdentity(accessToken: string): Promise<GitHubIdentity> {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "azentio.ai" };
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", { headers, signal: AbortSignal.timeout(10_000) }),
    fetch("https://api.github.com/user/emails", { headers, signal: AbortSignal.timeout(10_000) }),
  ]);
  if (!userRes.ok || !emailsRes.ok) throw new Error("github_profile_failed");
  const user = (await userRes.json()) as { id: number; login: string; name: string | null; avatar_url: string | null };
  const emails = (await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[];
  const primary = emails.find((e) => e.primary) ?? emails[0];
  if (!primary) throw new Error("github_no_email");
  return {
    id: String(user.id),
    name: user.name ?? user.login,
    email: primary.email,
    emailVerified: primary.verified,
    image: user.avatar_url,
  };
}
