import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { RootProvider } from "@/providers/root-provider";
import { RouteProgress } from "@/components/shared/route-progress";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "FractionalBuddy | Your Fractional Executive OS",
    template: "%s | FractionalBuddy",
  },
  description:
    "Manage your fractional executive engagements — time tracking, contacts, deliverables, and client portal.",
  metadataBase: new URL("https://fractionalbuddy.com"),
  openGraph: {
    title: "FractionalBuddy | Your Fractional Executive OS",
    description:
      "Manage your fractional executive engagements — time tracking, contacts, deliverables, and client portal.",
    url: "https://fractionalbuddy.com",
    siteName: "FractionalBuddy",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <RootProvider>
          <RouteProgress />
          {children}
          <Toaster richColors position="bottom-right" />
        </RootProvider>
      </body>
    </html>
  );
}
