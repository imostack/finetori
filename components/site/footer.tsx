import Link from "next/link";

import { getTopLevelCategories } from "@/lib/queries";
import { siteConfig } from "@/lib/site";
import { NewsletterForm } from "./newsletter-form";

export async function SiteFooter() {
  const categories = await getTopLevelCategories();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-[1200px] px-4 py-10">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <span className="text-xl font-black tracking-tight">
              {siteConfig.name}
            </span>
            <p className="mt-2 max-w-sm text-sm text-neutral-600">
              {siteConfig.description}
            </p>
            <div className="mt-4 max-w-sm">
              <p className="mb-2 text-sm font-semibold">
                Get the day&apos;s top stories
              </p>
              <NewsletterForm source="footer" />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-900">
              Sections
            </h2>
            <ul className="space-y-1.5 text-sm">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/${c.slug}`}
                    className="text-neutral-600 transition hover:text-brand-700"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-900">
              Finetori
            </h2>
            <ul className="space-y-1.5 text-sm">
              {[
                { href: "/about", label: "About us" },
                { href: "/contact", label: "Contact" },
                { href: "/editorial-policy", label: "Editorial policy" },
                { href: "/privacy", label: "Privacy policy" },
                { href: "/terms", label: "Terms of use" },
                { href: "/rss.xml", label: "RSS feed" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-neutral-600 transition hover:text-brand-700"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-neutral-200 pt-6 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex gap-4">
            <a
              href={siteConfig.social.instagram}
              rel="noopener noreferrer"
              target="_blank"
              className="transition hover:text-brand-700"
            >
              Instagram
            </a>
            <a
              href={siteConfig.social.twitter}
              rel="noopener noreferrer"
              target="_blank"
              className="transition hover:text-brand-700"
            >
              X
            </a>
            <a
              href={siteConfig.social.facebook}
              rel="noopener noreferrer"
              target="_blank"
              className="transition hover:text-brand-700"
            >
              Facebook
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
