"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget view ping that feeds the trending rail.
 *
 * Uses sendBeacon so the request survives the user navigating away
 * immediately, and a sessionStorage guard so a refresh or a back-navigation
 * does not inflate the count for the same reader.
 */
export function ViewTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    const key = `finetori:viewed:${articleId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode or storage disabled — still count the view.
    }

    const url = `/api/views/${articleId}`;
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url);
    } else {
      void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    }
  }, [articleId]);

  return null;
}
