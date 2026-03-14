import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, Space_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import GlobalImportUI from "@/components/GlobalImportUI";
import UniversalAddBar from "@/components/UniversalAddBar";
import StoreHydration from "@/components/StoreHydration";
import EnrichmentWatcher from "@/components/EnrichmentWatcher";
import SaveIndicator from "@/components/SaveIndicator";
import { AuthProvider } from "@/context/AuthContext";
import MapsProvider from "@/components/MapsProvider";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["700"],
  style: ["italic"],
  variable: "--font-fraunces",
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
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/favicon.png',
        type: 'image/png',
        sizes: '32x32',
      },
    ],
    apple: {
      url: '/apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${spaceGrotesk.variable} ${fraunces.variable} ${spaceMono.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          <MapsProvider>
            <StoreHydration />
            <EnrichmentWatcher />
            {children}
            <GlobalImportUI />
            <UniversalAddBar />
            <SaveIndicator />
          </MapsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
