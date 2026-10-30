import {
  Building2,
  Eye,
  Fingerprint,
  Globe,
  KeyRound,
  Lightbulb,
  NotebookPen,
  ScrollText,
  Shapes,
  ShieldCheck,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { TECHNOLOGY } from "@/content/site";
import { CTASection } from "@/components/site/cta-section";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionHeader } from "@/components/site/section-header";
import { pageMetadata } from "@/components/site/seo";

export const metadata = pageMetadata({
  title: "Technology & trust",
  description:
    "How azentio.ai is built: enterprise integration, AI orchestration, security by design and responsible AI — plus tenant isolation, audit and governed collective learning in the portal.",
  path: "/technology",
});

const PLATFORM_PRINCIPLES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: KeyRound,
    title: "Identity & sign-in",
    text: "Private areas require a signed-in account — email and password, a one-time email code, or Google / GitHub where enabled. Sessions are validated on the server for every request.",
  },
  {
    icon: UserCheck,
    title: "Role-based access",
    text: "Administrative, moderation and publishing powers are explicit, separately granted roles. Anything not explicitly allowed is denied.",
  },
  {
    icon: Building2,
    title: "Tenant isolation",
    text: "Every private record belongs to one organisation's workspace. Access is decided on the server from verified membership — never from a workspace ID sent by the browser.",
  },
  {
    icon: ScrollText,
    title: "Audit records",
    text: "Sensitive actions such as role changes, moderation decisions and public enquiries are written to an audit log.",
  },
  {
    icon: Eye,
    title: "Human oversight",
    text: "Shared learning is moderated by people, and recommendations in the Playground are shown with their reasoning for review.",
  },
  {
    icon: Globe,
    title: "Public only by explicit choice",
    text: "Content appears on this website only when it is explicitly marked public. Nothing becomes public by default or by fallback.",
  },
];

const LEARNING_FLOW: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: NotebookPen,
    title: "Observation",
    text: "A participant records a market observation, product gap or successful practice. It stays private to them — or their workspace, if they choose.",
  },
  {
    icon: ShieldCheck,
    title: "Consent & moderation",
    text: "Proposing it for sharing records explicit consent. An automated check flags possible sensitive details, and a moderator decides: publish, return for clarification or reject.",
  },
  {
    icon: Fingerprint,
    title: "De-identified shared learning",
    text: "Only a reviewed copy is shared, with region and period coarsened. The organisation is named only if the contributor consented and the moderator approved.",
  },
  {
    icon: Shapes,
    title: "Themes",
    text: "Moderators and product owners group related shared learnings into themes linked to their evidence. Small contributor counts are suppressed.",
  },
  {
    icon: Lightbulb,
    title: "Improvement ideas",
    text: "Product owners turn themes into improvement ideas with evidence and a visible status history.",
  },
];

export default function TechnologyPage() {
  return (
    <>
      <PageHero eyebrow={TECHNOLOGY.eyebrow} title={TECHNOLOGY.title} description={<p>{TECHNOLOGY.lead}</p>} art="layers" />

      <section aria-labelledby="pillars-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader id="pillars-heading" eyebrow="Principles" title="Four commitments behind every product." />
          <ol className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
            {TECHNOLOGY.pillars.map((p, i) => (
              <li key={p.title} className="flex flex-col gap-3 bg-white p-6">
                <span aria-hidden="true" className="font-heading text-3xl font-semibold text-success">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-semibold text-brand-ink">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="architecture-heading" className="bg-brand-navy py-16 text-white sm:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <SectionHeader
            id="architecture-heading"
            tone="dark"
            eyebrow="Reference architecture"
            title="Intelligence with Governance at Every Layer."
            description="Each layer builds on the one beneath it, and trust, security and governance run under all of them."
          />
          <ol className="flex flex-col gap-2" aria-label="Architecture layers, top to bottom">
            {TECHNOLOGY.layers.map((layer, i) => {
              const last = i === TECHNOLOGY.layers.length - 1;
              return (
                <li
                  key={layer.title}
                  className={
                    last
                      ? "rounded-lg border border-brand-green/60 bg-brand-green/10 p-5"
                      : "rounded-lg border border-white/15 bg-white/[0.03] p-5"
                  }
                >
                  <p className="flex items-baseline gap-3">
                    <span className="font-heading text-sm font-semibold text-brand-green">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-heading text-lg font-semibold text-white">{layer.title}</span>
                  </p>
                  <p className="mt-1 pl-8 text-sm text-slate-300">{layer.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section aria-labelledby="platform-heading" className="bg-white py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader
            id="platform-heading"
            eyebrow="The azentio.ai portal"
            title="How the portal protects each organisation's data."
            description="The same rules apply to every list, search, count and export in the portal."
          />
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_PRINCIPLES.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <Reveal delay={(i % 3) * 0.05} className="h-full">
                  <article className="flex h-full flex-col gap-3 rounded-lg border border-border bg-white p-6">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-success">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <h3 className="text-lg font-semibold text-brand-ink">{title}</h3>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="learning-heading" className="bg-brand-light py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          <SectionHeader
            id="learning-heading"
            eyebrow="Governed collective learning"
            title="Learning across organisations, without exposing any of them."
            description="Employees and client participants can share what they see in the market. Every step is governed by consent and human moderation."
          />
          <ol className="grid gap-4 lg:grid-cols-5">
            {LEARNING_FLOW.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-navy text-brand-green">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="font-heading text-sm font-semibold text-brand-muted">Step {i + 1}</span>
                </div>
                <h3 className="text-base font-semibold text-brand-ink">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
          <div className="grid gap-6 rounded-lg border border-brand-navy/15 bg-white p-6 sm:p-8 lg:grid-cols-[auto_1fr]">
            <span className="flex size-11 items-center justify-center rounded-lg bg-brand-navy text-brand-green">
              <Users aria-hidden="true" className="size-5" />
            </span>
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-semibold text-brand-ink">This is not federated model training.</h3>
              <p className="text-sm text-muted-foreground sm:text-base">
                No machine-learning model is trained across organisations&apos; data. What is shared is a human-moderated,
                de-identified written summary that people read, discuss and act on — the private original never leaves its
                workspace. Consent to any future training use is recorded separately and is never assumed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        eyebrow="Questions about security?"
        title="Talk to us about how azentio.ai is built."
        primary={{ label: "Start a Conversation", href: "/connect?interest=general" }}
        secondary={{ label: "Visit the AI Lab", href: "/lab" }}
      />
    </>
  );
}
