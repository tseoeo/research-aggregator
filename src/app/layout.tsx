import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research Aggregator",
  description: "Research aggregator application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
