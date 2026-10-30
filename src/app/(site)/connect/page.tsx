import Link from "next/link";
import { ClipboardCheck, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { AZENTIO } from "@/content/site";
import { findOffering } from "@/components/site/catalogue";
import { ExternalLink } from "@/components/site/external-link";
import { ContactForm } from "@/components/site/forms/contact-form";
import { PageHero } from "@/components/site/page-hero";
import { pageMetadata } from "@/components/site/seo";

export const metadata = pageMetadata({
  title: "Request a demo",
  description:
    "Request a demo of azentio.ai or an Azentio product, or start a conversation about an AI challenge in banking, insurance, capital markets or ERP.",
  path: "/connect",
});

type Props = { searchParams: Promise<{ interest?: string | string[] }> };

export default async function ConnectPage({ searchParams }: Props) {
  const { interest } = await searchParams;
  const requested = Array.isArray(interest) ? interest[0] : interest;
  const offering = requested ? findOffering(requested) : undefined;
  const defaultInterest = offering?.slug ?? "general";

  return (
    <>
      <PageHero
        eyebrow="Request a demo"
        title="Start a conversation."
        description={
          <p>
            {offering
              ? `Tell us about your interest in ${offering.name} and what you'd like to see.`
              : "Tell us about your challenge, the product you're interested in, or an idea you'd like to explore together."}
          </p>
        }
      />

      <section aria-label="Demo request" className="bg-brand-light py-12 sm:py-16">
        <div className="container-page grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
          <div className="rounded-lg border border-border bg-white p-6 sm:p-8">
            <h2 className="mb-6 text-2xl font-semibold text-brand-ink">Your details</h2>
            <ContactForm defaultInterest={defaultInterest} />
          </div>

          <aside aria-label="What happens next" className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-6">
              <h2 className="text-lg font-semibold text-brand-ink">What happens next</h2>
              <ol className="flex flex-col gap-4 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <ClipboardCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>Your request is recorded and you get a reference on screen straight away.</span>
                </li>
                <li className="flex items-start gap-3">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>Only authorised azentio.ai administrators can see it, in the portal&apos;s enquiries inbox.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>No automatic email is sent. If you agreed to be contacted, the team uses the details you gave.</span>
                </li>
              </ol>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-6 text-sm">
              <p className="flex items-center gap-2 font-heading font-semibold text-brand-ink">
                <LockKeyhole aria-hidden="true" className="size-4 text-success" />
                Already a client or employee?
              </p>
              <p className="text-muted-foreground">Sign in to raise support requests and collaborate in your workspace.</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Link href="/login" className="font-semibold text-brand-navy hover:underline">
                  Sign in
                </Link>
                <Link href="/portal" className="font-semibold text-brand-navy hover:underline">
                  Portal
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-white p-6 text-sm">
              <p className="font-heading font-semibold text-brand-ink">Other enquiries</p>
              <p className="text-muted-foreground">
                For corporate, partnership or media enquiries, use Azentio&apos;s contact page.
              </p>
              <ExternalLink href={AZENTIO.contact} className="text-brand-navy">
                azentio.com/contact-us
              </ExternalLink>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
