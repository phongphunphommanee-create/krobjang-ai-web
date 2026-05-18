import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react"; // 1. นำเข้าตัวนับคนเข้าเว็บ

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 2. แก้ไขชื่อเว็บและคำอธิบายให้ดึงดูดลูกค้า (SEO)
export const metadata: Metadata = {
  title: "Krobjang AI - วิเคราะห์แคปชั่นสินค้าด้วย GURU AI",
  description: "ตัวช่วยแม่ค้าออนไลน์ ปั้นยอดขายด้วยแคปชั่นและแฮชแท็กจาก TikTok, Shopee, Lazada โดย Krobjang AI",
  icons: {
    icon: "/favicon.ico", // อย่าลืมใส่ไฟล์ icon ในโฟลเดอร์ public ด้วยนะคะ
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        
        {/* 3. วางตัวนับคนเข้าเว็บไว้ท้าย body (ทำงานเงียบๆ หลังบ้านค่ะ) */}
        <Analytics />
      </body>
    </html>
  );
}