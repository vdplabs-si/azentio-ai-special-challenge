import "server-only";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/api/errors";

/**
 * Run a service call from a page; resources the actor may not see (404/403 from services)
 * render the not-found page instead of leaking existence. Other errors reach error.tsx.
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
}
