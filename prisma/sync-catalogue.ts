/**
 * Idempotent reference-data sync — safe to run on every deploy (production included).
 *  1. Offering catalogue from src/content/catalogue.ts
 *  2. The INTERNAL Azentio organisation (required for employee provisioning)
 *  3. Playground scenarios (synthetic sandbox definitions) from src/server/playground/scenarios.ts
 *  4. Optional bootstrap of the first super administrator (BOOTSTRAP_SUPER_ADMIN_EMAIL),
 *     only for an existing, email-verified account. Never creates users or passwords.
 */
import { OFFERINGS } from "../src/content/catalogue";
import { createScriptClient } from "./script-client";

const db = createScriptClient();

async function main() {
  for (const [i, o] of OFFERINGS.entries()) {
    const data = {
      name: o.name,
      category: o.category,
      industry: o.industry,
      summary: o.summary,
      description: o.description,
      sandbox: o.sandbox,
      isPublic: true,
      sortOrder: i,
    };
    await db.offering.upsert({ where: { slug: o.slug }, update: data, create: { slug: o.slug, ...data } });
  }
  console.log(`✓ ${OFFERINGS.length} offerings synced`);

  const internal = await db.organisation.upsert({
    where: { slug: "azentio" },
    update: {},
    create: {
      slug: "azentio",
      name: "Azentio",
      type: "INTERNAL",
      industry: "cross-industry",
      description: "Azentio employee workspace.",
    },
  });
  console.log("✓ internal organisation present");

  // Loaded dynamically so this script still runs if the playground module is absent.
  const scenariosPath = "../src/server/playground/scenarios";
  let scenarios: {
    slug: string;
    offeringSlug: string;
    name: string;
    description: string;
    engine: string;
    inputs: unknown;
    audience: "EMPLOYEE" | "CLIENT_ENTITLED";
  }[] = [];
  try {
    scenarios = (await import(scenariosPath)).PLAYGROUND_SCENARIOS ?? [];
  } catch (err) {
    console.warn("! playground scenarios module not loaded:", (err as Error).message);
  }
  for (const s of scenarios) {
    const offering = await db.offering.findUnique({ where: { slug: s.offeringSlug } });
    if (!offering) {
      console.warn(`! scenario ${s.slug}: unknown offering ${s.offeringSlug}`);
      continue;
    }
    const data = {
      offeringId: offering.id,
      name: s.name,
      description: s.description,
      engine: s.engine,
      inputs: s.inputs as object,
      audience: s.audience,
    };
    await db.playgroundScenario.upsert({ where: { slug: s.slug }, update: data, create: { slug: s.slug, ...data } });
  }
  console.log(`✓ ${scenarios.length} playground scenarios synced`);

  const bootstrap = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (bootstrap) {
    const user = await db.user.findUnique({ where: { email: bootstrap } });
    if (!user || !user.emailVerifiedAt) {
      console.warn(`! bootstrap skipped: ${bootstrap} must sign up and verify their email first`);
    } else {
      for (const role of ["SUPER_ADMIN", "PORTAL_ADMIN"] as const) {
        const existing = await db.roleGrant.findFirst({ where: { userId: user.id, role, revokedAt: null } });
        if (!existing) await db.roleGrant.create({ data: { userId: user.id, role, reason: "Bootstrap (BOOTSTRAP_SUPER_ADMIN_EMAIL)" } });
      }
      if (bootstrap.endsWith(`@${(process.env.EMPLOYEE_EMAIL_DOMAIN ?? "azentio.com").toLowerCase()}`)) {
        await db.membership.upsert({
          where: { userId_organisationId: { userId: user.id, organisationId: internal.id } },
          update: { status: "ACTIVE", role: "OWNER" },
          create: { userId: user.id, organisationId: internal.id, role: "OWNER", status: "ACTIVE", termsAcceptedAt: new Date(), learningNoticeAckAt: new Date() },
        });
      }
      await db.auditEvent.create({ data: { actorId: null, action: "role.bootstrap", entityType: "User", entityId: user.id, metadata: { roles: ["SUPER_ADMIN", "PORTAL_ADMIN"] } } });
      console.log(`✓ bootstrap super admin ensured for ${bootstrap}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
