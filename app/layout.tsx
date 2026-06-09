import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { APP_VERSION } from "@/lib/version";

export const metadata: Metadata = {
  title: "BenchPilot",
  description: "Evidence-based lifting tracker",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "BenchPilot" },
  // Cache-busting marker — renders <meta name="app-version">. See lib/version.ts.
  other: { "app-version": APP_VERSION },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        {children}
        <Toaster theme="dark" position="top-center" richColors closeButton={false} />
      </body>
    </html>
  );
}
