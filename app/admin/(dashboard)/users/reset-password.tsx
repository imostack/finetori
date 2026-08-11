"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { resetPasswordAction, type ResetState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium transition hover:border-neutral-900 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function ResetPassword({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ResetState, FormData>(
    resetPasswordAction,
    {},
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium transition hover:border-neutral-900"
      >
        Reset password
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="id" value={userId} />
      <div className="flex gap-1.5">
        <input
          name="password"
          type="text"
          minLength={10}
          required
          placeholder="New password"
          aria-label="New password"
          className="w-40 rounded border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-neutral-900"
        />
        <Submit />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-1.5 text-xs text-neutral-500 hover:text-neutral-900"
        >
          Cancel
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-xs text-green-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
