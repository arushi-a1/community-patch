import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { CelebrationProvider } from "@/components/ui/Celebration";
import { SessionProvider } from "@/components/providers/SessionProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Editorial display face for expressive headlines (part of the visual identity).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PATCH — Your community, one solution away",
  description:
    "A hyperlocal, AI-powered community platform that helps you solve everyday problems with the people, things, and resources around you.",
};

export const viewport: Viewport = {
  themeColor: "#2f3b2a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <a href="#main" className="sr-only">
          Skip to main content
        </a>
        <ToastProvider>
          <CelebrationProvider>
            <SessionProvider>
              <AppShell>{children}</AppShell>
            </SessionProvider>
          </CelebrationProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
