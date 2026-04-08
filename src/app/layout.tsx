import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar"

export const metadata: Metadata = {
  title: "Family Legacy",
  description: "A living family history app",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100">
        <AuthProvider>
          <NavBar />
          <main className="container mx-auto p-4">{children}</main>
        </AuthProvider>
      </body>
    </html>
  )
}
