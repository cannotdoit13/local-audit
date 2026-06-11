import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Locality Audit — Pune Neighbourhood Safety Map",
  description:
    "Live safety scores for every locality and society in Pune. Color-coded map with real-time crime, civic, and infrastructure news. Know before you move.",
  keywords: [
    "Pune safety",
    "Pune society reviews",
    "Pune neighbourhood safety",
    "Pune crime map",
    "Pune locality score",
    "RERA Pune",
  ],
  openGraph: {
    title: "Locality Audit — Is your neighbourhood safe?",
    description:
      "Live safety map of Pune. Every locality graded. Every society scored.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
