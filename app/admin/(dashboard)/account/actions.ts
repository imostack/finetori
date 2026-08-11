"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";

export type PasswordState = { error?: string; message?: string };

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(10, "Your new password must be at least 10 characters."),
    confirmPassword: z.string().min(1, "Type the new password again."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "The two new passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Your new password must be different from the current one.",
    path: ["newPassword"],
  });

export async function changePasswordAction(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const user = await requireUser("writer");

  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const [account] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!account) return { error: "Account not found." };

  // Proving knowledge of the current password is what stops someone who finds
  // an unattended signed-in browser from locking the real owner out.
  const valid = await verifyPassword(
    parsed.data.currentPassword,
    account.passwordHash,
  );
  if (!valid) return { error: "That is not your current password." };

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword) })
    .where(eq(users.id, user.id));

  await db.insert(auditLog).values({
    userId: user.id,
    action: "change_password",
    entity: "user",
    entityId: user.id,
  });

  return { message: "Password changed. Use it the next time you sign in." };
}
