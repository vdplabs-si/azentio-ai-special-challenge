import { expect, test, type Page } from "@playwright/test";
import { uiLogin, USERS } from "./helpers";

/**
 * Signs in as every seeded persona and walks the portal breadth-first from the sidebar,
 * following in-portal links (one page per route pattern). Every page must render without a
 * server error, a route-error fallback, an uncaught exception, a console error, or a failing
 * (5xx) request made by the page. Problems are collected so one run reports all of them.
 */
const MAX_PAGES = 70;
const ID_SEGMENT = /^(?=.*\d)[a-z0-9_-]{16,}$/i;

function routeKey(path: string) {
  return path
    .split("/")
    .map((s) => (ID_SEGMENT.test(s) ? ":id" : s))
    .join("/");
}

function watch(page: Page, problems: string[], current: () => string) {
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`${current()} console: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => problems.push(`${current()} pageerror: ${e.message.slice(0, 300)}`));
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`${current()} ${r.status()} from ${new URL(r.url()).pathname}`);
  });
}

async function portalLinks(page: Page) {
  const hrefs = await page.locator('a[href^="/portal"]').evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  return hrefs.map((h) => h.split("#")[0].split("?")[0]).filter((h) => h.startsWith("/portal"));
}

for (const [persona, email] of Object.entries(USERS)) {
  test(`${persona}: every reachable portal page renders cleanly`, async ({ page }) => {
    // next dev compiles each route on first visit; the admin persona reaches ~50 of them.
    test.setTimeout(process.env.E2E_SERVER === "dev" ? 900_000 : 300_000);
    const problems: string[] = [];
    let current = "/login";
    watch(page, problems, () => current);

    await uiLogin(page, email);
    const queue = await portalLinks(page);
    const seenRoutes = new Set<string>();
    let visited = 0;

    while (queue.length && visited < MAX_PAGES) {
      const href = queue.shift()!;
      const key = routeKey(href);
      if (seenRoutes.has(key)) continue;
      seenRoutes.add(key);
      current = href;
      visited++;

      const res = await page.goto(href, { waitUntil: "networkidle" });
      const status = res?.status() ?? 0;
      if (status >= 500) problems.push(`${href} HTTP ${status}`);
      if (await page.locator("[data-route-error]").count()) problems.push(`${href} rendered the route-error fallback`);
      for (const link of await portalLinks(page)) if (!seenRoutes.has(routeKey(link))) queue.push(link);
    }

    expect(visited, "crawl reached pages").toBeGreaterThan(3);
    expect(problems, `${persona} problems:\n${problems.join("\n")}`).toEqual([]);
  });
}

/**
 * Portal pages stream behind loading.tsx, so notFound() is a "soft 404": HTTP 200 carrying the
 * not-found screen (APIs return a real 404, see collaboration.spec). What matters: no crash and
 * none of the protected page renders.
 */
test("clients get the not-found screen (not a crash) on employee and admin areas", async ({ page }) => {
  await uiLogin(page, USERS.northwindAnalyst);
  const protectedHeadings: Record<string, RegExp> = {
    "/portal/experiments": /experiments/i,
    "/portal/hackathon": /hackathon/i,
    "/portal/admin": /administration|admin overview/i,
    "/portal/admin/users": /users/i,
    "/portal/moderation": /submission queue/i,
  };
  for (const [path, heading] of Object.entries(protectedHeadings)) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(500);
    await expect(page.getByText("Error 404"), path).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: heading }), path).toHaveCount(0);
    await expect(page.locator("[data-route-error]"), path).toHaveCount(0);
  }
});
