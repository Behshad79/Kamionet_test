"use client";

import { Bell, ClipboardList, Gauge, Home, ListChecks, LogOut, PackagePlus, ShieldCheck, Truck, User, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { usePortal } from "@/lib/hooks";
import { logout, PORTAL_LOGIN } from "@/lib/store";
import type { PortalId } from "@/lib/types";
import { Logo, PortalCue, ProBadge } from "../brand";
import { Skeleton, cx } from "../ui";
import { DemoDrawer } from "./DemoDrawer";

interface Nav { href: string; label: string; icon: LucideIcon }

const SHIPPER_NAV: Nav[] = [
  { href: "/app/", label: "داشبورد", icon: Home },
  { href: "/app/new/", label: "سفارش جدید", icon: PackagePlus },
  { href: "/app/wallet/", label: "کیف پول", icon: Wallet },
  { href: "/app/profile/", label: "پروفایل", icon: User },
];
const DRIVER_NAV: Nav[] = [
  { href: "/driver/", label: "بارها", icon: Truck },
  { href: "/driver/trips/", label: "سفرها", icon: ListChecks },
  { href: "/driver/wallet/", label: "درآمد", icon: Wallet },
  { href: "/driver/profile/", label: "پروفایل", icon: User },
];
export const ADMIN_NAV: Nav[] = [
  { href: "/admin/", label: "داشبورد", icon: Gauge },
  { href: "/admin/orders/", label: "سفارش‌ها", icon: ClipboardList },
  { href: "/admin/drivers/", label: "رانندگان", icon: Truck },
  { href: "/admin/audit/", label: "ممیزی", icon: ShieldCheck },
];

const active = (path: string, href: string) => (href.split("/").filter(Boolean).length === 1 ? path === href : path.startsWith(href));

function useGate(portal: PortalId) {
  const router = useRouter();
  const path = usePathname();
  const p = usePortal(portal);
  const isLogin = path.includes("/login");
  useEffect(() => {
    if (p.ready && !p.signedIn && !isLogin) router.replace(PORTAL_LOGIN[portal]);
  }, [p.ready, p.signedIn, isLogin, router, portal]);
  return { ...p, path, isLogin };
}

function Loading() {
  return <div className="mx-auto max-w-3xl space-y-4 p-6" aria-busy="true" aria-label="در حال بارگذاری"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
}

function Bell2({ n }: { n: number }) {
  return (
    <button aria-label={n ? `اعلان‌ها، ${n} خوانده‌نشده` : "اعلان‌ها"} className="relative grid size-11 place-items-center rounded-full hover:bg-surface-3">
      <Bell className="size-5" aria-hidden />
      {n > 0 && <span className="absolute end-2 top-2 size-2.5 rounded-full bg-danger ring-2 ring-white" />}
    </button>
  );
}

/* ───────────────────────── Shipper ───────────────────────── */

export function ShipperShell({ children }: { children: ReactNode }) {
  const g = useGate("shipper");
  if (g.isLogin) return <div data-portal="shipper">{children}</div>;
  if (!g.ready || !g.signedIn) return <div data-portal="shipper" className="min-h-dvh bg-tint"><Loading /></div>;
  return (
    <div data-portal="shipper" className="min-h-dvh bg-tint lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-white p-4 lg:flex">
        <Logo className="mb-2" />
        <PortalCue label="پنل صاحب بار" tone="shipper" />
        <nav className="mt-6 grid gap-1" aria-label="ناوبری اصلی">
          {SHIPPER_NAV.map((n) => <NavLink key={n.href} n={n} path={g.path} />)}
        </nav>
        <div className="mt-auto space-y-2">
          <div className="rounded-ui bg-act-soft p-3 text-sm"><div className="font-bold">{g.shipper?.displayName}</div><div className="text-xs text-ink-3">{g.me?.phone}</div></div>
          <SignOut portal="shipper" />
        </div>
      </aside>
      <div className="min-w-0 pb-24 lg:pb-8">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
          <Logo /><div className="flex items-center gap-1"><PortalCue label="پنل صاحب بار" tone="shipper" /><Bell2 n={g.unread} /></div>
        </header>
        <div className="mx-auto max-w-5xl p-4 lg:p-8">{children}</div>
      </div>
      <BottomBar items={SHIPPER_NAV} path={g.path} className="lg:hidden" />
      <DemoDrawer />
    </div>
  );
}

/* ───────────────────────── Driver (mobile-first PWA) ───────────────────────── */

export function DriverShell({ children }: { children: ReactNode }) {
  const g = useGate("driver");
  if (g.isLogin) return <div data-portal="driver">{children}</div>;
  if (!g.ready || !g.signedIn) return <div data-portal="driver" className="min-h-dvh bg-tint"><Loading /></div>;
  return (
    <div data-portal="driver" className="min-h-dvh bg-tint pb-24">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-white/95 px-4 backdrop-blur">
        <div className="flex items-center gap-2"><Logo />{g.driver?.pro.status === "pro" && <ProBadge />}</div>
        <div className="flex items-center gap-1"><PortalCue label="اپ راننده" tone="driver" /><Bell2 n={g.unread} /></div>
      </header>
      <div className="mx-auto max-w-2xl p-4">{children}</div>
      <BottomBar items={DRIVER_NAV} path={g.path} large />
      <DemoDrawer />
    </div>
  );
}

/* ───────────────────────── Admin (desktop) ───────────────────────── */

export function AdminShell({ children }: { children: ReactNode }) {
  const g = useGate("admin");
  if (g.isLogin) return <div data-portal="admin">{children}</div>;
  if (!g.ready || !g.signedIn) return <div data-portal="admin" className="min-h-dvh bg-tint"><Loading /></div>;
  return (
    <div data-portal="admin" className="min-h-dvh bg-tint lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-slate-nav p-4 text-slate-200 lg:flex">
        <Logo tone="white" className="mb-2" />
        <PortalCue label="مدیریت" tone="admin" />
        <nav className="mt-6 grid gap-1" aria-label="ناوبری مدیریت">
          {ADMIN_NAV.map((n) => <NavLink key={n.href} n={n} path={g.path} dark />)}
        </nav>
        <div className="mt-auto space-y-2">
          <div className="rounded-ui bg-white/10 p-3 text-sm"><div className="font-bold text-white">{g.admin?.name}</div><div className="text-xs text-slate-400">{g.admin?.role}</div></div>
          <SignOut portal="admin" dark />
        </div>
      </aside>
      <div className="min-w-0">
        <div className="mx-auto hidden max-w-[1400px] p-6 lg:block">{children}</div>
        <div className="grid min-h-dvh place-items-center p-8 text-center lg:hidden"><div><PortalCue label="مدیریت" tone="admin" /><p className="mt-3 font-bold">کنسول مدیریت برای صفحه‌ی دسکتاپ طراحی شده است.</p><p className="mt-1 text-sm text-ink-3">لطفاً با رایانه وارد شوید.</p></div></div>
      </div>
      <DemoDrawer />
    </div>
  );
}

/* ───────────────────────── bits ───────────────────────── */

function NavLink({ n, path, dark }: { n: Nav; path: string; dark?: boolean }) {
  const on = active(path, n.href);
  return (
    <Link href={n.href} aria-current={on ? "page" : undefined}
      className={cx("flex h-11 items-center gap-3 rounded-ui px-3 text-sm font-bold transition",
        dark ? (on ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10") : on ? "bg-act-soft text-act-ink" : "text-ink-2 hover:bg-surface-3")}>
      <n.icon className="size-5" aria-hidden />{n.label}
    </Link>
  );
}

function BottomBar({ items, path, large, className }: { items: Nav[]; path: string; large?: boolean; className?: string }) {
  return (
    <nav aria-label="ناوبری اصلی" className={cx("pb-safe fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white", className)} style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((n) => {
        const on = active(path, n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cx("flex flex-col items-center justify-center gap-1 pt-2 text-[11px] font-bold", large ? "min-h-16" : "min-h-14", on ? "text-act-ink" : "text-ink-3")}>
            <span className={cx("grid h-8 w-14 place-items-center rounded-full transition", on && "bg-act-soft")}><n.icon className="size-5" aria-hidden /></span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOut({ portal, dark }: { portal: PortalId; dark?: boolean }) {
  const router = useRouter();
  return (
    <button onClick={() => { logout(portal); router.replace(PORTAL_LOGIN[portal]); }} className={cx("flex h-11 w-full items-center gap-2 rounded-ui px-3 text-sm font-medium", dark ? "text-slate-300 hover:bg-white/10" : "text-ink-3 hover:bg-surface-3")}>
      <LogOut className="size-4" aria-hidden />خروج
    </button>
  );
}
