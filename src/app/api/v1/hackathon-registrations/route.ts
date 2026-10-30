import { Prisma } from "@/generated/prisma/client";
import { withApi } from "@/lib/api/handler";
import { AppError, conflict } from "@/lib/api/errors";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { hackathonRegistrationSchema } from "@/components/site/forms/schemas";
import {
  honeypotTriggered,
  notifyPortalAdmins,
  openHackathonWhere,
  readPublicJson,
} from "@/server/services/public-content";

export const dynamic = "force-dynamic";

const ALREADY_REGISTERED = "You're already registered for this hackathon with this email address.";
const NOT_OPEN = "This hackathon is not open for registration.";

/**
 * Public hackathon interest registration. Anonymous; the event must exist and be open
 * (registrationOpen and not yet ended). One registration per (event, email) → 409 on repeat.
 */
export const POST = withApi(
  async ({ req }) => {
    await rateLimit(`hackathon:${clientIp(req.headers)}`, 10, 3600);

    const raw = await readPublicJson(req);
    if (honeypotTriggered(raw)) {
      log.info("hackathon_registration.honeypot_triggered");
      return { ok: true };
    }

    const input = hackathonRegistrationSchema.parse(raw);
    await rateLimit(`hackathon:email:${input.email}`, 5, 3600);

    const event = await db.hackathonEvent.findFirst({
      where: { id: input.eventId, ...openHackathonWhere() },
      select: { id: true, name: true },
    });
    if (!event) throw new AppError("validation_failed", NOT_OPEN, { eventId: [NOT_OPEN] });

    const existing = await db.hackathonRegistration.findUnique({
      where: { eventId_email: { eventId: event.id, email: input.email } },
      select: { id: true },
    });
    if (existing) throw conflict(ALREADY_REGISTERED);

    let registration: { id: string };
    try {
      registration = await db.$transaction(async (tx) => {
        const created = await tx.hackathonRegistration.create({
          data: {
            eventId: event.id,
            name: input.name,
            email: input.email,
            organisation: input.organisation || null,
            participantType: input.participantType,
            teamName: input.teamName || null,
            ideaSummary: input.ideaSummary || null,
            consentContact: input.consentContact,
          },
          select: { id: true },
        });
        await audit(
          {
            actorId: null,
            action: "hackathon_registration.create",
            entityType: "HackathonRegistration",
            entityId: created.id,
            metadata: { eventId: event.id, participantType: input.participantType },
          },
          tx,
        );
        return created;
      });
    } catch (err) {
      // Lost a race with a concurrent identical registration.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw conflict(ALREADY_REGISTERED);
      throw err;
    }

    await notifyPortalAdmins({
      type: "hackathon.registration.new",
      title: "New hackathon registration",
      body: `${input.name}${input.organisation ? ` (${input.organisation})` : ""} registered for ${event.name}`,
      link: "/portal/admin/inquiries?tab=hackathon",
    });

    return { ok: true, id: registration.id };
  },
  { auth: false },
);
