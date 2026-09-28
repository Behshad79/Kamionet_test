"use client";

import { BarChart3, FileCheck2, Flag, LifeBuoy, LogOut, Radio, Settings2, Tags } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/lib/hooks";
import { logout } from "@/lib/store";
import { Logo } from "./AppShell";
import { DemoPanel } from "./DemoPanel";
import { Badge, cx } from "./ui";

const NAV = [
  { href: "/admin/", label: "گزارش‌ها", icon: BarChart3 },
  { href: "/admin/kyc/", label: "احراز رانندگان", icon: FileCheck2 },
  { href: "/admin/live/", label: "نقشه‌ی زنده", icon: Radio },
  { href: "/admin/flags/", label: "مغایرت فاکتور", icon: Flag },
  { href: "/admin/tickets/", label: "پشتیبانی", icon: LifeBuoy },
  { href: "/admin/rates/", label: "نرخ مرجع", icon: Tags },
  { href: "/admin/settings/", label: "تنظیمات", icon: Settings2 },
];

export function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  const { admin, ready, s } = useApp();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (ready && !admin) router.replace("/login/"); }, [ready, admin, router]);
  const badge: Record<string, number> = {
    "/admin/kyc/": s.drivers.filter((d) => d.kyc === "pending").length,
    "/admin/flags/": s.orders.filter((o) => o.flag?.status === "open").length,
    "/admin/tickets/": s.tickets.filter((t) => t.status === "open").length,
  };
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-white md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-e">
        <div className="flex items-center justify-between p-4"><Logo /><Badge tone="brand">ادمین</Badge></div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible" aria-label="پنل مدیریت">
          {NAV.map((n) => {
            const on = path === n.href;
            return (
              <Link key={n.href} href={n.href} className={cx("flex shrink-0 items-center gap-2.5 rounded-ui px-3.5 py-2.5 text-sm font-medium transition", on ? "bg-brand-50 font-bold text-ink" : "text-ink-3 hover:bg-surface-3")}>
                <n.icon className="size-[18px]" />{n.label}
                {!!badge[n.href] && <span className="ms-auto grid min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{new Intl.NumberFormat("fa-IR").format(badge[n.href])}</span>}
              </Link>
            );
          })}
          <button onClick={() => { logout(); router.push("/"); }} className="flex shrink-0 items-center gap-2.5 rounded-ui px-3.5 py-2.5 text-sm text-ink-3 hover:bg-surface-3 md:mt-4"><LogOut className="size-[18px]" />خروج</button>
        </nav>
      </aside>
      <main className="min-w-0 p-4 md:p-8">
        <h1 className="mb-6 text-2xl font-black">{title}</h1>
        {ready && admin ? children : <div className="skeleton h-64" />}
      </main>
      <DemoPanel />
    </div>
  );
}
