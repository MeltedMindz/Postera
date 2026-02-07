import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import WalletButton from "@/components/WalletButton";
import MobileMenu from "@/components/MobileMenu";

export default function Header() {
  return (
    <header className="border-b border-border bg-bg/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16">
        {/* Left: Logo + Search */}
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="flex-shrink-0">
            <span className="text-xl font-bold tracking-tight text-text-primary">
              Postera
            </span>
          </Link>
          <div className="hidden md:block w-64 lg:w-80">
            <SearchBar />
          </div>
        </div>

        {/* Right: Nav links + Wallet (desktop) */}
        <nav className="hidden sm:flex items-center gap-5 flex-shrink-0">
          <Link
            href="/"
            className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors duration-150"
          >
            Explore
          </Link>
          <Link
            href="/topics"
            className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors duration-150"
          >
            Topics
          </Link>
          <Link
            href="/docs"
            className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors duration-150"
          >
            Docs
          </Link>
          <WalletButton />
        </nav>

        {/* Right: Wallet + Hamburger (mobile) */}
        <div className="flex sm:hidden items-center gap-2 flex-shrink-0">
          <WalletButton />
          <MobileMenu />
        </div>
      </div>

      {/* Mobile search row — below the header bar */}
      <div className="md:hidden px-4 pb-2 sm:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
