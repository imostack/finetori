import crypto from "node:crypto";
import { z } from "zod";

import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(255),
  source: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  try {
    await db
      .insert(newsletterSubscribers)
      .values({
        email,
        source: parsed.data.source ?? "site",
        unsubscribeToken: crypto.randomBytes(24).toString("hex"),
        // Single opt-in for now. Wire a confirmation email here before any
        // bulk sending to keep deliverability sane.
        confirmedAt: new Date(),
      })
      // Re-subscribing an existing address should clear a previous
      // unsubscribe rather than error.
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        set: { unsubscribedAt: null },
      });
  } catch (error) {
    console.error("newsletter subscribe failed", error);
    return Response.json(
      { error: "Could not subscribe right now. Please try again." },
      { status: 500 },
    );
  }

  return Response.json({ message: "You are on the list. Welcome aboard." });
}
