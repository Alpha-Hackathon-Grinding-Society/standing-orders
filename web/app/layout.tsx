import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-roboto-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Steward · money rules that run themselves",
  description:
    "Save a share of your income, claim vested tokens and protect your savings with a dead-man switch, run by your own reactive contract.",
  icons: { icon: "/brand/steward-app-icon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className="min-h-screen bg-canvas">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
