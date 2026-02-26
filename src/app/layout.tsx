import type { Metadata } from "next";
import { Lexend, Fraunces } from "next/font/google";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import "./globals.css";

const lexend = Lexend({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-lexend",
  adjustFontFallback: true,
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: "italic",
  display: "optional",
  variable: "--font-fraunces",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Owocni — Strony WWW Warszawa",
  description: "Profesjonalne strony WWW w Warszawie. 100% gwarancji, 20 lat doświadczenia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${lexend.variable} ${fraunces.variable}`}>
      <body>
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
