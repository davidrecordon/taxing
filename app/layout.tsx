import type { Metadata } from "next";
import { DM_Sans, Geist_Mono, Inter } from "next/font/google";
import AnalyticsWrapper from "@/components/UI/AnalyticsWrapper";
import "./globals.css";

// Dark theme font - geometric sans-serif
const inter = Inter({
  variable: "--font-satoshi",
  subsets: ["latin"],
  display: "swap",
});

// Light theme font - rounded, friendly sans-serif
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Estimated Taxes Calculator",
  description:
    "Calculate your 2025 estimated taxes for both Federal and California, Colorado, District of Columbia, Florida, Illinois, New York, or Washington returns. Supports all filing statuses, capital gains, and common deductions.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

// Inline script to prevent flash of wrong theme
const themeInitScript = `
  (function() {
    var theme = 'light';
    var darkBg = '#0f172a';
    var lightBg = '#fefdfb';
    try {
      var stored = localStorage.getItem('tax-calc-theme');
      if (stored) {
        theme = stored;
      } else {
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
      }
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.backgroundColor = theme === 'dark' ? darkBg : lightBg;
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body
        className={`${dmSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
      >
        {children}
        <AnalyticsWrapper />
      </body>
    </html>
  );
}
