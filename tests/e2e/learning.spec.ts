import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";
import { apiLogin, USERS } from "./helpers";
import { Client } from "pg";

/** Read-only lookup in the isolated e2e schema (Playwright cannot load the ESM Prisma client). */
async function lookupId(table: "Offering" | "User", column: "slug" | "email", value: string) {
  const url = new URL(process.env.E2E_DATABASE_URL!);
  const schema = url.searchParams.get("schema")!;
  const ssl = url.searchParams.get("sslmode");
  for (const p of ["sslmode", "schema", "uselibpqcompat"]) url.searchParams.delete(p);
  const pg = new Client({ connectionString: url.toString(), ssl: ssl && ssl !== "disable" ? { rejectUnauthorized: false } : false });
  await pg.connect();
  try {
    const res = await pg.query(`SELECT id FROM "${schema}"."${table}" WHERE "${column}" = $1`, [value]);
    return res.rows[0].id as string;
  } finally {
    await pg.end();
  }
}

/**
 * The Build Labs end-to-end scenario: three fictional client organisations submit observations
 * about seasonal SME cash flow → a moderator returns one for clarification → the author amends →
 * the moderator publishes de-identified copies → a theme groups them → a product owner creates an
 * Under-review idea → clients see the shared theme and status but never drafts or moderation notes →
 * withdrawal removes a contribution from every shared read immediately.
 */
test.describe.configure({ mode: "serial" });

const TITLES = {
  northwind: "Seasonal SME revenue dips flagged as deterioration",
  cedar: "Cash-flow covenant tests ignore festival-season peaks",
  harbor: "Harvest-cycle borrowers compared against wrong baseline",
};
const INTERNAL_NOTE = "INTERNAL-ONLY moderator note e2e";

let baseURL: string;
const ctx: Record<string, APIRequestContext> = {};
async function as(user: keyof typeof USERS) {
  if (!ctx[user]) {
    ctx[user] = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
    await apiLogin(ctx[user], baseURL, USERS[user]);
  }
  return ctx[user];
}

const ids: Record<string, string> = {};
const shared: Record<string, string> = {};

test.beforeAll(({}, info) => {
  baseURL = info.project.use.baseURL!;
});
test.afterAll(async () => {
  for (const c of Object.values(ctx)) await c.dispose();
});

test("moderation queue holds submitted contributions but never private drafts", async () => {
  const mod = await as("moderator");
  const res = await mod.get("/api/v1/moderation/queue");
  expect(res.status()).toBe(200);
  const queue = (await res.json()) as { items: { id: string; title: string }[] };
  for (const [k, title] of Object.entries(TITLES)) {
    const item = queue.items.find((i) => i.title === title);
    expect(item, title).toBeTruthy();
    ids[k] = item!.id;
  }
  expect(queue.items.some((i) => i.title.startsWith("Draft:"))).toBe(false);

  // The analyst's private draft exists, but the moderator gets 404 on direct access.
  const analyst = await as("northwindAnalyst");
  const mine = (await (await analyst.get("/api/v1/observations?scope=mine")).json()) as { items: { id: string; title: string }[] };
  const draft = mine.items.find((i) => i.title.startsWith("Draft:"))!;
  expect(draft).toBeTruthy();
  expect((await mod.get(`/api/v1/moderation/observations/${draft.id}`)).status()).toBe(404);
  expect((await mod.get(`/api/v1/observations/${draft.id}`)).status()).toBe(404);
});

test("other tenants cannot read a client's private observation (IDOR)", async () => {
  const cedar = await as("cedarAdmin");
  expect((await cedar.get(`/api/v1/observations/${ids.northwind}`)).status()).toBe(404);
  const employee = await as("employee");
  expect((await employee.get(`/api/v1/observations/${ids.northwind}`)).status()).toBe(404);
});

test("moderator returns one contribution; the author is notified, amends and resubmits", async () => {
  const mod = await as("moderator");
  const ret = await mod.post(`/api/v1/moderation/observations/${ids.harbor}/decision`, {
    data: { action: "RETURN_FOR_CLARIFICATION", publicReason: "Please state the observation period more precisely.", internalNote: INTERNAL_NOTE },
  });
  expect(ret.status(), await ret.text()).toBe(200);

  const harbor = await as("harborMember");
  const notes = (await (await harbor.get("/api/v1/notifications")).json()) as { items: { title: string; body: string }[] };
  expect(notes.items.some((n) => /return|clarif/i.test(n.title + n.body))).toBe(true);

  const detail = await harbor.get(`/api/v1/observations/${ids.harbor}`);
  const text = await detail.text();
  expect(text).toContain("Please state the observation period more precisely.");
  expect(text).not.toContain(INTERNAL_NOTE);

  const resubmit = await harbor.post(`/api/v1/observations/${ids.harbor}/submit`, {
    data: { consent: { storeAndProcess: true, publishSharedVersion: true, attributeOrganisation: false, futureTraining: false } },
  });
  expect(resubmit.status(), await resubmit.text()).toBe(200);
});

test("moderator publishes de-identified shared copies", async () => {
  const mod = await as("moderator");
  for (const k of Object.keys(TITLES)) {
    const review = (await (await mod.get(`/api/v1/moderation/observations/${ids[k]}`)).json()) as Record<string, unknown>;
    const version = (review.version as number | undefined) ?? (review.observation as { version?: number } | undefined)?.version;
    const res = await mod.post(`/api/v1/moderation/observations/${ids[k]}/decision`, {
      data: {
        action: "PUBLISH",
        acknowledgedFlags: true,
        ...(version ? { version } : {}),
        sharedCopy: {
          title: TITLES[k as keyof typeof TITLES],
          body: "Seasonal cash-flow patterns are being compared against non-seasonal baselines, producing inconsistent treatment of similar SME borrowers across periods.",
          region: "Other",
          periodGranularity: "half",
          topics: ["seasonality", "sme"],
          attributeOrganisation: false,
        },
      },
    });
    expect(res.status(), await res.text()).toBe(200);
    shared[k] = ((await res.json()) as { sharedObservationId: string }).sharedObservationId;
  }
});

test("clients see shared copies without tenant, author or moderation data", async () => {
  const cedar = await as("cedarAdmin");
  const res = await cedar.get("/api/v1/shared-observations?q=seasonal&pageSize=50");
  expect(res.status()).toBe(200);
  const body = await res.text();
  const feed = JSON.parse(body) as { items: { id: string }[] };
  for (const k of Object.keys(TITLES)) expect(feed.items.some((i) => i.id === shared[k])).toBe(true);
  for (const forbidden of ["sourceObservationId", "organisationId", "authorId", INTERNAL_NOTE, "Northwind Bank", "Harbor Microfinance"]) {
    expect(body, forbidden).not.toContain(forbidden);
  }
  // Public visitors cannot read shared learning at all.
  const anon = await pwRequest.newContext({ baseURL });
  expect((await anon.get("/api/v1/shared-observations")).status()).toBe(401);
  await anon.dispose();
});

test("product owner groups evidence into a theme and creates an Under-review idea clients can follow", async () => {
  const offering = { id: await lookupId("Offering", "slug", "financial-analysis-intelligence") };
  const owner = { id: await lookupId("User", "email", USERS.product) };

  const po = await as("product");
  const theme = await po.post("/api/v1/themes", {
    data: {
      title: "Seasonality context",
      summary: "Several organisations report that seasonal SME cash flow is compared against non-seasonal baselines.",
      limitations: "Small sample of synthetic contributions; not evidence of market prevalence.",
      status: "PUBLISHED",
      offeringIds: [offering.id],
      evidenceIds: Object.values(shared),
    },
  });
  expect(theme.status(), await theme.text()).toBeLessThan(300);
  const themeId = ((await theme.json()) as { id: string }).id;

  const idea = await po.post("/api/v1/ideas", {
    data: {
      title: "Seasonality-aware comparison explanation",
      problemStatement: "Period comparisons flag seasonal dips as deterioration and create inconsistent treatment.",
      proposedOutcome: "Explain comparisons against the same period in prior years.",
      offeringId: offering.id,
      themeId,
      ownerId: owner.id,
      team: "Financial Analysis Intelligence",
      priority: "HIGH",
      visibility: "SHARED_WITH_PARTICIPANTS",
      publicStatusNote: "Under review — not a delivery commitment.",
      internalNotes: "INTERNAL roadmap discussion e2e",
      evidenceIds: Object.values(shared),
      status: "UNDER_REVIEW",
    },
  });
  expect(idea.status(), await idea.text()).toBeLessThan(300);

  const harbor = await as("harborMember");
  const list = await (await harbor.get("/api/v1/ideas")).text();
  expect(list).toContain("Seasonality-aware comparison explanation");
  expect(list).not.toContain("INTERNAL roadmap discussion e2e");
  expect(list).not.toContain('"priority"');

  // Clients cannot create ideas or moderate.
  expect((await harbor.post("/api/v1/themes", { data: {} })).status()).toBeGreaterThanOrEqual(403);
  expect((await harbor.get("/api/v1/moderation/queue")).status()).toBe(404);
});

test("withdrawal removes a contribution from feed, detail and search immediately", async () => {
  const analyst = await as("northwindAnalyst");
  const res = await analyst.post(`/api/v1/observations/${ids.northwind}/withdraw`);
  expect(res.status(), await res.text()).toBe(200);

  const cedar = await as("cedarAdmin");
  const feed = (await (await cedar.get("/api/v1/shared-observations?q=seasonal&pageSize=50")).json()) as { items: { id: string }[] };
  expect(feed.items.some((i) => i.id === shared.northwind)).toBe(false);
  expect((await cedar.get(`/api/v1/shared-observations/${shared.northwind}`)).status()).toBe(404);
  const search = await (await cedar.get(`/api/v1/search?q=${encodeURIComponent("Seasonal SME revenue")}`)).text();
  expect(search).not.toContain(shared.northwind);
});
