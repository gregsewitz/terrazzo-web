import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display, Space_Mono } from "next/font/google";
import "./globals.css";
import GlobalImportUI from "@/components/GlobalImportUI";
import StoreHydration from "@/components/StoreHydration";
import SaveIndicator from "@/components/SaveIndicator";
import { AuthProvider } from "@/context/AuthContext";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-serif",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Terrazzo — Your Bespoke Travel Concierge",
  description: "Collect, curate, and plan your trips with places matched to your taste",
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable} ${spaceMono.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          <StoreHydration />
          {children}
          <GlobalImportUI />
          <SaveIndicator />
        </AuthProvider>
      </body>
    </html>
  );
}
