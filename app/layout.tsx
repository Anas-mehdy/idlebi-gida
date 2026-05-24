import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "idelbi gida - الكتالوج الرقمي",
  description: "الكتالوج الرقمي ونظام الطلب المباشر عبر واتساب لشركة idelbi gida لتجارة المواد الغذائية بالجملة في تركيا.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} h-full antialiased`}
    >
      <body className="font-sans min-h-full flex flex-col bg-slate-50 text-slate-900">
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
