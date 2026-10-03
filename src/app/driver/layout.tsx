import type { Metadata, Viewport } from "next";
import { DriverShell } from "@/components/portal/Shells";

export const metadata: Metadata = { manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.webmanifest`, appleWebApp: { capable: true, title: "کامیونت" } };
export const viewport: Viewport = { themeColor: "#FFB000" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DriverShell>{children}</DriverShell>;
}
