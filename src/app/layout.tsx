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
  title: "The Gap Report · Global Landscape: Who Else Is Doing This?",
  description:
    "A comparative assessment of eight global organizations against a proposed predictive early-warning system for state abductions of activists and journalists. The pieces exist; nobody has assembled them.",
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
    title: "The Gap Report · Global Landscape",
    description:
      "Who else is building predictive early-warning systems for enforced disappearances? Eight organizations analyzed; the assembly does not exist anywhere.",
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
