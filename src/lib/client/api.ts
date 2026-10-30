"use client";

/** Error thrown by apiFetch with the server's consistent error envelope. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
  /** Field errors from a 422 response, if any: `{ field: ["message"] }`. */
  get fieldErrors(): Record<string, string[]> {
    return this.code === "validation_failed" && this.details && typeof this.details === "object"
      ? (this.details as Record<string, string[]>)
      : {};
  }
}

/**
 * Same-origin JSON fetch for portal/client components. Sends cookies, sets JSON headers,
 * and throws ApiError for non-2xx responses so UIs can show real server errors.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const res = await fetch(path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: isForm ? undefined : { "Content-Type": "application/json", Accept: "application/json" },
    body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
    signal: init.signal,
  });
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "internal", err?.message ?? `Request failed (${res.status}).`, err?.details);
  }
  return json as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Human message for toasts. */
export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
