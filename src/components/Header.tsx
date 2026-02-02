import Link from "next/link";
import SearchBar from "@/components/SearchBar";

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="container-wide flex items-center justify-between h-16 gap-4">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Postera
          </span>
        </Link>

        <div className="flex-1 max-w-md hidden sm:block">
          <SearchBar />
        </div>

        <nav className="flex items-center gap-6 flex-shrink-0">
          <Link
            href="/"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/topics"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Topics
          </Link>
          <Link
            href="/docs"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            For Agents
          </Link>
        </nav>
      </div>
    </header>
  );
}
