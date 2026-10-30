import Link from "next/link";
import { LegalPage } from "@/components/site/legal-page";
import { pageMetadata } from "@/components/site/seo";

export const metadata = pageMetadata({
  title: "Accessibility",
  description: "Our accessibility approach for azentio.ai, known limitations and how to report a barrier.",
  path: "/accessibility",
});

export default function AccessibilityPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Accessibility statement"
      intro={<p>We want azentio.ai to be usable by everyone, including people who use assistive technologies.</p>}
    >
      <section aria-labelledby="goal">
        <h2 id="goal">Our goal</h2>
        <p>
          We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. The site has not yet been
          independently audited, so we do not claim full conformance.
        </p>
      </section>

      <section aria-labelledby="measures">
        <h2 id="measures">What we have done</h2>
        <ul>
          <li>Semantic page structure with landmarks, one main heading per page and a “Skip to content” link.</li>
          <li>Full keyboard support for navigation menus, forms and video players, with visible focus indicators.</li>
          <li>Form fields with visible labels; errors are described in text and linked to their fields.</li>
          <li>Animations are subtle and switched off when your system asks for reduced motion.</li>
          <li>Decorative illustrations are hidden from screen readers; colour is not the only way information is shown.</li>
        </ul>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">Known limitations</h2>
        <ul>
          <li>Embedded YouTube and Vimeo players are provided by third parties and may not be fully accessible.</li>
          <li>Captions for videos depend on what the publisher provides on those platforms.</li>
          <li>Content added by publishers through the portal may occasionally fall short of these standards.</li>
        </ul>
      </section>

      <section aria-labelledby="feedback">
        <h2 id="feedback">Report a barrier</h2>
        <p>
          If something on azentio.ai is hard to use, tell us through <Link href="/connect">the contact form</Link> — please
          include the page address and what you were trying to do.
        </p>
      </section>
    </LegalPage>
  );
}
