import type { MetadataRoute } from "next";

const BASE = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/portal", "/api", "/invite", "/login", "/register"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
