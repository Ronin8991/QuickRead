import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "QuickRead",
  description: "RSVP reading experience for PDFs, books, and docs.",
  applicationName: "QuickRead",
  metadataBase: new URL("https://quickread.nervapp.it"),
  themeColor: "#f7f1e6",
  icons: {
    icon: "/icon.svg"
  },
  openGraph: {
    title: "QuickRead",
    description: "RSVP reading experience for PDFs, books, and docs.",
    url: "https://quickread.nervapp.it",
    siteName: "QuickRead",
    type: "website"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
