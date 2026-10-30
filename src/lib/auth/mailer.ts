import "server-only";
import { env, emailProviderConfigured } from "@/lib/env";
import { unavailable } from "@/lib/api/errors";
import { log } from "@/lib/log";

export interface MailResult {
  /** "resend" when the provider accepted the message; "dev-log" when only printed locally. */
  transport: "resend" | "dev-log";
  accepted: boolean;
}

/**
 * Sends a transactional email through Resend when RESEND_API_KEY is set.
 * Development without a provider prints the message to the server console, clearly
 * labelled — it is never reported as delivered. Production without a provider refuses.
 */
export async function sendMail(msg: { to: string; subject: string; text: string }): Promise<MailResult> {
  if (emailProviderConfigured()) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env().EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      log.error("Email provider rejected message", { status: res.status });
      throw unavailable("We couldn't send the email right now. Please try again shortly.");
    }
    return { transport: "resend", accepted: true };
  }
  if (env().NODE_ENV === "production") {
    throw unavailable("Email delivery is not configured on this deployment (RESEND_API_KEY).");
  }
  console.log(
    `\n──────── [DEV MAIL — not delivered; no RESEND_API_KEY] ────────\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n──────────────────────────────────────────────────────────────\n`,
  );
  return { transport: "dev-log", accepted: false };
}
