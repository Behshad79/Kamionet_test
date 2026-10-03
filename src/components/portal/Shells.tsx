"use client";

import { Bell, Eye, ClipboardList, Gauge, Home, ListChecks, LogOut, Menu, PackagePlus, Repeat, ShieldCheck, Truck, User, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { usePortal } from "@/lib/hooks";
import { usePushBridge } from "@/lib/usePush";
import { getViewAs, logout, PORTAL_LOGIN } from "@/lib/store";
import type { PortalId } from "@/lib/types";
import { Logo, PortalCue, ProBadge } from "../brand";
import { Skeleton, cx } from "../ui";
import { SupportWidget } from "../SupportWidget";
import { DemoDrawer, openDemo } from "./DemoDrawer";
import { DEMO_MODE } from "@/lib/store";
import { FlaskConical, Search } from "lucide-react";
import { ADMIN_MODS, GROUPS, modAllowed, modHref } from "../admin/adminNav";
import { CommandPalette, openPalette } from "../admin/CommandPalette";
import { DemoDirector } from "../admin/DemoDirector";
import { can, ROLE_LABELS } from "@/lib/engine/admin";
import { cv } from "@/lib/config";

function ViewAsBanner() {
  const [v, setV] = useState<ReturnType<typeof getViewAs>>(null);
  useEffect(() => setV(getViewAs()), []);
  if (!v) return null;
  return <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-2 bg-ink px-3 py-2 text-center text-xs font-bold text-white"><Eye className="size-4" aria-hidden />حالت مشاهده‌ی فقط‌خواندنی: شما به‌جای «{v.name}» می‌بینید (مدیر: {v.by}). هیچ تغییری ثبت نمی‌شود و این مشاهده در ممیزی ثبت شده است.</div>;
}

const DemoBtn = () => (DEMO_MODE ? <button onClick={openDemo} aria-label="حساب‌های دمو" className="grid size-11 place-items-center rounded-full hover:bg-ink/5 lg:hidden"><FlaskConical className="size-5" aria-hidden /></button> : null);

interface Nav { href: string; label: string; icon: LucideIcon }

const SHIPPER_NAV: Nav[] = [
  { href: "/app/", label: "داشبورد", icon: Home },
  { href: "/app/new/", label: "سفارش جدید", icon: PackagePlus },
  { href: "/app/recurring/", label: "تکرارشونده", icon: Repeat },
  { href: "/app/wallet/", label: "کیف پول", icon: Wallet },
  { href: "/app/profile/", label: "پروفایل", icon: User },
];
const DRIVER_NAV: Nav[] = [
  { href: "/driver/", label: "بارها", icon: Truck },
  { href: "/driver/trips/", label: "سفرها", icon: ListChecks },
  { href: "/driver/wallet/", label: "درآمد", icon: Wallet },
  { href: "/driver/profile/", label: "پروفایل", icon: User },
];

const active = (path: string, href: string) => (href.split("/").filter(Boolean).length === 1 ? path === href : path.startsWith(href));

function useGate(portal: PortalId) {
  const router = useRouter();
  const path = usePathname();
  const p = usePortal(portal);
  const isLogin = path.includes("/login");
  /** The driver load board is public (browse first, register when you want to claim). */
  const guestOk = portal === "driver" && path.replace(/\/$/, "") === "/driver" && cv<boolean>(p.s, "feature.guestBrowse");
  useEffect(() => {
    if (p.ready && !p.signedIn && !isLogin && !guestOk) router.replace(PORTAL_LOGIN[portal]);
  }, [p.ready, p.signedIn, isLogin, router, portal, guestOk]);
  return { ...p, path, isLogin, guestOk };
}

function Loading() {
  return <div className="mx-auto max-w-3xl space-y-4 p-6" aria-busy="true" aria-label="در حال بارگذاری"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
}

function Bell2({ n, href }: { n: number; href: string }) {
  return (
    <Link href={href} aria-label={n ? `اعلان‌ها، ${n} خوانده‌نشده` : "اعلان‌ها"} className="relative grid size-11 place-items-center rounded-full hover:bg-surface-3">
      <Bell className="size-5" aria-hidden />
      {n > 0 && <span className="absolute end-2 top-2 size-2.5 rounded-full bg-danger ring-2 ring-white" />}
    </Link>
  );
}

/* ───────────────────────── Shipper ───────────────────────── */

export function ShipperShell({ children }: { children: ReactNode }) {
  const g = useGate("shipper");
  usePushBridge(g.s.notifications.filter((n) => n.personId === g.me?.id && n.portal === "shipper"), "shipper", g.ready);
  if (g.isLogin) return <div data-portal="shipper">{children}</div>;
  if (!g.ready || !g.signedIn) return <div data-portal="shipper" className="min-h-dvh bg-tint"><Loading /></div>;
  const nav = SHIPPER_NAV.filter((n) => n.href !== "/app/recurring/" || cv<boolean>(g.s, "feature.recurring"));
  return (
    <div data-portal="shipper" className="min-h-dvh bg-tint lg:grid lg:grid-cols-[248px_1fr]">
      <div className="lg:col-span-2 empty:hidden"><ViewAsBanner /></div>
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line/60 bg-white/70 p-4 backdrop-blur-xl lg:flex">
        <Logo className="mb-2" />
        <PortalCue label="پنل صاحب بار" tone="shipper" />
        <nav className="mt-6 grid gap-1" aria-label="ناوبری اصلی">
          {nav.map((n) => <NavLink key={n.href} n={n} path={g.path} />)}
        </nav>
        <div className="mt-auto space-y-2">
          <div className="rounded-ui bg-act-soft p-3 text-sm"><div className="font-bold">{g.shipper?.displayName}</div><div className="text-xs text-ink-3">{g.me?.phone}</div></div>
          <SignOut portal="shipper" />
        </div>
      </aside>
      <div className="min-w-0 pb-24 lg:pb-8">
        <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-white/60 px-4 lg:hidden">
          <Logo /><div className="flex items-center gap-1"><PortalCue label="پنل صاحب بار" tone="shipper" /><DemoBtn /><Bell2 n={g.unread} href="/app/notifications/" /></div>
        </header>
        <div className="mx-auto max-w-5xl p-4 lg:p-8">{children}</div>
      </div>
      <BottomBar items={nav} path={g.path} className="lg:hidden" />
      <SupportWidget portal="shipper" />
      <DemoDrawer />
    </div>
  );
}

/* ───────────────────────── Driver (mobile-first PWA) ───────────────────────── */

export function DriverShell({ children }: { children: ReactNode }) {
  const g = useGate("driver");
  usePushBridge(g.s.notifications.filter((n) => n.personId === g.me?.id && n.portal === "driver"), "driver", g.ready);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sw.js`, { scope: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/driver/` }).catch(() => undefined);
  }, []);
  if (g.isLogin) return <div data-portal="driver">{children}</div>;
  if (g.ready && !g.signedIn && g.guestOk) return (
    <div data-portal="driver" className="min-h-dvh bg-tint pb-10">
      <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-white/60 px-4"><Logo /><div className="flex items-center gap-1"><PortalCue label="اپ راننده" tone="driver" /><DemoBtn /><Link href="/driver/login/" className="inline-flex h-11 items-center rounded-ui bg-act px-4 text-sm font-black text-white">ورود / ثبت‌نام</Link></div></header>
      <div className="mx-auto max-w-2xl p-4">{children}</div>
      <DemoDrawer />
    </div>
  );
  if (!g.ready || !g.signedIn) return <div data-portal="driver" className="min-h-dvh bg-tint"><Loading /></div>;
  return (
    <div data-portal="driver" className="min-h-dvh bg-tint pb-24">
      <ViewAsBanner />
      <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-white/60 px-4">
        <div className="flex items-center gap-2"><Logo />{g.driver?.pro.status === "pro" && <ProBadge />}</div>
        <div className="flex items-center gap-1"><PortalCue label="اپ راننده" tone="driver" /><DemoBtn /><Bell2 n={g.unread} href="/driver/notifications/" /></div>
      </header>
      <div className="mx-auto max-w-2xl p-4">{children}</div>
      <BottomBar items={DRIVER_NAV} path={g.path} large />
      <SupportWidget portal="driver" />
      <DemoDrawer />
    </div>
  );
}

/* ───────────────────────── Admin (desktop) ───────────────────────── */

export function AdminShell({ children }: { children: ReactNode }) {
  const g = useGate("admin");
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [g.path]);
  if (g.isLogin) return <div data-portal="admin">{children}</div>;
  if (!g.ready || !g.signedIn) return <div data-portal="admin" className="min-h-dvh bg-tint"><Loading /></div>;
  const side = (
    <>
      <div className="flex items-center justify-between"><Logo tone="white" /><PortalCue label="مدیریت" tone="admin" /></div>
      <button onClick={openPalette} className="mt-5 flex h-11 items-center justify-between rounded-2xl bg-white/8 px-3 text-sm text-slate-300 hover:bg-white/12"><span className="flex items-center gap-2"><Search className="size-4" aria-hidden />جستجوی سریع</span><kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px]">Ctrl K</kbd></button>
      <nav className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pe-1" aria-label="ناوبری مدیریت">{GROUPS.map((gr) => { const items = ADMIN_MODS.filter((m) => m.group === gr && modAllowed(m, (p) => can(g.admin?.role, p))); return items.length === 0 ? null : <div key={gr}><div className="mb-1 px-3 text-[11px] font-extrabold text-slate-500">{gr}</div><div className="grid gap-0.5">{items.map((m) => <NavLink key={m.slug} n={{ href: modHref(m.slug), label: m.title, icon: m.icon }} path={g.path} dark onClick={() => setMenu(false)} />)}</div></div>; })}</nav>
      <div className="space-y-2 pt-4">
        <div className="rounded-2xl bg-white/8 p-3 text-sm"><div className="font-bold text-white">{g.admin?.name}</div><div className="text-xs text-slate-400">{g.admin ? ROLE_LABELS[g.admin.role] : ""}</div></div>
        <SignOut portal="admin" dark />
      </div>
    </>
  );
  return (
    <div data-portal="admin" className="min-h-dvh bg-tint lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-gradient-to-b from-[#0f172a] to-[#111c33] p-4 text-slate-200 lg:flex">{side}</aside>
      <div className="min-w-0">
        <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-white/60 px-4 lg:hidden">
          <button onClick={() => setMenu(true)} aria-label="باز کردن منو" aria-expanded={menu} className="grid size-11 place-items-center rounded-full hover:bg-ink/5"><Menu className="size-5" /></button>
          <Logo /><div className="flex items-center gap-1"><PortalCue label="مدیریت" tone="admin" /><DemoBtn /></div>
        </header>
        <div className="mx-auto max-w-[1500px] p-4 lg:p-8">{children}</div>
      </div>
      {menu && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="منوی مدیریت">
          <div className="flex w-72 max-w-[85%] animate-rise flex-col bg-gradient-to-b from-[#0f172a] to-[#111c33] p-4 text-slate-200">{side}</div>
          <button className="flex-1 bg-ink/50" aria-label="بستن منو" onClick={() => setMenu(false)} />
        </div>
      )}
      <DemoDrawer />
      <CommandPalette />
      <DemoDirector />
    </div>
  );
}

/* ───────────────────────── bits ───────────────────────── */

function NavLink({ n, path, dark, onClick }: { n: Nav; path: string; dark?: boolean; onClick?: () => void }) {
  const on = active(path, n.href);
  return (
    <Link href={n.href} onClick={onClick} aria-current={on ? "page" : undefined}
      className={cx("group relative flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition duration-200",
        dark ? (on ? "bg-white/12 text-white" : "text-slate-400 hover:bg-white/8 hover:text-white") : on ? "bg-act-soft text-act-ink shadow-[0_0_0_1px_rgb(16_24_40/0.04)]" : "text-ink-3 hover:bg-ink/[0.04] hover:text-ink")}>
      {on && <span className={cx("absolute inset-y-2.5 start-0 w-1 rounded-full", dark ? "bg-brand-500" : "bg-act")} aria-hidden />}
      <n.icon className="size-5 shrink-0" aria-hidden />{n.label}
    </Link>
  );
}

function BottomBar({ items, path, large, className }: { items: Nav[]; path: string; large?: boolean; className?: string }) {
  return (
    <nav aria-label="ناوبری اصلی" className={cx("glass fixed inset-x-3 bottom-3 z-30 grid rounded-[26px] p-1.5 shadow-lift ring-1 ring-ink/5", className)} style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)`, marginBottom: "env(safe-area-inset-bottom)" }}>
      {items.map((n) => {
        const on = active(path, n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cx("flex flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-extrabold transition duration-200", large ? "min-h-[58px]" : "min-h-[54px]", on ? "bg-act-soft text-act-ink" : "text-ink-3")}>
            <n.icon className={cx("size-[22px] transition", on && "scale-110")} aria-hidden />
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
