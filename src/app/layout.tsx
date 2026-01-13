import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Research Aggregator - AI Research Papers with Social Context",
  description:
    "Discover the latest AI research papers from arXiv with AI-generated summaries and social media discussions.",
  keywords: ["AI", "machine learning", "research", "arxiv", "papers"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${dmMono.variable} font-sans antialiased min-h-screen flex flex-col`}
      >
        <Providers>
          <Header />
          <main className="flex-1 container px-4 py-6 sm:px-6 sm:py-8 lg:py-10 2xl:max-w-[1600px]">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
