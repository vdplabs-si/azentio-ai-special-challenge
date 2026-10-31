import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie-policy";

/**
 * Fast-path redirect for signed-out visitors. This is a UX convenience only — every
 * portal page and API re-validates the session and permissions on the server.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*"],
};
