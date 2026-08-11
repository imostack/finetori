export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "Finetori",
  tagline: "Your go-to news source",
  description:
    "Finetori brings you the latest Nigerian news — politics, business, technology, entertainment, sports and more. Stay in the loop with the stories that matter.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  ),
  locale: "en_NG",
  twitter: "@finetori",
  social: {
    instagram: "https://instagram.com/finetori",
    twitter: "https://twitter.com/finetori",
    facebook: "https://facebook.com/finetori",
  },
} as const;

export function absoluteUrl(path = "/"): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
