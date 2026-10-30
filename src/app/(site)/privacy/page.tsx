import Link from "next/link";
import { AZENTIO } from "@/content/site";
import { LegalPage } from "@/components/site/legal-page";
import { pageMetadata } from "@/components/site/seo";

export const metadata = pageMetadata({
  title: "Privacy notice",
  description: "What azentio.ai collects through its public forms and portal, why, and how it is protected.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy notice"
      intro={
        <p>
          A plain-language summary of how this website handles personal information. azentio.ai is an Azentio Build Labs
          build; Azentio&apos;s corporate policies on azentio.com continue to apply to Azentio as a company.
        </p>
      }
    >
      <section aria-labelledby="collect">
        <h2 id="collect">What we collect</h2>
        <ul>
          <li>
            <strong>Demo requests</strong> (<Link href="/connect">/connect</Link>): name, email, company, and optionally job
            title and country, the product you are interested in, your message, and your consent to be contacted.
          </li>
          <li>
            <strong>Hackathon registrations</strong> (<Link href="/hackathon/register">/hackathon/register</Link>): name,
            email, optionally organisation and team name, how you are taking part, an optional idea summary, and your
            consent to be contacted.
          </li>
          <li>
            <strong>Portal accounts</strong>: if you sign in, the details needed to run your account and the content you
            create in your workspace.
          </li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use">How we use it</h2>
        <p>
          We use form submissions only to review and respond to your request or registration. Submissions are stored in
          the azentio.ai database and are visible to authorised portal administrators. We do not sell personal
          information or use it for advertising.
        </p>
        <p>
          These forms do not send automatic emails. To limit abuse, submissions are rate-limited using a one-way hash of
          your network address and email address; the hash is not used to identify you.
        </p>
      </section>

      <section aria-labelledby="cookies">
        <h2 id="cookies">Cookies and third parties</h2>
        <ul>
          <li>The public website sets no advertising or analytics cookies.</li>
          <li>Signing in to the portal sets a session cookie that is strictly necessary to keep you signed in.</li>
          <li>
            Videos are hosted by YouTube (privacy-enhanced mode) or Vimeo and load only when you press play; those
            providers&apos; own policies then apply.
          </li>
        </ul>
      </section>

      <section aria-labelledby="rights">
        <h2 id="rights">Your choices</h2>
        <p>
          You can ask us to access, correct or delete the information you submitted. Send the request through{" "}
          <Link href="/connect">the contact form</Link> (include your reference if you have one) or through{" "}
          <a href={AZENTIO.contact} target="_blank" rel="noopener noreferrer">
            Azentio&apos;s contact page
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
