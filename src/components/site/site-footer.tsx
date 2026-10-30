import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ExternalLink } from "@/components/site/external-link";
import { DISCLAIMER, FOOTER_COLUMNS, LEGAL_LINKS, SOCIAL } from "@/content/site";

const footerLink =
  "rounded-sm text-sm text-slate-300 transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function SiteFooter() {
  return (
    <footer className="bg-brand-navy text-white">
      <div className="container-page grid gap-12 py-14 lg:grid-cols-[1.2fr_2fr] lg:py-16">
        <div className="flex max-w-sm flex-col gap-4">
          <Link href="/" className="w-fit rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Wordmark inverted className="text-2xl" />
            <span className="sr-only">, home</span>
          </Link>
          <p className="font-heading text-lg font-semibold text-white">Build Intelligence. Create Impact.</p>
          <p className="text-sm text-slate-300">
            Enterprise AI from Azentio for banking, insurance, capital markets and ERP — with a secure portal for
            employees and clients.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 pt-2" aria-label="Azentio on social media">
            {SOCIAL.map((s) => (
              <li key={s.href}>
                <ExternalLink href={s.href} className="text-sm font-normal text-slate-300 hover:text-white">
                  {s.label}
                </ExternalLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={`Footer — ${col.title}`}>
              <h2 className="text-xs font-semibold tracking-[0.18em] text-brand-green uppercase">{col.title}</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <ExternalLink href={l.href} className={`${footerLink} font-normal`}>
                        {l.label}
                      </ExternalLink>
                    ) : (
                      <Link href={l.href} className={footerLink}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-4 py-6 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>
            © 2026 azentio.ai. <span className="text-slate-400">{DISCLAIMER}</span>
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={footerLink.replace("text-sm", "text-xs")}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
