import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { AppError, type ErrorBody } from "@/lib/api/errors";
import { getActor, type Actor } from "@/lib/authz/actor";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** CSRF defence for cookie-authenticated mutations: the Origin must be this site. */
function assertSameOrigin(req: NextRequest) {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross-site POSTs; allow non-browser clients without cookies only.
    if (req.cookies.size === 0) return;
    throw new AppError("forbidden", "Missing Origin header.");
  }
  const allowed = new Set([new URL(env().AUTH_URL).origin, req.nextUrl.origin]);
  if (!allowed.has(origin)) throw new AppError("forbidden", "Cross-site request blocked.");
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message, details: err.details } };
    const headers: Record<string, string> = {};
    const retry = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
    if (err.code === "rate_limited" && retry) headers["Retry-After"] = String(retry);
    return NextResponse.json(body, { status: err.status, headers });
  }
  if (err instanceof ZodError) {
    const body: ErrorBody = {
      error: { code: "validation_failed", message: "Some fields are invalid.", details: z.flattenError(err).fieldErrors },
    };
    return NextResponse.json(body, { status: 422 });
  }
  log.error("Unhandled API error", { error: err });
  const body: ErrorBody = { error: { code: "internal", message: "Something went wrong. Please try again." } };
  return NextResponse.json(body, { status: 500 });
}

type Ctx<P> = { params: Promise<P> };

interface Options {
  /** Require a signed-in, active user (default true). */
  auth?: boolean;
}

interface HandlerArgs<P> {
  req: NextRequest;
  params: P;
  actor: Actor;
}

/**
 * Wraps a route handler: same-origin check for mutations, session resolution,
 * error mapping (no stack traces), and JSON responses.
 * `actor` is always resolved; when `auth: true` (default) an anonymous actor yields 401.
 */
export function withApi<P = Record<string, string>>(
  handler: (args: HandlerArgs<P>) => Promise<unknown>,
  options: Options = {},
) {
  const requireAuth = options.auth ?? true;
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      assertSameOrigin(req);
      const actor = await getActor();
      if (requireAuth && !actor.user) throw new AppError("unauthenticated", "Sign in required.");
      const params = ctx?.params ? await ctx.params : ({} as P);
      const result = await handler({ req, params, actor });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Parse a JSON body with a zod schema (throws ZodError → 422). */
export async function parseBody<T extends ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new AppError("bad_request", "Request body must be valid JSON.");
  }
  return schema.parse(json);
}

/** Parse URL search params with a zod schema. */
export function parseQuery<T extends ZodType>(req: NextRequest, schema: T): z.infer<T> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}
