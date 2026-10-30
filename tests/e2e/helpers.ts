import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = process.env.E2E_SEED_PASSWORD ?? "E2e-password-2026";

export const USERS = {
  admin: "dev.admin@azentio.com",
  moderator: "dev.moderator@azentio.com",
  product: "dev.product@azentio.com",
  publisher: "dev.publisher@azentio.com",
  employee: "dev.employee@azentio.com",
  northwindAdmin: "admin@northwind.example",
  northwindAnalyst: "analyst@northwind.example",
  cedarAdmin: "admin@cedar.example",
  harborMember: "member@harbor.example",
} as const;

/** Sign in through the real password endpoint; the session cookie lands in the request context. */
export async function apiLogin(request: APIRequestContext, baseURL: string, email: string) {
  const res = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
    headers: { Origin: baseURL },
  });
  expect(res.status(), await res.text()).toBe(200);
}

export async function uiLogin(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/portal/);
}

export const json = { headers: (baseURL: string) => ({ Origin: baseURL, "Content-Type": "application/json" }) };
