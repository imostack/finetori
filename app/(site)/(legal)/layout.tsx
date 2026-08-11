export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="article-body">{children}</div>
    </div>
  );
}
