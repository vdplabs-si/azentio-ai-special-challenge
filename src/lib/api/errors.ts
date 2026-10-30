export type ErrorCode =
  | "bad_request"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "rate_limited"
  | "unavailable"
  | "payload_too_large"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  validation_failed: 422,
  rate_limited: 429,
  internal: 500,
  unavailable: 503,
};

/** Throw from services; withApi() maps it to a consistent JSON error response. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const unauthenticated = (msg = "Sign in required.") => new AppError("unauthenticated", msg);
export const forbidden = (msg = "You do not have permission to perform this action.") => new AppError("forbidden", msg);
/** Use for resources the actor may not see — avoids confirming existence (anti-IDOR). */
export const notFound = (msg = "Not found.") => new AppError("not_found", msg);
export const conflict = (msg: string) => new AppError("conflict", msg);
export const badRequest = (msg: string, details?: unknown) => new AppError("bad_request", msg, details);
export const unavailable = (msg: string) => new AppError("unavailable", msg);

export interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}
