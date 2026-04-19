import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
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
  return (
    <html lang="ru" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
