import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

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

function configured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export async function POST(request: Request) {
  const auth = await requireUserApi("writer");
  if ("error" in auth) return auth.error;

  if (!configured()) {
    return Response.json(
      {
        error:
          "Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      },
      { status: 503 },
    );
  }

  // Configure per request rather than at module scope: the route is dynamic,
  // and reading env lazily keeps a missing variable from throwing during
  // Next.js's build-time module evaluation.
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

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

  // Never trust the client-supplied filename as a path. Cloudinary derives the
  // public_id from this, so it becomes part of a public URL.
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "image";

  try {
    const bytes = Buffer.from(await file.arrayBuffer());

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "finetori/articles",
          public_id: `${Date.now()}-${base}`,
          resource_type: "image",
          overwrite: false,
          // Strip camera EXIF, which can carry the photographer's location.
          invalidate: true,
        },
        (error, uploadResult) => {
          if (error) reject(error);
          else if (!uploadResult) reject(new Error("Empty upload response."));
          else resolve(uploadResult);
        },
      );
      stream.end(bytes);
    });

    // Store the plain delivery URL. Format, quality and width are applied at
    // render time by the loader in lib/cloudinary-loader.ts, so one stored URL
    // serves every breakpoint rather than freezing a single size here.
    return Response.json({
      url: result.secure_url,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    console.error("cloudinary upload failed", error);
    return Response.json({ error: "Upload failed." }, { status: 500 });
  }
}
