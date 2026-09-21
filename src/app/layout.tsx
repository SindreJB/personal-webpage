import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sindre Jentoft Bøe",
  description: "Personal index of Sindre Jentoft Bøe",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
