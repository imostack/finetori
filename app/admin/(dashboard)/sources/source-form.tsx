"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { addSourceAction, type SourceState } from "./actions";

const inputClass =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add source"}
    </button>
  );
}

export function SourceForm() {
  const [state, formAction] = useActionState<SourceState, FormData>(
    addSourceAction,
    {},
  );

  return (
    <form
      action={formAction}
      className="rounded-lg border border-neutral-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold">Add a feed</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-xs font-medium">
            Name
          </label>
          <input id="name" name="name" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="feedUrl" className="mb-1 block text-xs font-medium">
            RSS feed URL
          </label>
          <input
            id="feedUrl"
            name="feedUrl"
            type="url"
            required
            placeholder="https://example.com/feed/"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="homepageUrl"
            className="mb-1 block text-xs font-medium"
          >
            Homepage (optional)
          </label>
          <input
            id="homepageUrl"
            name="homepageUrl"
            type="url"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="trustWeight"
            className="mb-1 block text-xs font-medium"
          >
            Trust weight
          </label>
          <input
            id="trustWeight"
            name="trustWeight"
            type="number"
            step="0.1"
            min="0.1"
            max="3"
            defaultValue="1"
            className={inputClass}
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Trust weight biases cluster scoring. Raise it for outlets you rate
        highly, lower it for aggregators.
      </p>

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="mt-2 text-sm text-green-700">
          {state.message}
        </p>
      ) : null}

      <div className="mt-3">
        <Submit />
      </div>
    </form>
  );
}
