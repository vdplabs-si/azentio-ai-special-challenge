import { NextResponse, type NextRequest } from "next/server";
import { decodeIdToken } from "arctic";
import { fetchGitHubIdentity, githubClient, googleClient, safeNext } from "@/lib/auth/oauth";
import { requestEmployeeAccessIfEligible, upsertOAuthUser } from "@/lib/auth/accounts";
import { createSession } from "@/lib/auth/session";
import { safeEqual } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

function fail(reason: string) {
  const url = new URL("/login", env().AUTH_URL);
  url.searchParams.set("error", reason);
  const res = NextResponse.redirect(url);
  for (const c of ["oauth_state", "oauth_verifier", "oauth_next"]) res.cookies.delete(c);
  return res;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get("oauth_state")?.value;
  if (!code || !state || !storedState || !safeEqual(state, storedState)) return fail("oauth_state");

  try {
    let identity: { id: string; email: string; emailVerified: boolean; name: string; image: string | null };

    if (provider === "google") {
      const google = googleClient();
      const verifier = req.cookies.get("oauth_verifier")?.value;
      if (!google || !verifier) return fail("oauth_config");
      const tokens = await google.validateAuthorizationCode(code, verifier);
      // ID token received directly from Google's token endpoint over TLS (OIDC §3.1.3.7).
      const claims = decodeIdToken(tokens.idToken()) as {
        sub: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
        hd?: string;
      };
      if (!claims.email) return fail("oauth_email");
      identity = {
        id: claims.sub,
        email: claims.email,
        // An employee-domain address must also be asserted by the Workspace hosted domain claim.
        emailVerified:
          Boolean(claims.email_verified) &&
          (!claims.email.toLowerCase().endsWith(`@${env().EMPLOYEE_EMAIL_DOMAIN}`) || claims.hd === env().EMPLOYEE_EMAIL_DOMAIN),
        name: claims.name ?? claims.email,
        image: claims.picture ?? null,
      };
    } else if (provider === "github") {
      const github = githubClient();
      if (!github) return fail("oauth_config");
      const tokens = await github.validateAuthorizationCode(code);
      identity = await fetchGitHubIdentity(tokens.accessToken());
    } else {
      return fail("oauth_provider");
    }

    if (!identity.emailVerified) return fail("oauth_unverified");
    const user = await upsertOAuthUser({
      provider,
      providerAccountId: identity.id,
      email: identity.email,
      emailVerified: identity.emailVerified,
      name: identity.name,
      image: identity.image,
    });
    if (user.status !== "ACTIVE") return fail("account_deactivated");
    await requestEmployeeAccessIfEligible(user.id, user.email, true);
    await createSession(user.id, { userAgent: req.headers.get("user-agent") });
    await audit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, metadata: { method: provider } });

    const res = NextResponse.redirect(new URL(safeNext(req.cookies.get("oauth_next")?.value), env().AUTH_URL));
    for (const c of ["oauth_state", "oauth_verifier", "oauth_next"]) res.cookies.delete(c);
    return res;
  } catch (err) {
    log.warn("OAuth callback failed", { provider, error: err });
    return fail("oauth_failed");
  }
}
