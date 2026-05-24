import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";
import { RouteFocusManager } from "@/components/RouteFocusManager";
import { ThemeScript } from "@/components/ThemeScript";
import { MAIN_LANDMARK_ID } from "@/config/constants";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Family Legacy",
  description: "A living family history app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <AuthProvider>
          <NavBar />
          <RouteFocusManager />
          <main id={MAIN_LANDMARK_ID} tabIndex={-1}>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
