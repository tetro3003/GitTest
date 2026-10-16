import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { DemoPanel } from "@/components/demo-panel";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/config";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const display = Manrope({ variable: "--font-display", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: `${PRODUCT_NAME} — income & risk profiles for the self-employed`, template: `%s · ${PRODUCT_NAME}` },
  description: PRODUCT_TAGLINE,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafa" },
    { media: "(prefers-color-scheme: dark)", color: "#151c21" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${display.variable} min-h-dvh antialiased`}>
        <Providers>
          {children}
          <DemoPanel />
        </Providers>
      </body>
    </html>
  );
}
