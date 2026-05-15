import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { SmartEmbedDock } from "@/components/SmartEmbedDock";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Acme CRM — Powered by Zoom Contact Center",
  description: "Demo CRM showcasing Zoom Contact Center Smart Embed integration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen">
        <div className="grid h-screen grid-cols-[240px_1fr_400px]">
          <Sidebar />
          <main className="overflow-y-auto bg-[var(--background)]">{children}</main>
          <SmartEmbedDock />
        </div>
      </body>
    </html>
  );
}
