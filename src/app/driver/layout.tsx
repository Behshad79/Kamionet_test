import { DriverShell } from "@/components/portal/Shells";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DriverShell>{children}</DriverShell>;
}
