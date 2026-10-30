import Link from "next/link";
import { DISCLAIMER } from "@/content/site";
import { LegalPage } from "@/components/site/legal-page";
import { pageMetadata } from "@/components/site/seo";

export const metadata = pageMetadata({
  title: "Terms of use",
  description: "Terms for using the azentio.ai website and portal.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of use"
      intro={<p>By using azentio.ai you agree to these short terms. They are written for an Azentio Build Labs build.</p>}
    >
      <section aria-labelledby="info">
        <h2 id="info">Information on this site</h2>
        <p>
          {DISCLAIMER} Content is provided for general information and does not form an offer or a contract. Where we
          summarise Azentio products or recognitions, the official source on azentio.com prevails.
        </p>
      </section>

      <section aria-labelledby="portal">
        <h2 id="portal">The portal</h2>
        <ul>
          <li>Access is personal. Clients join by invitation; employees after approval by an organiser.</li>
          <li>Keep your credentials secure and use the portal only for its intended business purpose.</li>
          <li>Playground scenarios use synthetic data and produce illustrative results, not advice.</li>
          <li>Content you contribute to shared learning is published only with your consent and after moderation.</li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use">Acceptable use</h2>
        <p>
          Do not attempt to access areas or data you are not authorised to see, disrupt the service, submit automated or
          misleading requests, or upload unlawful content. Requests are rate-limited and abuse may lead to access being
          withdrawn.
        </p>
      </section>

      <section aria-labelledby="ip">
        <h2 id="ip">Names and trademarks</h2>
        <p>
          Azentio, azentio.ai and Azentio product names belong to Azentio. Third-party names, including analyst firms,
          belong to their respective owners. Links to other sites are provided for convenience.
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">Questions</h2>
        <p>
          Contact us through <Link href="/connect">the contact form</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
