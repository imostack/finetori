"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { useCallback, useEffect } from "react";

import { cn } from "@/lib/utils";

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={cn(
        "rounded px-2 py-1 text-sm font-medium transition",
        active
          ? "bg-neutral-900 text-white"
          : "text-neutral-700 hover:bg-neutral-200",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        label="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        label="Italic"
      >
        <em>I</em>
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-neutral-300" aria-hidden="true" />

      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        active={editor.isActive("heading", { level: 2 })}
        label="Subheading"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        active={editor.isActive("heading", { level: 3 })}
        label="Sub-subheading"
      >
        H3
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-neutral-300" aria-hidden="true" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label="Bulleted list"
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label="Numbered list"
      >
        1. List
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        label="Quote"
      >
        &ldquo;
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-neutral-300" aria-hidden="true" />

      <ToolbarButton
        onClick={setLink}
        active={editor.isActive("link")}
        label="Add or edit link"
      >
        Link
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        label="Clear formatting"
      >
        Clear
      </ToolbarButton>
    </div>
  );
}

/**
 * Article body editor.
 *
 * Emits HTML into a hidden input so the surrounding <form> submits it as part
 * of a normal server action — no client-side fetch plumbing needed. The HTML
 * is sanitized server-side on save regardless of what the editor produces.
 */
export function RichEditor({
  name,
  defaultValue,
  placeholder = "Write the story…",
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const editor = useEditor({
    // Required in Next: the editor must not render during SSR.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer nofollow" },
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: defaultValue ?? "",
    editorProps: {
      attributes: {
        class: "article-body min-h-[380px] px-4 py-3 focus:outline-none",
      },
    },
  });

  // Keep the hidden input in sync so a form submit always carries the latest
  // content, even if the editor never loses focus.
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const input = document.querySelector<HTMLInputElement>(
        `input[name="${name}"]`,
      );
      if (input) input.value = editor.getHTML();
    };
    sync();
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
    };
  }, [editor, name]);

  return (
    <div className="overflow-hidden rounded-md border border-neutral-300 bg-white focus-within:border-neutral-900">
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
      <input type="hidden" name={name} defaultValue={defaultValue ?? ""} />
    </div>
  );
}
