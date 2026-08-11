"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav({
  categories,
}: {
  categories: { slug: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation, otherwise it stays open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent the page behind the drawer from scrolling.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        className="rounded-md p-2 text-neutral-700 transition hover:bg-neutral-100"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </>
          ) : (
            <>
              <path d="M3 6h18" />
              <path d="M3 12h18" />
              <path d="M3 18h18" />
            </>
          )}
        </svg>
      </button>

      {open ? (
        <div
          id="mobile-nav-panel"
          className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto border-t border-neutral-200 bg-white px-4 py-4"
        >
          <form action="/search" className="mb-4">
            <label htmlFor="mobile-search" className="sr-only">
              Search Finetori
            </label>
            <input
              id="mobile-search"
              type="search"
              name="q"
              placeholder="Search Finetori…"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-700"
            />
          </form>

          <nav aria-label="Sections" className="grid gap-0.5">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                className="rounded-md px-3 py-2.5 text-base font-medium text-neutral-800 transition hover:bg-neutral-100"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
