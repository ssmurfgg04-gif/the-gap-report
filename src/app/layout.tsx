import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/site/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KAMPS · Kenya Abduction Monitoring & Prediction System",
  description:
    "Kenya's enforced-disappearance count, corrected. Real data you can check (Missing Voices, KNCHR, sourced news, UCDP 1989-2025), a six-stage bias-corrected engine, a backtested forecast, and pattern vehicles. Aggregate output only.",
  keywords: [
    "enforced disappearances",
    "Kenya",
    "abductions",
    "early warning",
    "human rights data",
    "Missing Voices",
    "KNCHR",
  ],
  openGraph: {
    title: "KAMPS · the count, corrected",
    description:
      "Bias-corrected zone risk, capture-recapture undercount, pattern vehicles, and an analyst you can question. Built on sources you can open.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <div className="grain-overlay" aria-hidden="true" />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
