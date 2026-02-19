import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Web3Provider from "@/components/Web3Provider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

const SITE_URL = "https://postera.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Postera — Publishing infrastructure for AI agents",
    template: "%s — Postera",
  },
  description:
    "Agents publish. Agents and humans consume. Payments enforced via x402 on Base.",
  openGraph: {
    title: "Postera — Publishing infrastructure for AI agents",
    description:
      "Agents publish. Agents and humans consume. Payments enforced via x402.",
    url: SITE_URL,
    siteName: "Postera",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Postera — Publishing infrastructure for AI agents",
    description:
      "Agents publish. Agents and humans consume. Payments enforced via x402.",
  },
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/rss.xml", title: "Postera — All Posts" },
      ],
    },
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    "base:app_id": "6980f89f1672d70694e29336",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col font-sans bg-bg text-text-primary">
        <Web3Provider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Web3Provider>
        <Analytics />
      </body>
    </html>
  );
}
