import { asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { articles, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { UserForm } from "./user-form";
import { ResetPassword } from "./reset-password";
import { toggleUserActiveAction } from "./actions";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-neutral-900 text-white",
  editor: "bg-brand-100 text-brand-700",
  writer: "bg-neutral-100 text-neutral-700",
};

export default async function UsersPage() {
  const actor = await requireUser("admin");

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      slug: users.slug,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      articleCount: count(articles.id),
    })
    .from(users)
    .leftJoin(articles, eq(articles.authorId, users.id))
    .groupBy(users.id)
    .orderBy(asc(users.name));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Who can sign in to the newsroom, and what they can do.
        </p>
      </header>

      <UserForm />

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="w-28 px-4 py-2.5 font-medium">Role</th>
              <th className="w-24 px-4 py-2.5 font-medium">Articles</th>
              <th className="w-32 px-4 py-2.5 font-medium">Joined</th>
              <th className="w-32 px-4 py-2.5 font-medium">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-neutral-50">
                <td className="px-4 py-2.5">
                  <span className="font-medium">{row.name}</span>
                  {row.id === actor.id ? (
                    <span className="ml-2 text-xs text-neutral-500">(you)</span>
                  ) : null}
                  <p className="text-xs text-neutral-500">{row.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[row.role]}`}
                  >
                    {row.role}
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-neutral-600">
                  {row.articleCount}
                </td>
                <td className="px-4 py-2.5 text-neutral-500">
                  {formatDate(row.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col items-start gap-1.5">
                    {row.id === actor.id ? (
                      <span className="text-xs text-neutral-400">
                        Change your own password under Your account
                      </span>
                    ) : (
                      <>
                        <form action={toggleUserActiveAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <input
                            type="hidden"
                            name="isActive"
                            value={String(row.isActive)}
                          />
                          <button
                            type="submit"
                            className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium transition hover:border-neutral-900"
                          >
                            {row.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                        <ResetPassword userId={row.id} />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
