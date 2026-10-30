/**
 * DEVELOPMENT-ONLY seed. Creates clearly labelled synthetic organisations, test accounts and
 * the Build Labs "seasonal SME cash flow" scenario so the moderation workflow can be demonstrated.
 * Refuses to run when NODE_ENV=production unless ALLOW_SEED=1. Run `npm run db:sync-catalogue` first.
 *
 * Passwords: SEED_PASSWORD if set (≥12 chars), otherwise one random password printed once.
 */
import { randomBytes } from "node:crypto";
import { argon2id } from "hash-wasm";
import type { MembershipRole, PlatformRole } from "../src/generated/prisma/enums";
import { createScriptClient } from "./script-client";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
  console.error("Refusing to seed a production environment. Set ALLOW_SEED=1 only for a disposable demo database.");
  process.exit(1);
}

const db = createScriptClient();
const password = process.env.SEED_PASSWORD && process.env.SEED_PASSWORD.length >= 12 ? process.env.SEED_PASSWORD : `Dev-${randomBytes(9).toString("base64url")}1`;
const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

async function user(email: string, name: string, title: string) {
  const passwordHash = await argon2id({ password, salt: randomBytes(16), parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32, outputType: "encoded" });
  return db.user.upsert({
    where: { email },
    update: { passwordHash, emailVerifiedAt: now, status: "ACTIVE" },
    create: { email, name, title, passwordHash, emailVerifiedAt: now },
  });
}

async function member(userId: string, organisationId: string, role: MembershipRole) {
  return db.membership.upsert({
    where: { userId_organisationId: { userId, organisationId } },
    update: { role, status: "ACTIVE" },
    create: { userId, organisationId, role, status: "ACTIVE", termsAcceptedAt: now, learningNoticeAckAt: now },
  });
}

async function grant(userId: string, role: PlatformRole) {
  const existing = await db.roleGrant.findFirst({ where: { userId, role, revokedAt: null } });
  if (!existing) await db.roleGrant.create({ data: { userId, role, reason: "[Dev seed]" } });
}

async function org(slug: string, name: string, industry: string, region: string) {
  return db.organisation.upsert({
    where: { slug },
    update: {},
    create: { slug, name, type: "CLIENT", industry, region, description: "Fictional organisation created by the development seed. Synthetic data only." },
  });
}

async function main() {
  const internal = await db.organisation.findUnique({ where: { slug: "azentio" } });
  if (!internal) throw new Error("Run `npm run db:sync-catalogue` before seeding.");
  const offering = async (slug: string) => (await db.offering.findUniqueOrThrow({ where: { slug } })).id;

  // ── People ───────────────────────────────────────────────
  const admin = await user("dev.admin@azentio.com", "Dev Admin (seed)", "Portal administrator");
  const moderator = await user("dev.moderator@azentio.com", "Dev Moderator (seed)", "Learning moderator");
  const productOwner = await user("dev.product@azentio.com", "Dev Product Owner (seed)", "Product owner — Financial Analysis Intelligence");
  const publisher = await user("dev.publisher@azentio.com", "Dev Publisher (seed)", "Content & broadcast publisher");
  const employee = await user("dev.employee@azentio.com", "Dev Employee (seed)", "Solutions engineer");
  for (const u of [admin, moderator, productOwner, publisher, employee]) await member(u.id, internal.id, u.id === admin.id ? "OWNER" : "MEMBER");
  await grant(admin.id, "SUPER_ADMIN");
  await grant(admin.id, "PORTAL_ADMIN");
  await grant(moderator.id, "LEARNING_MODERATOR");
  await grant(productOwner.id, "PRODUCT_OWNER");
  await grant(publisher.id, "CONTENT_PUBLISHER");
  await grant(publisher.id, "BROADCAST_PUBLISHER");

  const northwind = await org("northwind-bank", "Northwind Bank (synthetic)", "banking", "Middle East");
  const cedar = await org("cedar-takaful", "Cedar Takaful (synthetic)", "insurance", "South East Asia");
  const harbor = await org("harbor-microfinance", "Harbor Microfinance (synthetic)", "banking", "Africa");

  const nwAdmin = await user("admin@northwind.example", "Nadia Admin (seed)", "Head of credit operations");
  const nwAnalyst = await user("analyst@northwind.example", "Omar Analyst (seed)", "Credit analyst");
  const cedarAdmin = await user("admin@cedar.example", "Chen Admin (seed)", "Operations lead");
  const harborMember = await user("member@harbor.example", "Hana Member (seed)", "Portfolio manager");
  await member(nwAdmin.id, northwind.id, "ADMIN");
  await member(nwAnalyst.id, northwind.id, "MEMBER");
  await member(cedarAdmin.id, cedar.id, "OWNER");
  await member(harborMember.id, harbor.id, "MEMBER");

  // ── Entitlements (client-specific sandbox access) ───────
  const entitle = async (organisationId: string, slug: string) =>
    db.entitlement.upsert({
      where: { organisationId_offeringId: { organisationId, offeringId: await offering(slug) } },
      update: {},
      create: { organisationId, offeringId: await offering(slug), grantedById: admin.id },
    });
  await entitle(northwind.id, "sme-credit-decisioning");
  await entitle(northwind.id, "financial-analysis-intelligence");
  await entitle(northwind.id, "credit-strategy-simulator");
  await entitle(cedar.id, "riva");
  await entitle(harbor.id, "financial-analysis-intelligence");
  await entitle(harbor.id, "similar-portfolio-intelligence");

  // ── Build Labs scenario: three orgs observe seasonal SME cash-flow treatment ──
  const fai = await offering("financial-analysis-intelligence");
  const scenario = [
    {
      org: northwind, author: nwAnalyst, region: "Middle East",
      title: "Seasonal SME revenue dips flagged as deterioration",
      body: "Our analysts see quarter-on-quarter comparisons flag SMEs in agriculture-linked trade as deteriorating every Q3, although the dip is seasonal and recovers in Q4. Reviewers spend time overriding these flags manually. A seasonality-aware comparison would reduce false alerts.",
      evidence: "INTERNAL_ANALYSIS" as const, confidence: "MEDIUM" as const,
    },
    {
      org: cedar, author: cedarAdmin, region: "South East Asia",
      title: "Cash-flow covenant tests ignore festival-season peaks",
      body: "For SME policyholders with festival-season trading peaks, annualised cash-flow figures overstate risk in the off-season. Underwriters currently adjust with spreadsheets outside the system, which makes decisions hard to audit.",
      evidence: "CLIENT_FEEDBACK" as const, confidence: "LOW" as const,
    },
    {
      org: harbor, author: harborMember, region: "Africa",
      title: "Harvest-cycle borrowers compared against wrong baseline",
      body: "Microfinance borrowers on harvest cycles are compared to the previous month rather than the same period last year. This produces inconsistent treatment between similar borrowers depending on the application month.",
      evidence: "ANECDOTAL" as const, confidence: "MEDIUM" as const,
    },
  ];
  for (const s of scenario) {
    const exists = await db.observation.findFirst({ where: { organisationId: s.org.id, title: s.title } });
    if (exists) continue;
    const obs = await db.observation.create({
      data: {
        organisationId: s.org.id,
        authorId: s.author.id,
        type: "PRODUCT_GAP",
        title: s.title,
        body: s.body,
        offeringId: fai,
        industry: "banking",
        region: s.region,
        periodStart: new Date("2026-04-01"),
        periodEnd: new Date("2026-09-30"),
        evidenceType: s.evidence,
        confidence: s.confidence,
        topics: ["seasonality", "sme", "cash-flow"],
        links: [],
        status: "SUBMITTED",
        submittedAt: now,
        sensitiveFlags: [],
      },
    });
    await db.observationVersion.create({ data: { observationId: obs.id, version: 1, snapshot: { title: obs.title, body: obs.body } } });
    await db.sharingConsent.create({
      data: { observationId: obs.id, version: 1, userId: s.author.id, storeAndProcess: true, publishSharedVersion: true, attributeOrganisation: false, futureTraining: false },
    });
    await db.auditEvent.create({ data: { actorId: s.author.id, action: "observation.submit", entityType: "Observation", entityId: obs.id, organisationId: s.org.id, metadata: { seed: true } } });
  }
  // A private draft and an organisation-only note (must never reach moderators or other tenants).
  for (const d of [
    { title: "Draft: early notes on DSCR overrides", orgVisible: false },
    { title: "Team note: override log review cadence", orgVisible: true },
  ]) {
    const exists = await db.observation.findFirst({ where: { organisationId: northwind.id, title: d.title } });
    if (!exists)
      await db.observation.create({
        data: {
          organisationId: northwind.id, authorId: nwAnalyst.id, type: "OPERATIONAL_CHALLENGE", title: d.title,
          body: "Synthetic working note created by the development seed for demonstrating private and organisation-only visibility.",
          industry: "banking", region: "Middle East", periodStart: new Date("2026-07-01"), periodEnd: new Date("2026-09-30"),
          evidenceType: "ANECDOTAL", confidence: "LOW", topics: ["overrides"], links: [], orgVisible: d.orgVisible,
        },
      });
  }

  // ── Collaboration sample (synthetic) ─────────────────────
  let project = await db.project.findFirst({ where: { organisationId: northwind.id, name: "Seasonal cash-flow pilot (synthetic)" } });
  if (!project) {
    project = await db.project.create({
      data: {
        organisationId: northwind.id, name: "Seasonal cash-flow pilot (synthetic)", ownerId: nwAdmin.id, status: "ACTIVE",
        description: "Evaluate seasonality-aware comparisons in the Financial Analysis Intelligence sandbox using synthetic statements.",
        startsAt: days(-14), dueAt: days(30),
        members: { create: [{ userId: nwAdmin.id, role: "MANAGER" }, { userId: nwAnalyst.id, role: "CONTRIBUTOR" }] },
      },
    });
    await db.task.createMany({
      data: [
        { projectId: project.id, title: "Prepare synthetic statement set", status: "DONE", priority: "HIGH", assigneeId: nwAnalyst.id, createdById: nwAdmin.id, completedAt: days(-3), dueAt: days(-4) },
        { projectId: project.id, title: "Run Playground comparison and record feedback", status: "IN_PROGRESS", priority: "HIGH", assigneeId: nwAnalyst.id, createdById: nwAdmin.id, dueAt: days(3) },
        { projectId: project.id, title: "Summarise reviewer override reduction", status: "TODO", priority: "MEDIUM", assigneeId: nwAdmin.id, createdById: nwAdmin.id, dueAt: days(-1) },
      ],
    });
  }

  // ── Events & content (labelled dev seed) ─────────────────
  await db.hackathonEvent.upsert({
    where: { slug: "build-labs-dev-seed" },
    update: {},
    create: {
      slug: "build-labs-dev-seed", name: "azentio.ai Build Labs (dev seed event)", registrationOpen: true,
      description: "Development-seed hackathon event used to demonstrate registration and team spaces.",
      startsAt: days(14), endsAt: days(16),
    },
  });
  const contentSeeds = [
    { slug: "dev-seed-playground-guide", type: "KNOWLEDGE" as const, audience: "EMPLOYEE" as const, title: "Running a guided Playground demo (internal)", summary: "Internal checklist for synthetic-data demonstrations.", body: "1. Choose an offering\n2. Inspect the synthetic inputs\n3. Run the deterministic engine\n4. Review evidence with the client\n5. Capture structured feedback\n\nNever imply a sandbox output is an approved credit or business decision.", reviewDueAt: days(-2) },
    { slug: "dev-seed-release-notes", type: "RELEASE_NOTE" as const, audience: "CLIENT_ALL" as const, title: "Portal release notes (dev seed)", summary: "What's new in the collaboration portal.", body: "Observations now support explicit sharing choices and separate consent records.", reviewDueAt: null },
  ];
  for (const c of contentSeeds) {
    await db.contentItem.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, status: "PUBLISHED", ownerId: publisher.id, publishedAt: now },
    });
  }
  if (!(await db.liveSession.findFirst({ where: { title: "Internal demo clinic (dev seed)" } }))) {
    await db.liveSession.create({
      data: { title: "Internal demo clinic (dev seed)", description: "Employee-only walkthrough of the Playground scenarios.", startsAt: days(2), audience: "EMPLOYEE", createdById: publisher.id },
    });
    await db.liveSession.create({
      data: {
        title: "Northwind briefing webinar (dev seed)", description: "Invitation-only briefing for Northwind Bank (synthetic).", startsAt: days(5), audience: "CLIENT_ORGS",
        createdById: publisher.id, organisations: { create: [{ organisationId: northwind.id }] },
      },
    });
  }

  console.log("\n✓ Development seed complete. Test accounts (password below):");
  for (const e of ["dev.admin@azentio.com (super/portal admin)", "dev.moderator@azentio.com (learning moderator)", "dev.product@azentio.com (product owner)", "dev.publisher@azentio.com (content + broadcast publisher)", "dev.employee@azentio.com (employee, no grants)", "admin@northwind.example (client admin)", "analyst@northwind.example (client member)", "admin@cedar.example (client owner)", "member@harbor.example (client member)"])
    console.log("  •", e);
  console.log(process.env.SEED_PASSWORD ? "  password: (from SEED_PASSWORD)" : `  password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
