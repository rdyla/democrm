import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

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
        <div className="grid h-screen grid-cols-[240px_1fr]">
          <Sidebar />
          <main className="overflow-y-auto bg-[var(--background)]">{children}</main>
        </div>
        {/* Zoom Virtual Agent chat widget (web SDK chat client) */}
        <Script
          id="zoom-virtual-agent"
          src="https://us01ccistatic.zoom.us/us01cci/web-sdk/chat-client.js"
          type="module"
          strategy="lazyOnload"
          data-apikey="q5EuEAf4R0uF6QXOjpLH3A"
          data-env="us01"
        />
      </body>
    </html>
  );
}
