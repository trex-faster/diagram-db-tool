import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DB Diagram Tool",
  description: "Herramienta de modelado ER, frontend-only, en Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
