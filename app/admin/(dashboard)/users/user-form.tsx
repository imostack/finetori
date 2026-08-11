"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createUserAction, type UserState } from "./actions";

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
      {pending ? "Creating…" : "Add team member"}
    </button>
  );
}

export function UserForm() {
  const [state, formAction] = useActionState<UserState, FormData>(
    createUserAction,
    {},
  );

  return (
    <form
      action={formAction}
      className="rounded-lg border border-neutral-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold">Add a team member</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="u-name" className="mb-1 block text-xs font-medium">
            Name
          </label>
          <input id="u-name" name="name" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="u-email" className="mb-1 block text-xs font-medium">
            Email
          </label>
          <input
            id="u-email"
            name="email"
            type="email"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="u-password"
            className="mb-1 block text-xs font-medium"
          >
            Temporary password
          </label>
          <input
            id="u-password"
            name="password"
            type="text"
            required
            minLength={10}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="u-role" className="mb-1 block text-xs font-medium">
            Role
          </label>
          <select
            id="u-role"
            name="role"
            defaultValue="writer"
            className={inputClass}
          >
            <option value="writer">Writer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor="u-bio" className="mb-1 block text-xs font-medium">
          Bio (shown on their author page)
        </label>
        <textarea id="u-bio" name="bio" rows={2} className={inputClass} />
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Writers draft and edit their own articles. Editors publish and manage
        the queue. Admins also manage sources and the team.
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
