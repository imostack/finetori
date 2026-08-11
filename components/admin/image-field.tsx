"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/**
 * Cover image picker. Uploads to Blob storage and keeps the resulting URL in a
 * hidden input so it submits with the surrounding form.
 *
 * An article cannot be published without one — source photographs belong to
 * the outlets that took them, so the editor has to supply an image we own or
 * have licensed.
 */
export function ImageField({
  name,
  defaultValue,
  suggestion,
}: {
  name: string;
  defaultValue?: string | null;
  suggestion?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setStatus("uploading");
    setError("");

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        setUrl(data.url);
        setStatus("idle");
      } else {
        setStatus("error");
        setError(data.error ?? "Upload failed.");
      }
    } catch {
      setStatus("error");
      setError("Network error during upload.");
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} readOnly />

      {url ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
          {/* Unoptimized: the URL may be an arbitrary host the Next image
              optimizer is not configured for. */}
          <Image
            src={url}
            alt="Cover preview"
            fill
            unoptimized
            className="object-cover"
          />
          <button
            type="button"
            onClick={() => setUrl("")}
            className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white transition hover:bg-black"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
          <p className="text-sm text-neutral-600">
            No cover image. One is required before publishing.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={status === "uploading"}
            className="mt-3 rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
          >
            {status === "uploading" ? "Uploading…" : "Upload image"}
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      {url ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 text-sm text-neutral-600 underline-offset-4 hover:underline"
        >
          Replace image
        </button>
      ) : null}

      {status === "error" ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {suggestion && !url ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Source image — reference only
          </p>
          <p className="mt-1 text-xs text-amber-900">
            This is the photo the original outlet used, shown so you know what
            the story looks like. It is their copyright — do not republish it.
            Upload our own or a licensed image instead.
          </p>
          <a
            href={suggestion}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-xs text-amber-800 underline"
          >
            View source image
          </a>
        </div>
      ) : null}
    </div>
  );
}
