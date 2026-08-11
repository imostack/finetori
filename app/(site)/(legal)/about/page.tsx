import { siteConfig } from "@/lib/site";

export const metadata = {
  title: "About us",
  description: `Learn about ${siteConfig.name}, a Nigerian news publication covering politics, business, technology, entertainment and sport.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <h1 className="text-3xl font-black tracking-tight">
        About {siteConfig.name}
      </h1>

      <p>
        {siteConfig.name} is a Nigerian news publication covering the stories
        that shape everyday life — politics and governance, business and the
        economy, technology, entertainment, music, sport, education and
        lifestyle.
      </p>

      <p>
        We publish for readers who want to understand what happened and why it
        matters, without wading through noise. Our reporting is written plainly,
        sourced openly, and updated as stories develop.
      </p>

      <h2>How we work</h2>

      <p>
        Our newsroom monitors a wide range of Nigerian and international
        sources. When a story is corroborated across multiple credible outlets,
        our editors verify the facts and publish an original report that
        credits every source we drew on. Some of our reporting is assembled
        with the help of AI tooling, but nothing reaches the site without a
        human editor reviewing and approving it — and where AI assisted, we say
        so on the article.
      </p>

      <p>
        We link to our sources so you can read the original reporting yourself.
        We do not reproduce other publishers&apos; articles.
      </p>

      <h2>Corrections</h2>

      <p>
        We correct errors promptly and visibly. If you spot something wrong,
        tell us at{" "}
        <a href="mailto:corrections@finetori.com">corrections@finetori.com</a>{" "}
        and we will look into it.
      </p>

      <h2>Contact</h2>

      <p>
        General enquiries: <a href="mailto:hello@finetori.com">hello@finetori.com</a>
        <br />
        Advertising: <a href="mailto:ads@finetori.com">ads@finetori.com</a>
      </p>
    </>
  );
}
