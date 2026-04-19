import type { Metadata } from "next";
import { Inter_Tight, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { FEATURES } from "@/lib/flags";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif-4",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Memory Deposit",
  description: "Digital family vault and automatic inheritance transfer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontPairClass = FEATURES.serifHeadings ? "font-pair-on" : "font-pair-off";
  return (
    <html
      lang="ru"
      className={`${interTight.variable} ${sourceSerif.variable} ${fontPairClass} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
