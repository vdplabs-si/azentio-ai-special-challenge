import { expect, test } from "@playwright/test";

const ROUTES = [
  "/", "/products", "/products/credit-strategy-simulator", "/products/imal-islamic-banking", "/solutions", "/solutions/banking",
  "/solutions/insurance", "/solutions/capital-markets", "/solutions/risk-compliance", "/solutions/erp", "/lab", "/technology",
  "/media", "/insights", "/about", "/careers", "/connect", "/hackathon/register", "/live", "/privacy", "/terms",
  "/accessibility", "/login", "/register", "/sitemap.xml", "/robots.txt",
];

test.describe("public website", () => {
  for (const path of ROUTES) {
    test(`GET ${path} renders without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("unknown product returns 404", async ({ page }) => {
    const res = await page.goto("/products/does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("health check reports database ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect((await res.json()).database).toBe("ok");
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
