import { siteConfig } from "@/lib/site";

export const metadata = {
  title: "Editorial policy",
  description: `How ${siteConfig.name} sources, verifies, and publishes its reporting, including our use of AI assistance.`,
  alternates: { canonical: "/editorial-policy" },
};

export default function EditorialPolicyPage() {
  return (
    <>
      <h1 className="text-3xl font-black tracking-tight">Editorial policy</h1>

      <p>
        This page explains how {siteConfig.name} produces its journalism. It is
        the standard our editors are held to.
      </p>

      <h2>Sourcing and attribution</h2>

      <p>
        Every report identifies where its information came from. When we build
        on reporting first published elsewhere, we name that outlet and link to
        it. We report facts in our own words — we do not reproduce another
        publisher&apos;s sentences, paragraphs, or photographs.
      </p>

      <p>
        We prefer stories corroborated by more than one credible outlet. A
        single-source claim is labelled as such.
      </p>

      <h2>AI assistance</h2>

      <p>
        We use AI tooling to monitor news sources, identify developing stories,
        and prepare first drafts from verified facts. This is a research and
        drafting aid, not a publishing decision.
      </p>

      <p>Three rules govern its use:</p>

      <ul>
        <li>
          No AI-assisted article is published without a human editor reading,
          verifying, and approving it.
        </li>
        <li>
          Quotes, figures, names, and dates are never generated. If a detail is
          not in the source material, it does not appear in our report.
        </li>
        <li>
          Articles that were drafted with AI assistance carry a note saying so,
          alongside the sources they were compiled from.
        </li>
      </ul>

      <h2>Images</h2>

      <p>
        We only publish images we own, have licensed, or are free to use. We do
        not republish photographs belonging to the outlets whose reporting we
        cite. Where an image credit is required, it appears in the caption.
      </p>

      <h2>Corrections</h2>

      <p>
        When we get something wrong, we fix it and say what changed. Substantive
        corrections are noted on the article. Write to{" "}
        <a href="mailto:corrections@finetori.com">corrections@finetori.com</a>.
      </p>

      <h2>Independence</h2>

      <p>
        Advertising and sponsorship never influence our reporting. Sponsored
        content, if we publish any, is clearly labelled and is not produced by
        the newsroom.
      </p>
    </>
  );
}
