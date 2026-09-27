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
    "A working early-warning system for enforced disappearances in Kenya: real ingested data (Missing Voices, public-record curation, KNBS 2019 census, UCDP GED), a six-stage bias-corrected statistical engine, a walk-forward backtested forecast, and aggregate-only protective alerts. Includes the Gap Report landscape analysis.",
  keywords: [
    "early warning system",
    "enforced disappearances",
    "Kenya",
    "human rights",
    "OSINT",
    "bias correction",
    "predictive modeling",
  ],
  openGraph: {
    title: "KAMPS · Kenya Abduction Monitoring & Prediction System",
    description:
      "Real data, real statistics: a bias-corrected early-warning instrument for enforced disappearances in Kenya, with the full landscape analysis of who else is doing this.",
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
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
