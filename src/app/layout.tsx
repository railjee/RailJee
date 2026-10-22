import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans, Tiro_Devanagari_Hindi, Geist } from 'next/font/google';
import "./globals.css";
import { NavigationProvider } from "@/components/NavigationProvider";
import ExternalApiErrorProvider from "@/components/common/ExternalApiErrorProvider";
import MetaPixel from "@/components/MetaPixel";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
  adjustFontFallback: true, // auto-adjusts fallback font metrics to match Plus Jakarta Sans
  fallback: ['Arial', 'sans-serif'],
});

const tiroHindi = Tiro_Devanagari_Hindi({
  subsets: ['devanagari'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-hindi',
  display: 'swap',
  adjustFontFallback: false, // no good system fallback for Devanagari; skip to avoid worse shift
});

export const metadata: Metadata = {
  title: "Railjee - Railway Exam Platform",
  description: "Prepare for Railway exams with our comprehensive platform",
  icons: {
    icon: "/images/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(jakartaSans.variable, tiroHindi.variable, "font-sans", geist.variable)}>
      <head>
        {/* Preload above-the-fold images — browser fetches these before parsing <body> */}
        <link rel="preload" href="/images/logo.png" as="image" />
        <link rel="preload" href="/images/vande_bharat_01.avif" as="image" type="image/avif" />
        {/* Razorpay SDK */}
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      </head>
      <body className="antialiased">
        <Suspense>
          <NavigationProvider>
            <ExternalApiErrorProvider>
              {children}
            </ExternalApiErrorProvider>
          </NavigationProvider>
          <MetaPixel />
        </Suspense>
      </body>
    </html>
  );
}
