"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { RichEditor } from "@/components/admin/rich-editor";
import { ImageField } from "@/components/admin/image-field";
import { StatusPill } from "@/components/admin/status-pill";
import { saveArticleAction, type ActionState } from "../../actions";
import type { ArticleStatus } from "@/db/schema";

type Option = { id: string; name: string };

export type ArticleFormData = {
  id: string;
  title: string;
  dek: string | null;
  body: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverCaption: string | null;
  coverCredit: string | null;
  categoryId: string | null;
  authorId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isBreaking: boolean;
  isFeatured: boolean;
  status: ArticleStatus;
  slug: string;
  aiGenerated: boolean;
  sourceAttribution: { name: string; url: string }[] | null;
};

function Submit({
  intent,
  children,
  variant = "secondary",
  onClick,
}: {
  intent: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-brand-700 text-white hover:bg-brand-900",
    secondary:
      "border border-neutral-300 text-neutral-800 hover:border-neutral-900",
    danger: "border border-red-300 text-red-700 hover:bg-red-50",
  }[variant];

  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${styles}`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-800">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";

export function ArticleForm({
  article,
  categories,
  authors,
  canPublish,
  sourceImageSuggestion,
}: {
  article: ArticleFormData;
  categories: Option[];
  authors: Option[];
  canPublish: boolean;
  sourceImageSuggestion?: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveArticleAction,
    {},
  );
  const [showSchedule, setShowSchedule] = useState(false);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={article.id} />

      {/* Header bar */}
      <div className="sticky top-0 z-10 -mx-8 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50/95 px-8 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/posts"
            className="text-sm text-neutral-600 hover:underline"
          >
            ← Articles
          </Link>
          <StatusPill status={article.status} />
          {article.aiGenerated ? (
            <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              AI draft
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Submit intent="save">Save</Submit>

          {canPublish && article.status !== "published" ? (
            <>
              <button
                type="button"
                onClick={() => setShowSchedule((v) => !v)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:border-neutral-900"
              >
                Schedule
              </button>
              <Submit intent="publish" variant="primary">
                Publish now
              </Submit>
            </>
          ) : null}

          {canPublish && article.status === "published" ? (
            <>
              <a
                href={`/${article.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold transition hover:border-neutral-900"
              >
                View ↗
              </a>
              <Submit intent="unpublish" variant="danger">
                Unpublish
              </Submit>
            </>
          ) : null}
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p
          role="status"
          className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {state.message}
        </p>
      ) : null}

      {showSchedule ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <Field
            label="Publish at"
            hint="West Africa Time. The scheduler checks every 5 minutes."
          >
            <input
              type="datetime-local"
              name="scheduledFor"
              className={inputClass}
            />
          </Field>
          <div className="mt-3">
            <Submit intent="schedule" variant="primary">
              Confirm schedule
            </Submit>
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          <Field label="Headline">
            <input
              name="title"
              defaultValue={article.title}
              required
              className={`${inputClass} text-lg font-semibold`}
            />
          </Field>

          <Field
            label="Standfirst"
            hint="One sentence that adds to the headline rather than repeating it."
          >
            <input
              name="dek"
              defaultValue={article.dek ?? ""}
              className={inputClass}
            />
          </Field>

          <Field label="Body">
            <RichEditor name="body" defaultValue={article.body} />
          </Field>

          {article.sourceAttribution &&
          article.sourceAttribution.length > 0 ? (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
              <h2 className="text-sm font-semibold">Source attribution</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Published with the article. Verify every claim against these
                before approving.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {article.sourceAttribution.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 hover:underline"
                    >
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Field label="Cover image">
            <ImageField
              name="coverImageUrl"
              defaultValue={article.coverImageUrl}
              suggestion={sourceImageSuggestion}
            />
          </Field>

          <Field label="Caption">
            <input
              name="coverCaption"
              defaultValue={article.coverCaption ?? ""}
              className={inputClass}
            />
          </Field>

          <Field label="Photo credit">
            <input
              name="coverCredit"
              defaultValue={article.coverCredit ?? ""}
              placeholder="e.g. Getty Images"
              className={inputClass}
            />
          </Field>

          <Field label="Section">
            <select
              name="categoryId"
              defaultValue={article.categoryId ?? ""}
              className={inputClass}
            >
              <option value="">— Select a section —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Byline">
            <select
              name="authorId"
              defaultValue={article.authorId ?? ""}
              className={inputClass}
            >
              <option value="">— Select an author —</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          {canPublish ? (
            <fieldset className="space-y-2 rounded-md border border-neutral-200 p-3">
              <legend className="px-1 text-sm font-medium">Placement</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isFeatured"
                  defaultChecked={article.isFeatured}
                  className="h-4 w-4"
                />
                Feature on homepage hero
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isBreaking"
                  defaultChecked={article.isBreaking}
                  className="h-4 w-4"
                />
                Breaking news banner
              </label>
              <p className="text-xs text-neutral-500">
                The breaking banner clears itself 12 hours after publication.
              </p>
            </fieldset>
          ) : null}

          <details className="rounded-md border border-neutral-200 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              SEO
            </summary>
            <div className="mt-3 space-y-4">
              <Field label="SEO title" hint="60 characters max.">
                <input
                  name="seoTitle"
                  defaultValue={article.seoTitle ?? ""}
                  maxLength={70}
                  className={inputClass}
                />
              </Field>
              <Field label="Meta description" hint="155 characters max.">
                <textarea
                  name="seoDescription"
                  defaultValue={article.seoDescription ?? ""}
                  maxLength={200}
                  rows={3}
                  className={inputClass}
                />
              </Field>
              <Field label="Excerpt">
                <textarea
                  name="excerpt"
                  defaultValue={article.excerpt ?? ""}
                  rows={3}
                  className={inputClass}
                />
              </Field>
            </div>
          </details>
        </div>
      </div>
    </form>
  );
}
