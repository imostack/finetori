import sanitizeHtml from "sanitize-html";

/**
 * Article bodies are rendered with dangerouslySetInnerHTML, so every path that
 * writes `articles.body` must run it through here first.
 *
 * Two untrusted-ish sources feed this field:
 *   1. The TipTap editor (a logged-in editor, but still browser-supplied HTML).
 *   2. Claude's generated markup in the ingestion pipeline.
 *
 * Neither should ever be able to introduce a script, an iframe, an event
 * handler, or a javascript: URL.
 */
export function sanitizeArticleHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "figure",
      "figcaption",
      "hr",
      "code",
      "pre",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      "*": [],
    },
    // Blocks javascript: and data: URLs.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    // Outbound links from article bodies should not pass ranking signal and
    // must not be able to reach back via window.opener.
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.href?.startsWith("http")
            ? { target: "_blank", rel: "noopener noreferrer nofollow" }
            : {}),
        },
      }),
    },
    disallowedTagsMode: "discard",
  });
}

/** Strict variant for short fields that should carry no markup at all. */
export function sanitizePlainText(dirty: string): string {
  return sanitizeHtml(dirty, { allowedTags: [], allowedAttributes: {} }).trim();
}
