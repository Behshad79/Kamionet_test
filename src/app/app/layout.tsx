import { ShipperShell } from "@/components/portal/Shells";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ShipperShell>{children}</ShipperShell>;
}
