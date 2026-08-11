import Link from "next/link";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-6xl font-black tracking-tight text-neutral-200">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        We can&apos;t find that page
      </h1>
      <p className="mt-2 text-neutral-600">
        The story may have moved, or the link may be out of date.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
        >
          Back to homepage
        </Link>
        <Link
          href="/search"
          className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-semibold transition hover:border-neutral-900"
        >
          Search
        </Link>
      </div>
    </div>
  );
}
