import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
// HTTPS-only directives follow the public origin (like the Secure cookies in src/lib/auth/cookie-policy.ts).
// Unknown origin at build time → assume HTTPS. A plain-HTTP loopback build (local `next start`, e2e)
// must not send them: upgrade-insecure-requests would rewrite redirects to https://localhost.
const servesHttps = isProd && !(process.env.AUTH_URL ?? "https://").startsWith("http://");

// Video embeds are limited to YouTube (privacy-enhanced) and Vimeo; everything else is same-origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://avatars.githubusercontent.com https://i.ytimg.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://github.com",
  "object-src 'none'",
  ...(servesHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(servesHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Nearly every portal route reads the session, so we use classic request-time rendering.
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/industries", destination: "/solutions", permanent: true },
      { source: "/contact", destination: "/connect", permanent: true },
    ];
  },
};

export default nextConfig;
