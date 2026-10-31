import { expect, test, type Page } from "@playwright/test";

/**
 * The WebGL scene is an enhancement: it must never produce console errors, must fall back to the
 * SVG poster when the device can't run it, and three.js must never load outside site heroes.
 * Headless Chromium renders WebGL through SwiftShader (software), which the gate treats as
 * "major performance caveat" → poster; `az:scene=force` exercises the real canvas.
 */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
const force = (page: Page) => page.addInitScript(() => window.localStorage.setItem("az:scene", "force"));
const stage = (page: Page) => page.locator("[data-scene]").first();

test("homepage scene renders on forced WebGL and follows the scroll story", async ({ page }) => {
  const errors = collectErrors(page);
  await force(page);
  await page.goto("/");
  await expect(stage(page)).toHaveAttribute("data-scene-stage", "canvas", { timeout: 30_000 });
  await expect(page.locator("canvas")).toHaveCount(1);

  const hero = page.locator("section[data-scene-step]");
  // The sticky track scrolls (height − viewport); progress 0.5 is "review", 0.9 is "share".
  const range = (await hero.boundingBox())!.height - page.viewportSize()!.height;
  await page.evaluate((y) => window.scrollTo(0, y), range * 0.5);
  await expect(hero).toHaveAttribute("data-scene-step", "review", { timeout: 10_000 });
  await page.evaluate((y) => window.scrollTo(0, y), range * 0.9);
  await expect(hero).toHaveAttribute("data-scene-step", "share", { timeout: 10_000 });

  // Client navigation tears the canvas down and the next hero brings its own.
  await page.goto("/products/financial-analysis-intelligence");
  await expect(stage(page)).toHaveAttribute("data-scene-stage", "canvas", { timeout: 30_000 });
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors, errors.join("\n")).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("renders a single still frame and does not pin the hero", async ({ page }) => {
    const errors = collectErrors(page);
    await force(page);
    await page.goto("/");
    await expect(stage(page)).toHaveAttribute("data-scene-stage", "still", { timeout: 30_000 });
    const hero = (await page.locator("section[data-scene-step]").boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(hero.height).toBeLessThanOrEqual(viewport.height * 1.3);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test("software-only WebGL keeps the poster and never downloads three.js", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/technology");
  await expect(stage(page)).toHaveAttribute("data-scene-reason", /no-webgl|capable/, { timeout: 30_000 });
  const reason = await stage(page).getAttribute("data-scene-reason");
  if (reason === "no-webgl") {
    await expect(stage(page)).toHaveAttribute("data-scene-stage", "poster");
    expect(await page.evaluate(() => "__THREE__" in window)).toBe(false);
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Save-Data and missing WebGL fall back to the poster silently", async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
  });
  await page.goto("/");
  await expect(stage(page)).toHaveAttribute("data-scene-reason", "save-data", { timeout: 30_000 });
  await expect(stage(page)).toHaveAttribute("data-scene-stage", "poster");
  expect(await page.evaluate(() => "__THREE__" in window)).toBe(false);

  const page2 = await page.context().newPage();
  const errors2 = collectErrors(page2);
  await page2.addInitScript(() => {
    window.localStorage.setItem("az:scene", "force");
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await page2.goto("/about");
  await expect(page2.locator("[data-scene]").first()).toHaveAttribute("data-scene-reason", "no-webgl", { timeout: 30_000 });
  expect([...errors, ...errors2], [...errors, ...errors2].join("\n")).toEqual([]);
});

test("three.js never loads on auth or portal pages", async ({ page }) => {
  await force(page);
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => "__THREE__" in window), path).toBe(false);
  }
});
