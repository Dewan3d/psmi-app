import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSMI — Power Station Management Inventory",
  description:
    "Enterprise inventory management system for power station units. Track, dispatch, and verify stock across warehouses and branches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
