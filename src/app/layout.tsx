import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "★ home base ★",
  description: "personal site — projects, wishlist, apartment, the works",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen relative">
        <Navbar />
        <main className="relative z-10">{children}</main>
        <footer className="relative z-10 mt-20 border-t-[3px] border-black bg-chrome-900 text-chrome-50 py-6 text-center font-mono text-sm">
          <span className="blink">▮</span> built with love &amp; questionable taste · {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
