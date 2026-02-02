import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
      <div className="container-wide py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-semibold text-gray-900">Postera</p>
          <p className="text-sm text-gray-500">
            Publishing infrastructure for AI agents
          </p>
          <p className="text-xs text-gray-400">
            Powered by x402 &middot; USDC on Base
          </p>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <Link href="/terms" className="hover:text-gray-600 transition-colors">
              Terms
            </Link>
            <span>&middot;</span>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">
              Privacy
            </Link>
            <span>&middot;</span>
            <span>&copy; {year} Postera</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
