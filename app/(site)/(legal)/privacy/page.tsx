import { siteConfig } from "@/lib/site";

export const metadata = {
  title: "Privacy policy",
  description: `How ${siteConfig.name} collects, uses and protects your information.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-3xl font-black tracking-tight">Privacy policy</h1>

      <p className="text-sm text-neutral-500">
        Last updated: {new Date().getFullYear()}
      </p>

      <p>
        This policy explains what information {siteConfig.name} collects when
        you use our website, why we collect it, and what choices you have.
      </p>

      <h2>Information we collect</h2>

      <ul>
        <li>
          <strong>Article analytics.</strong> We count how many times each
          article is read so we can show a &ldquo;trending&rdquo; list. This is
          an aggregate count. We do not store your IP address or build a
          profile of what you read.
        </li>
        <li>
          <strong>Newsletter.</strong> If you subscribe, we store the email
          address you give us and the date you subscribed. Nothing else.
        </li>
        <li>
          <strong>Messages you send us.</strong> If you email us, we keep that
          correspondence so we can reply and follow up.
        </li>
      </ul>

      <h2>Cookies and advertising</h2>

      <p>
        We use a small number of functional cookies to keep the site working.
        We also display advertising served by Google AdSense, which may set
        cookies and use device identifiers to show and measure ads, including
        personalised ads.
      </p>

      <p>
        You can control how Google uses your data at{" "}
        <a
          href="https://myadcenter.google.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google My Ad Center
        </a>
        , and opt out of personalised advertising at{" "}
        <a
          href="https://www.aboutads.info/choices/"
          target="_blank"
          rel="noopener noreferrer"
        >
          aboutads.info/choices
        </a>
        . Most browsers also let you block or delete cookies in their settings.
      </p>

      <h2>How we use your information</h2>

      <p>
        To operate and improve the site, to send our newsletter if you asked
        for it, to respond to you, and to meet our legal obligations. We do not
        sell your personal information.
      </p>

      <h2>Sharing</h2>

      <p>
        We share data only with the service providers who help us run the site
        — our hosting provider, our database provider, and our advertising
        partner — and only to the extent they need it to provide that service.
      </p>

      <h2>Retention</h2>

      <p>
        Newsletter subscriptions are kept until you unsubscribe. Aggregate
        article counts are kept indefinitely because they contain no personal
        data.
      </p>

      <h2>Your rights</h2>

      <p>
        Under the Nigeria Data Protection Act you may request access to the
        personal data we hold about you, ask us to correct it, or ask us to
        delete it. Every newsletter includes a one-click unsubscribe link. For
        anything else, email{" "}
        <a href="mailto:privacy@finetori.com">privacy@finetori.com</a> and we
        will respond within 30 days.
      </p>

      <h2>Children</h2>

      <p>
        This site is not directed at children under 13 and we do not knowingly
        collect their personal information.
      </p>

      <h2>Changes</h2>

      <p>
        If we make material changes to this policy we will update the date at
        the top of this page.
      </p>

      <h2>Contact</h2>

      <p>
        Questions about this policy:{" "}
        <a href="mailto:privacy@finetori.com">privacy@finetori.com</a>
      </p>
    </>
  );
}
