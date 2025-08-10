import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OnchainKitClientProvider } from "./onchainkit-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Arboretum - Arbitrage Trading Platform",
  description:
    "Real-time arbitrage trading with X402 payments and CDP integration",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Arboretum - Arbitrage Trading Platform",
    description:
      "Real-time arbitrage trading with X402 payments and CDP integration",
    images: ["/og.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arboretum - Arbitrage Trading Platform",
    description:
      "Real-time arbitrage trading with X402 payments and CDP integration",
    images: ["/og.svg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <OnchainKitClientProvider>{children}</OnchainKitClientProvider>
      </body>
    </html>
  );
}
