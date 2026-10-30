import { expect, test } from "@playwright/test";
import { apiLogin, uiLogin, USERS } from "./helpers";

test.describe("authentication & sessions", () => {
  test("signed-out visitors are redirected away from the portal", async ({ page }) => {
    await page.goto("/portal/projects");
    await expect(page).toHaveURL(/\/login\?next=%2Fportal%2Fprojects/);
  });

  test("protected APIs return 401 without a session", async ({ request }) => {
    for (const path of ["/api/v1/notifications", "/api/v1/me", "/api/v1/projects", "/api/v1/observations", "/api/v1/shared-observations"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
      expect((await res.json()).error.code).toBe("unauthenticated");
    }
  });

  test("wrong password is rejected with a generic message", async ({ request, baseURL }) => {
    const res = await request.post("/api/auth/login", { data: { email: USERS.employee, password: "Wrong-password-1" }, headers: { Origin: baseURL! } });
    expect(res.status()).toBe(401);
    expect((await res.json()).error.message).toBe("Email or password is incorrect.");
  });

  test("cross-site mutation is blocked (CSRF origin check)", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: USERS.employee, password: "x" },
      headers: { Origin: "https://evil.example", Cookie: "az_probe=1" },
    });
    expect(res.status()).toBe(403);
  });

  test("register creates an identity without any workspace access", async ({ page }) => {
    const email = `e2e.${Date.now()}@example.org`;
    await page.goto("/register");
    await page.getByLabel("Full name").fill("E2E Visitor");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Visitor-password-2026");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Your account was created")).toBeVisible();
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/pending/);
    await expect(page.getByText("No workspace access yet")).toBeVisible();
  });

  test("login persists across reloads and logout ends the session", async ({ page }) => {
    await uiLogin(page, USERS.northwindAnalyst);
    await page.reload();
    await expect(page).toHaveURL(/\/portal/);
    await expect(page.getByText("Northwind Bank (synthetic)").first()).toBeVisible();
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/portal"));
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/login/);
  });

  test("OAuth buttons are disabled with a configuration message when unconfigured", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    await expect(page.getByText(/GOOGLE_CLIENT_ID/)).toBeVisible();
    const res = await page.request.get("/api/auth/oauth/google", { maxRedirects: 0 });
    expect(res.status()).toBe(503);
  });

  test("session endpoint reflects server-side roles only", async ({ request, baseURL }) => {
    await apiLogin(request, baseURL!, USERS.employee);
    const s = (await (await request.get("/api/auth/session")).json()).session;
    expect(s.isEmployee).toBe(true);
    expect(s.roles).toEqual([]);
  });
});
