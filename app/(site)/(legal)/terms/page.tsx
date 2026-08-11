import { siteConfig } from "@/lib/site";

export const metadata = {
  title: "Terms of use",
  description: `The terms that govern your use of ${siteConfig.name}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <h1 className="text-3xl font-black tracking-tight">Terms of use</h1>

      <p className="text-sm text-neutral-500">
        Last updated: {new Date().getFullYear()}
      </p>

      <p>
        By using {siteConfig.name} you agree to these terms. If you do not
        agree, please do not use the site.
      </p>

      <h2>Using the site</h2>

      <p>
        You may read, link to, and share our articles. You may not republish
        our content in full, scrape the site at scale, attempt to disrupt it,
        or use it for anything unlawful.
      </p>

      <h2>Our content</h2>

      <p>
        Articles, headlines, and original images on {siteConfig.name} are our
        property or used under licence. Short quotations with a link back are
        welcome. Wholesale reproduction is not.
      </p>

      <p>
        Where we cite other outlets, that material remains theirs and is
        credited accordingly.
      </p>

      <h2>Accuracy</h2>

      <p>
        We work to publish accurate, verified reporting, and we correct
        mistakes when we find them. News develops, though, and articles reflect
        what was known at the time of publication. Nothing here is legal,
        financial, or medical advice.
      </p>

      <h2>External links</h2>

      <p>
        We link to other sites for source attribution and further reading. We
        are not responsible for their content or their privacy practices.
      </p>

      <h2>Advertising</h2>

      <p>
        The site carries third-party advertising. Adverts do not constitute an
        endorsement, and any dealings you have with an advertiser are between
        you and them.
      </p>

      <h2>Liability</h2>

      <p>
        The site is provided &ldquo;as is&rdquo;. To the fullest extent
        permitted by Nigerian law, we are not liable for any loss arising from
        your use of it.
      </p>

      <h2>Changes</h2>

      <p>
        We may update these terms. Continued use of the site after a change
        means you accept the revised terms.
      </p>

      <h2>Contact</h2>

      <p>
        <a href="mailto:hello@finetori.com">hello@finetori.com</a>
      </p>
    </>
  );
}
