import { put } from "@vercel/blob";

import { requireUserApi } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

export async function POST(request: Request) {
  const auth = await requireUserApi("writer");
  if ("error" in auth) return auth.error;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      {
        error:
          "Image storage is not configured. Set BLOB_READ_WRITE_TOKEN in your environment.",
      },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json(
      { error: "Upload a JPEG, PNG, WebP, AVIF or GIF image." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "Image must be smaller than 8 MB." },
      { status: 413 },
    );
  }

  // Never trust the client-supplied filename as a path.
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "image";
  const key = `articles/${Date.now()}-${base}.${extension}`;

  try {
    const blob = await put(key, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: true,
    });
    return Response.json({ url: blob.url });
  } catch (error) {
    console.error("upload failed", error);
    return Response.json({ error: "Upload failed." }, { status: 500 });
  }
}
