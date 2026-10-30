import { withApi } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { contactSchema } from "@/components/site/forms/schemas";
import { findOffering } from "@/components/site/catalogue";
import { honeypotTriggered, notifyPortalAdmins, readPublicJson } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

/**
 * Public demo request / contact form. Anonymous; rate limited per IP and per email.
 * Persists a DemoRequest, audits it and notifies portal admins in-app. No email is sent.
 */
export const POST = withApi(
  async ({ req }) => {
    await rateLimit(`contact:${clientIp(req.headers)}`, 5, 3600);

    const raw = await readPublicJson(req);
    if (honeypotTriggered(raw)) {
      // Look successful to the bot, persist nothing.
      log.info("contact.honeypot_triggered");
      return { ok: true };
    }

    const input = contactSchema.parse(raw); // ZodError → 422 with field details
    await rateLimit(`contact:email:${input.email}`, 3, 3600);

    const request = await db.$transaction(async (tx) => {
      const created = await tx.demoRequest.create({
        data: {
          name: input.name,
          email: input.email,
          company: input.company,
          jobTitle: input.jobTitle || null,
          country: input.country || null,
          interest: input.interest,
          message: input.message,
          consentContact: input.consentContact,
        },
        select: { id: true },
      });
      await audit(
        {
          actorId: null,
          action: "demo_request.create",
          entityType: "DemoRequest",
          entityId: created.id,
          metadata: { interest: input.interest },
        },
        tx,
      );
      return created;
    });

    const interest = input.interest === "general" ? "General enquiry" : (findOffering(input.interest)?.name ?? input.interest);
    await notifyPortalAdmins({
      type: "inquiry.new",
      title: "New demo request",
      body: `${input.name} (${input.company}) — ${interest}`,
      link: "/portal/admin/inquiries",
    });

    return { ok: true, id: request.id };
  },
  { auth: false },
);
