"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { auditLog, sources } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/sanitize";

export type SourceState = { error?: string; message?: string };

const sourceSchema = z.object({
  name: z.string().min(2, "Give the source a name."),
  feedUrl: z.string().url("Enter a valid feed URL."),
  homepageUrl: z.string().url().optional().or(z.literal("")),
  trustWeight: z.coerce
    .number()
    .min(0.1, "Trust weight must be at least 0.1.")
    .max(3, "Trust weight cannot exceed 3."),
});

export async function addSourceAction(
  _prev: SourceState,
  formData: FormData,
): Promise<SourceState> {
  const user = await requireUser("admin");

  const parsed = sourceSchema.safeParse({
    name: formData.get("name"),
    feedUrl: formData.get("feedUrl"),
    homepageUrl: formData.get("homepageUrl") || "",
    trustWeight: formData.get("trustWeight") || 1,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await db.insert(sources).values({
      name: sanitizePlainText(parsed.data.name).slice(0, 160),
      feedUrl: parsed.data.feedUrl,
      homepageUrl: parsed.data.homepageUrl || null,
      trustWeight: parsed.data.trustWeight,
    });
  } catch {
    return { error: "That feed URL is already in the list." };
  }

  await db.insert(auditLog).values({
    userId: user.id,
    action: "add_source",
    entity: "source",
    meta: { name: parsed.data.name, feedUrl: parsed.data.feedUrl },
  });

  revalidatePath("/admin/sources");
  return { message: `Added ${parsed.data.name}.` };
}

export async function toggleSourceAction(formData: FormData): Promise<void> {
  await requireUser("admin");
  const id = String(formData.get("id") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!id) return;

  await db.update(sources).set({ enabled: !enabled }).where(eq(sources.id, id));
  revalidatePath("/admin/sources");
}

export async function deleteSourceAction(formData: FormData): Promise<void> {
  const user = await requireUser("admin");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [row] = await db
    .select({ name: sources.name })
    .from(sources)
    .where(eq(sources.id, id))
    .limit(1);

  // Cascades to that source's ingested items; published articles are
  // unaffected because they store their attribution independently.
  await db.delete(sources).where(eq(sources.id, id));

  await db.insert(auditLog).values({
    userId: user.id,
    action: "delete_source",
    entity: "source",
    entityId: id,
    meta: { name: row?.name },
  });

  revalidatePath("/admin/sources");
}
