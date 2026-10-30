import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { ExternalLink } from "@/components/site/external-link";
import { safeExternalUrl } from "@/components/site/embed";

export interface BannerData {
  message: string;
  linkLabel: string | null;
  linkHref: string | null;
}

/** Only same-site paths or https URLs are rendered as banner links. */
function bannerLink(href: string | null): { href: string; external: boolean } | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) return { href: trimmed, external: false };
  const ext = safeExternalUrl(trimmed);
  return ext ? { href: ext, external: true } : null;
}

/** Site-wide announcement managed by content publishers in the portal (active + within its window). */
export function SiteBanner({ banner }: { banner: BannerData }) {
  const link = bannerLink(banner.linkHref);
  const label = banner.linkLabel?.trim() || "Learn more";
  return (
    <aside aria-label="Announcement" className="border-b border-brand-green/30 bg-accent">
      <div className="container-page flex flex-col gap-2 py-3 text-sm text-brand-ink sm:flex-row sm:items-center sm:justify-center sm:gap-4">
        <p className="flex items-start gap-2">
          <Megaphone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          <span>{banner.message}</span>
        </p>
        {link ? (
          link.external ? (
            <ExternalLink href={link.href} className="text-sm font-semibold text-brand-navy">
              {label}
            </ExternalLink>
          ) : (
            <Link
              href={link.href}
              className="inline-flex items-center gap-1 rounded-sm font-semibold text-brand-navy underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {label}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          )
        ) : null}
      </div>
    </aside>
  );
}
