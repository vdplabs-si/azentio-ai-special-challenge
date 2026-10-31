import type { MetadataRoute } from "next";
import { INDUSTRIES, OFFERINGS } from "@/content/catalogue";

// Regenerated hourly so newly published public insights are picked up.
export const revalidate = 3600;

const BASE = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/products", priority: 0.9, changeFrequency: "monthly" },
  { path: "/solutions", priority: 0.8, changeFrequency: "monthly" },
  { path: "/lab", priority: 0.7, changeFrequency: "monthly" },
  { path: "/technology", priority: 0.7, changeFrequency: "monthly" },
  { path: "/media", priority: 0.6, changeFrequency: "weekly" },
  { path: "/insights", priority: 0.7, changeFrequency: "weekly" },
  { path: "/live", priority: 0.6, changeFrequency: "weekly" },
  { path: "/hackathon/register", priority: 0.6, changeFrequency: "weekly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/careers", priority: 0.4, changeFrequency: "monthly" },
  { path: "/connect", priority: 0.8, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/accessibility", priority: 0.2, changeFrequency: "yearly" },
];

/** Public routes only — never portal, auth, API or private content. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    ...STATIC_ROUTES.map((r) => ({
      url: r.path === "/" ? BASE : `${BASE}${r.path}`,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    ...OFFERINGS.map((o) => ({ url: `${BASE}/products/${o.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...INDUSTRIES.map((i) => ({ url: `${BASE}/solutions/${i.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];

  // Public, published insights. Skipped while `next build` prerenders (the build never needs the
  // database); the hourly revalidation adds them at runtime.
  if (process.env.NEXT_PHASE === "phase-production-build") return entries;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { listPublicInsightSlugs } = await import("@/server/services/public-content");
    const insights = await Promise.race([
      listPublicInsightSlugs(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("sitemap: database timeout")), 4000);
      }),
    ]);
    for (const i of insights) {
      entries.push({
        url: `${BASE}/insights/${encodeURIComponent(i.slug)}`,
        lastModified: i.updatedAt,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch {
    // No database (e.g. at build time) — static routes only.
  } finally {
    clearTimeout(timer);
  }

  return entries;
}
