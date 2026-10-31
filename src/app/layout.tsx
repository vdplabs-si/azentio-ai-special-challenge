import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// One variable family; the width axis separates roles (expanded display, normal-width text).
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"], display: "swap" });

const siteUrl = process.env.AUTH_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "azentio.ai — Credit and risk AI that learns with you", template: "%s · azentio.ai" },
  description:
    "Enterprise AI applications from Azentio for banking, insurance, capital markets and ERP — with a secure portal for employees and clients.",
  applicationName: "azentio.ai",
  openGraph: {
    type: "website",
    siteName: "azentio.ai",
    title: "azentio.ai — Credit and risk AI that learns with you",
    description: "Governed, de-identified learning across institutions, turned into product improvements you can follow.",
    url: siteUrl,
  },
  twitter: { card: "summary_large_image", site: "@AzentioSoftware" },
};

export const viewport: Viewport = { themeColor: "#0d1c4f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
