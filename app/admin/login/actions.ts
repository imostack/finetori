"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { authenticate, createSession } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error };

  await createSession(result.user);

  // Only allow same-origin relative paths, so `?next=` can't be used as an
  // open redirect to an attacker-controlled host.
  const target = parsed.data.next;
  const safeTarget =
    target && target.startsWith("/") && !target.startsWith("//")
      ? target
      : "/admin";

  redirect(safeTarget);
}
