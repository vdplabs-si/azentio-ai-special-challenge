/**
 * Cookie security follows the public origin, not NODE_ENV: an HTTPS AUTH_URL gets `Secure`
 * cookies and the `__Host-` prefix. Production refuses a non-HTTPS AUTH_URL unless it is a
 * loopback address (local `next start` / e2e), see src/lib/env.ts.
 * No `server-only` import: src/proxy.ts reads the cookie name too.
 */
const authUrl = process.env.AUTH_URL ?? "http://localhost:3000";

export const SECURE_COOKIES = authUrl.startsWith("https://");
export const SESSION_COOKIE = SECURE_COOKIES ? "__Host-az_session" : "az_session";
