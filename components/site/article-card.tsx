import Image from "next/image";
import Link from "next/link";

import type { ArticleListing } from "@/lib/queries";
import { articleHref } from "@/lib/queries";
import { cn, relativeTime } from "@/lib/utils";

type Variant = "hero" | "large" | "medium" | "small" | "text";

const IMAGE_SIZES: Record<Variant, string> = {
  hero: "(max-width: 1024px) 100vw, 66vw",
  large: "(max-width: 768px) 100vw, 50vw",
  medium: "(max-width: 768px) 100vw, 33vw",
  small: "120px",
  text: "0px",
};

function CategoryTag({
  name,
  slug,
}: {
  name: string | null;
  slug: string | null;
}) {
  if (!name || !slug) return null;
  return (
    <Link
      href={`/${slug}`}
      className="text-[11px] font-bold uppercase tracking-wider text-brand-700 transition hover:text-brand-900"
    >
      {name}
    </Link>
  );
}

function Meta({ article }: { article: ArticleListing }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
      {article.authorName ? <span>{article.authorName}</span> : null}
      {article.authorName && article.publishedAt ? <span>·</span> : null}
      {article.publishedAt ? (
        <time dateTime={new Date(article.publishedAt).toISOString()}>
          {relativeTime(article.publishedAt)}
        </time>
      ) : null}
    </div>
  );
}

function Thumb({
  article,
  variant,
  className,
  priority,
}: {
  article: ArticleListing;
  variant: Variant;
  className?: string;
  priority?: boolean;
}) {
  const href = articleHref(article.categorySlug, article.slug);

  return (
    <Link
      href={href}
      tabIndex={-1}
      aria-hidden="true"
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-md bg-neutral-100",
        className,
      )}
    >
      {article.coverImageUrl ? (
        <Image
          src={article.coverImageUrl}
          alt=""
          fill
          sizes={IMAGE_SIZES[variant]}
          priority={priority}
          className="object-cover transition duration-300 hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-neutral-300">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Finetori
          </span>
        </div>
      )}
      {article.isBreaking ? (
        <span className="absolute left-2 top-2 rounded bg-breaking px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Breaking
        </span>
      ) : null}
    </Link>
  );
}

export function ArticleCard({
  article,
  variant = "medium",
  priority = false,
}: {
  article: ArticleListing;
  variant?: Variant;
  priority?: boolean;
}) {
  const href = articleHref(article.categorySlug, article.slug);

  /* ---------------------------------------------------------------- hero */
  if (variant === "hero") {
    return (
      <article className="group">
        <Thumb
          article={article}
          variant="hero"
          priority={priority}
          className="aspect-[16/9] w-full"
        />
        <div className="mt-3">
          <CategoryTag
            name={article.categoryName}
            slug={article.categorySlug}
          />
          <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight md:text-3xl">
            <Link href={href} className="hover:underline">
              {article.title}
            </Link>
          </h2>
          {article.dek || article.excerpt ? (
            <p className="mt-2 line-clamp-2 text-base text-neutral-600">
              {article.dek ?? article.excerpt}
            </p>
          ) : null}
          <Meta article={article} />
        </div>
      </article>
    );
  }

  /* --------------------------------------------------------------- small */
  // Horizontal layout — used in the trending rail and related lists.
  if (variant === "small") {
    return (
      <article className="group flex gap-3">
        <Thumb
          article={article}
          variant="small"
          className="h-[68px] w-[100px]"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug">
            <Link href={href} className="hover:underline">
              {article.title}
            </Link>
          </h3>
          {article.publishedAt ? (
            <time
              dateTime={new Date(article.publishedAt).toISOString()}
              className="mt-1 block text-xs text-neutral-500"
            >
              {relativeTime(article.publishedAt)}
            </time>
          ) : null}
        </div>
      </article>
    );
  }

  /* ---------------------------------------------------------------- text */
  // No image — for dense list sections.
  if (variant === "text") {
    return (
      <article className="group border-b border-neutral-100 pb-3 last:border-0">
        <CategoryTag name={article.categoryName} slug={article.categorySlug} />
        <h3 className="mt-1 text-base font-semibold leading-snug">
          <Link href={href} className="hover:underline">
            {article.title}
          </Link>
        </h3>
        <Meta article={article} />
      </article>
    );
  }

  /* ------------------------------------------------------- large / medium */
  const isLarge = variant === "large";
  return (
    <article className="group">
      <Thumb
        article={article}
        variant={variant}
        priority={priority}
        className={isLarge ? "aspect-[16/9] w-full" : "aspect-[3/2] w-full"}
      />
      <div className="mt-2.5">
        <CategoryTag name={article.categoryName} slug={article.categorySlug} />
        <h3
          className={cn(
            "mt-1 font-bold leading-snug tracking-tight",
            isLarge ? "text-xl" : "text-base",
          )}
        >
          <Link href={href} className="hover:underline">
            {article.title}
          </Link>
        </h3>
        {isLarge && (article.dek || article.excerpt) ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-neutral-600">
            {article.dek ?? article.excerpt}
          </p>
        ) : null}
        <Meta article={article} />
      </div>
    </article>
  );
}
