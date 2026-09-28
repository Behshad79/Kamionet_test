import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Boot } from "@/components/Boot";

export const metadata: Metadata = {
  title: "کامیونت | حمل بار یخچالی",
  description: "پلتفرم هوشمند حمل بار یخچال‌دار و زنجیره‌ی سرد در سراسر ایران",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffb000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <Boot />
        {children}
      </body>
    </html>
  );
}
