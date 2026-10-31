import { NextResponse, type NextRequest } from "next/server";
import { generateCodeVerifier, generateState } from "arctic";
import { githubClient, googleClient, safeNext } from "@/lib/auth/oauth";
import { SECURE_COOKIES } from "@/lib/auth/cookie-policy";
import { errorResponse } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";

const cookieOpts = {
  httpOnly: true,
  secure: SECURE_COOKIES,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

/** Starts a genuine OAuth 2.0 authorization-code flow (PKCE for Google). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await ctx.params;
    // Configuration is checked before any DB work so an unconfigured provider is always an honest 503.
    const google = provider === "google" ? googleClient() : null;
    const github = provider === "github" ? githubClient() : null;
    if (provider === "google" && !google) {
      throw new AppError("unavailable", "Google sign-in is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
    }
    if (provider === "github" && !github) {
      throw new AppError("unavailable", "GitHub sign-in is not configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET).");
    }
    if (!google && !github) throw new AppError("not_found", "Unknown sign-in provider.");

    await rateLimit(`oauth:${clientIp(req.headers)}`, 30, 600);
    const next = safeNext(req.nextUrl.searchParams.get("next"));
    const state = generateState();

    if (google) {
      const verifier = generateCodeVerifier();
      const url = google.createAuthorizationURL(state, verifier, ["openid", "email", "profile"]);
      url.searchParams.set("prompt", "select_account");
      const res = NextResponse.redirect(url);
      res.cookies.set("oauth_state", state, cookieOpts);
      res.cookies.set("oauth_verifier", verifier, cookieOpts);
      res.cookies.set("oauth_next", next, cookieOpts);
      return res;
    }
    const url = github!.createAuthorizationURL(state, ["read:user", "user:email"]);
    const res = NextResponse.redirect(url);
    res.cookies.set("oauth_state", state, cookieOpts);
    res.cookies.set("oauth_next", next, cookieOpts);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
