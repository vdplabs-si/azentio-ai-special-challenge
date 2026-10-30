import type { Metadata, Viewport } from "next";
import { Manrope, Source_Sans_3 } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const display = Manrope({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const text = Source_Sans_3({ variable: "--font-text", subsets: ["latin"], display: "swap" });

const siteUrl = process.env.AUTH_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "azentio.ai — Build Intelligence. Create Impact.", template: "%s · azentio.ai" },
  description:
    "Enterprise AI applications from Azentio for banking, insurance, capital markets and ERP — with a secure portal for employees and clients.",
  applicationName: "azentio.ai",
  openGraph: {
    type: "website",
    siteName: "azentio.ai",
    title: "azentio.ai — Build Intelligence. Create Impact.",
    description: "From ideas to intelligent products. From complexity to clarity.",
    url: siteUrl,
  },
  twitter: { card: "summary_large_image", site: "@AzentioSoftware" },
};

export const viewport: Viewport = { themeColor: "#171b3a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
