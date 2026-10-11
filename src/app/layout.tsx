import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Boot } from "@/components/Boot";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://behshad79.github.io") + (process.env.NEXT_PUBLIC_BASE_PATH || "/Kamionet_test");
export const metadata: Metadata = {
  metadataBase: new URL(SITE + "/"),
  title: { default: "کامیونت | حمل بار یخچالی و زنجیره‌ی سرد", template: "%s | کامیونت" },
  description: "پلتفرم حمل بار یخچال‌دار در سراسر ایران: قیمت شفاف، رهگیری دما، بیمه و بارنامه‌ی الکترونیک. صاحب بار و راننده‌ی یخچال‌دار را مستقیم به هم وصل می‌کنیم.",
  keywords: ["حمل بار یخچالی", "کامیون یخچال‌دار", "زنجیره‌ی سرد", "حمل لبنیات", "حمل گوشت", "باربری یخچالی", "کرایه کامیونت یخچالی"],
  openGraph: { type: "website", locale: "fa_IR", siteName: "کامیونت", title: "کامیونت | حمل بار یخچالی", description: "قیمت شفاف، رهگیری دما و راننده‌ی یخچال‌دار تأییدشده" },
  alternates: { canonical: "/" },
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
