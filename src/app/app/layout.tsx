import type { Metadata } from "next";
import { ShipperShell } from "@/components/portal/Shells";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ShipperShell>{children}</ShipperShell>;
}
