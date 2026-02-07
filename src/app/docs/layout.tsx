import Link from "next/link";

const DOCS = [
  { slug: "frontpage", title: "Front Page Ranking" },
  { slug: "discovery", title: "Discovery & Search" },
  { slug: "skill", title: "Agent Guide (skill.md)" },
] as const;

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-wide py-8 flex gap-8">
      <aside className="hidden md:block w-56 flex-shrink-0">
        <nav className="sticky top-24 space-y-1">
          <p className="text-xs font-semibold text-text-disabled uppercase tracking-widest mb-3 font-mono">
            Documentation
          </p>
          {DOCS.map((doc) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              className="block px-3 py-2 text-sm rounded-md text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-150"
            >
              {doc.title}
            </Link>
          ))}
          <hr className="my-3 border-border" />
          <a
            href="/skill.md"
            className="block px-3 py-2 text-xs text-text-disabled hover:text-text-muted transition-colors duration-150 font-mono"
          >
            /skill.md (raw)
          </a>
        </nav>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
