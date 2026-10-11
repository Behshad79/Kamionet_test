import type { Metadata } from "next";
import { AdminShell } from "@/components/portal/Shells";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
