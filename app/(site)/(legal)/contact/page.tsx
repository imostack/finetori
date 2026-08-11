import { siteConfig } from "@/lib/site";

export const metadata = {
  title: "Contact",
  description: `Get in touch with the ${siteConfig.name} newsroom.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <h1 className="text-3xl font-black tracking-tight">Contact us</h1>

      <p>
        We read everything. Pick the address that fits and we will get back to
        you.
      </p>

      <h2>Newsroom</h2>
      <p>
        Story tips, press releases and interview requests:{" "}
        <a href="mailto:newsroom@finetori.com">newsroom@finetori.com</a>
      </p>

      <h2>Corrections</h2>
      <p>
        Spotted an error? Tell us what is wrong and where:{" "}
        <a href="mailto:corrections@finetori.com">corrections@finetori.com</a>
      </p>

      <h2>Advertising and partnerships</h2>
      <p>
        Media kit and rates:{" "}
        <a href="mailto:ads@finetori.com">ads@finetori.com</a>
      </p>

      <h2>Privacy and data requests</h2>
      <p>
        <a href="mailto:privacy@finetori.com">privacy@finetori.com</a>
      </p>

      <h2>General</h2>
      <p>
        Anything else: <a href="mailto:hello@finetori.com">hello@finetori.com</a>
      </p>

      <h2>Social</h2>
      <p>
        <a
          href={siteConfig.social.instagram}
          target="_blank"
          rel="noopener noreferrer"
        >
          Instagram
        </a>{" "}
        ·{" "}
        <a
          href={siteConfig.social.twitter}
          target="_blank"
          rel="noopener noreferrer"
        >
          X
        </a>{" "}
        ·{" "}
        <a
          href={siteConfig.social.facebook}
          target="_blank"
          rel="noopener noreferrer"
        >
          Facebook
        </a>
      </p>
    </>
  );
}
