"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { hashPassword, requireUser } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/sanitize";
import { slugify } from "@/lib/utils";

export type UserState = { error?: string; message?: string };

const newUserSchema = z.object({
  name: z.string().min(2, "Enter the person's name."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(10, "Password must be at least 10 characters."),
  role: z.enum(["admin", "editor", "writer"]),
  bio: z.string().optional(),
});

export async function createUserAction(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const actor = await requireUser("admin");

  const parsed = newUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    bio: formData.get("bio") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const name = sanitizePlainText(parsed.data.name).slice(0, 120);
  const email = parsed.data.email.trim().toLowerCase();

  // Author slugs are public URLs and must be unique.
  let slug = slugify(name) || "author";
  const clash = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.slug, slug))
    .limit(1);
  if (clash.length > 0) slug = `${slug}-${Date.now().toString(36)}`;

  try {
    await db.insert(users).values({
      name,
      email,
      slug,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      bio: parsed.data.bio
        ? sanitizePlainText(parsed.data.bio).slice(0, 600)
        : null,
    });
  } catch {
    return { error: "A user with that email already exists." };
  }

  await db.insert(auditLog).values({
    userId: actor.id,
    action: "create_user",
    entity: "user",
    meta: { email, role: parsed.data.role },
  });

  revalidatePath("/admin/users");
  return { message: `${name} can now sign in.` };
}

export async function toggleUserActiveAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireUser("admin");
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!id) return;

  // Locking yourself out of the only admin account is unrecoverable from the
  // UI, so refuse it.
  if (id === actor.id) return;

  await db.update(users).set({ isActive: !isActive }).where(eq(users.id, id));

  await db.insert(auditLog).values({
    userId: actor.id,
    action: isActive ? "deactivate_user" : "activate_user",
    entity: "user",
    entityId: id,
  });

  revalidatePath("/admin/users");
}
