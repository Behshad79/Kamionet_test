"use client";

import { Bell, ClipboardList, FileCheck2, LifeBuoy, LogOut, MapPinned, PackagePlus, Repeat, Route, Truck, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "@/lib/hooks";
import { relative } from "@/lib/format";
import { logout, markNotificationsRead, switchRole } from "@/lib/store";
import type { Role } from "@/lib/types";
import { RoleSwitch } from "./molecules";
import { cx } from "./ui";
import { DemoPanel } from "./DemoPanel";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cx("flex items-center gap-2 font-black", className)} aria-label="کامیونت">
      <span className="grid size-9 place-items-center rounded-ui bg-brand-500 text-ink shadow-soft"><Truck className="size-5" strokeWidth={2.4} /></span>
      <span className="text-xl tracking-tight">کامیونت</span>
    </Link>
  );
}

const NAV: Record<Role, { href: string; label: string; icon: ReactNode }[]> = {
  shipper: [
    { href: "/shipper/", label: "سفارش‌ها", icon: <ClipboardList className="size-5" /> },
    { href: "/shipper/new/", label: "سفارش جدید", icon: <PackagePlus className="size-5" /> },
    { href: "/shipper/recurring/", label: "تکرارشونده", icon: <Repeat className="size-5" /> },
    { href: "/support/", label: "پشتیبانی", icon: <LifeBuoy className="size-5" /> },
  ],
  driver: [
    { href: "/driver/", label: "بازار بار", icon: <MapPinned className="size-5" /> },
    { href: "/driver/trips/", label: "سفرهای من", icon: <Route className="size-5" /> },
    { href: "/driver/kyc/", label: "مدارک", icon: <FileCheck2 className="size-5" /> },
    { href: "/support/", label: "پشتیبانی", icon: <LifeBuoy className="size-5" /> },
  ],
};

const GUEST_NAV = [
  { href: "/", label: "خانه", icon: <Truck className="size-5" /> },
  { href: "/orders/", label: "بارهای باز", icon: <MapPinned className="size-5" /> },
  { href: "/login/?as=shipper", label: "ثبت سفارش", icon: <PackagePlus className="size-5" /> },
  { href: "/login/?as=driver", label: "راننده‌ام", icon: <Route className="size-5" /> },
];

const isOn = (path: string, href: string) => {
  const h = href.split("?")[0];
  if (h === "/" || h === "/shipper/" || h === "/driver/") return path === h;
  return path.startsWith(h);
};

function Bell_() {
  const { s, me, unread } = useApp();
  const [open, setOpen] = useState(false);
  const list = s.notifications.filter((n) => n.userId === me?.id).slice(0, 8);
  return (
    <div className="relative">
      <button aria-label={unread > 0 ? `اعلان‌ها، ${new Intl.NumberFormat("fa-IR").format(unread)} خوانده‌نشده` : "اعلان‌ها"} onClick={() => { setOpen((o) => !o); if (!open) setTimeout(markNotificationsRead, 1500); }}
        className="relative grid size-11 place-items-center rounded-full hover:bg-surface-3">
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute end-1.5 top-1.5 grid size-4 animate-pop place-items-center rounded-full bg-danger text-[10px] font-bold text-white">{new Intl.NumberFormat("fa-IR").format(unread)}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] animate-rise overflow-hidden rounded-ui bg-white shadow-lift">
            <div className="border-b border-line px-4 py-3 font-bold">اعلان‌ها</div>
            {list.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-3">اعلان جدیدی ندارید.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-auto">
                {list.map((n) => (
                  <li key={n.id}>
                    <Link href={n.href ?? "#"} onClick={() => setOpen(false)} className={cx("block px-4 py-3 text-sm leading-6 hover:bg-surface-2", !n.read && "bg-brand-50")}>
                      {n.text}
                      <div className="text-xs text-ink-3">{relative(n.at)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({ children, area, wide }: { children: ReactNode; area?: Role; wide?: boolean }) {
  const { me, ready, role, admin } = useApp();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!ready || !area) return;
    if (!me) router.replace(`/login/?next=${encodeURIComponent(path)}`);
    else if (role !== area) switchRole(area);
  }, [ready, me, area, role, router, path]);

  // One header pattern everywhere: role links when signed in, discovery links for guests.
  const nav = area ? NAV[area] : me ? NAV[role] : GUEST_NAV;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo />
          {nav && (
            <nav className="ms-6 hidden items-center gap-1 md:flex" aria-label="ناوبری اصلی">
              {nav.map((n) => {
                const on = isOn(path, n.href);
                return (
                  <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cx("flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition", on ? "bg-brand-50 text-ink" : "text-ink-3 hover:bg-surface-3")}>
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="ms-auto flex items-center gap-2">
            {me && <div className="hidden sm:block"><RoleSwitch role={role} /></div>}
            {me && <Bell_ />}
            {me ? (
              <button onClick={() => { logout(); router.push("/"); }} aria-label="خروج" className="grid size-11 place-items-center rounded-full hover:bg-surface-3"><LogOut className="size-5" /></button>
            ) : admin ? (
              <Link href="/admin/" className="text-sm font-bold text-accent-600">پنل مدیریت</Link>
            ) : (
              <Link href="/login/" className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-500 px-5 text-sm font-bold shadow-soft hover:bg-brand-400"><UserIcon className="size-4" />ورود / ثبت‌نام</Link>
            )}
          </div>
        </div>
        {me && <div className="border-t border-line px-4 py-2 sm:hidden"><RoleSwitch role={role} /></div>}
        {!me && (
          <nav className="no-scrollbar flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 md:hidden" aria-label="ناوبری اصلی">
            {GUEST_NAV.slice(0, 3).map((n) => (
              <Link key={n.href} href={n.href} aria-current={isOn(path, n.href) ? "page" : undefined} className={cx("flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium", isOn(path, n.href) ? "bg-brand-50 text-ink" : "text-ink-3")}>{n.label}</Link>
            ))}
          </nav>
        )}
      </header>

      <main className={cx("mx-auto w-full flex-1 px-4 py-5", wide ? "max-w-6xl" : "max-w-3xl", me && "pb-28 md:pb-8")}>{children}</main>

      {nav && me && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="ناوبری">
          <ul className="mx-auto grid max-w-md grid-cols-4">
            {nav.map((n) => {
              const on = isOn(path, n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} className={cx("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition", on ? "text-ink" : "text-ink-3")}>
                    <span className={cx("grid h-7 w-12 place-items-center rounded-full transition", on && "bg-brand-500")}>{n.icon}</span>
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      <DemoPanel />
    </div>
  );
}
