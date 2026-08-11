"use client";

import type { ImageLoaderProps } from "next/image";

/**
 * Rewrites Cloudinary URLs so `next/image` requests a transformed asset
 * directly from Cloudinary's CDN instead of proxying through the host's own
 * image optimizer.
 *
 * This is the reason for choosing Cloudinary: an editor uploads a 4 MB press
 * photo once, and each reader gets it re-encoded to AVIF or WebP and sized to
 * their actual viewport. On a photo-per-article news site read mostly on
 * metered mobile data, that is the difference between a 4 MB page and a
 * ~120 KB one.
 *
 * Anything that is not a Cloudinary delivery URL passes through untouched, so
 * local assets under /public still work.
 */
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  const marker = "/image/upload/";
  const split = src.indexOf(marker);
  if (split === -1) return src;

  const prefix = src.slice(0, split + marker.length);
  const rest = src.slice(split + marker.length);

  const transformations = [
    "f_auto", // AVIF/WebP where the browser accepts it
    `q_${quality ?? "auto"}`, // per-image quality, not a fixed number
    `w_${width}`,
    "c_limit", // never upscale past the original
  ].join(",");

  return `${prefix}${transformations}/${rest}`;
}
