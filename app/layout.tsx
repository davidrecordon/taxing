import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AnalyticsWrapper from "@/components/UI/AnalyticsWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <AnalyticsWrapper />
      </body>
    </html>
  );
}
