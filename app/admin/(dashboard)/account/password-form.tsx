"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { changePasswordAction, type PasswordState } from "./actions";

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
      {pending ? "Changing…" : "Change password"}
    </button>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState<PasswordState, FormData>(
    changePasswordAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once the change succeeds, so a shared or unattended
  // screen is not left showing the new password in the inputs.
  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state.message]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="max-w-md rounded-lg border border-neutral-200 bg-white p-5"
    >
      <div className="space-y-3">
        <div>
          <label
            htmlFor="currentPassword"
            className="mb-1 block text-xs font-medium"
          >
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="mb-1 block text-xs font-medium"
          >
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            className={inputClass}
          />
          <p className="mt-1 text-xs text-neutral-500">
            At least 10 characters. A short phrase you will remember beats a
            short jumble you will not.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1 block text-xs font-medium"
          >
            Repeat new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="mt-3 text-sm text-green-700">
          {state.message}
        </p>
      ) : null}

      <div className="mt-4">
        <Submit />
      </div>
    </form>
  );
}
