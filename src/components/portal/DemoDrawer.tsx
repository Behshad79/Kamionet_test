"use client";

import { FlaskConical, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_DRIVERS, DEMO_SHIPPERS, ADMIN_DEMO } from "@/lib/seed/scenarios";
import { demoSignIn, DEMO_MODE, PORTAL_HOME, resetDemo } from "@/lib/store";
import type { PortalId } from "@/lib/types";
import { toast } from "../Toaster";
import { cx } from "../ui";

const GROUPS: { portal: PortalId; title: string; items: { phone: string; name: string; note?: string }[] }[] = [
  { portal: "shipper", title: "صاحب بار", items: DEMO_SHIPPERS },
  { portal: "driver", title: "راننده", items: DEMO_DRIVERS },
  { portal: "admin", title: "مدیریت", items: ADMIN_DEMO },
];

const fa = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

export function DemoAccounts({ portal, compact }: { portal?: PortalId; compact?: boolean }) {
  const router = useRouter();
  const go = (p: PortalId, phone: string) => {
    const r = demoSignIn(p, phone);
    if (!r.ok) return toast(r.error, "err");
    router.push(PORTAL_HOME[p]);
  };
  const groups = portal ? GROUPS.filter((g) => g.portal === portal) : GROUPS;
  return (
    <div className={cx("space-y-4 rounded-ui border border-dashed border-line bg-white/70 p-4", compact && "text-sm")}>
      <div className="flex items-center gap-2 text-sm font-extrabold"><FlaskConical className="size-4 text-accent-600" aria-hidden />حساب‌های دمو</div>
      {groups.map((g) => (
        <div key={g.portal} className="space-y-2">
          {!portal && <div className="text-xs font-bold text-ink-3">{g.title}</div>}
          <div className="grid gap-1.5">
            {g.items.map((a) => (
              <button key={a.phone} onClick={() => go(g.portal, a.phone)} className="flex min-h-11 items-center justify-between gap-3 rounded-ui bg-white px-3 py-2 text-start shadow-soft transition hover:bg-act-soft">
                <span className="min-w-0"><span className="block truncate font-bold">{a.name}</span>{"note" in a && a.note && <span className="block truncate text-xs text-ink-3">{a.note}</span>}</span>
                <span dir="ltr" className="shrink-0 text-xs text-ink-3 tabular">{fa(a.phone)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const openDemo = () => window.dispatchEvent(new Event("km:demo"));

/** Floating launcher (demo mode only). `always` keeps it visible on mobile (public pages); portals use the header button instead. */
export function DemoDrawer({ always }: { always?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const h = () => setOpen(true); window.addEventListener("km:demo", h); return () => window.removeEventListener("km:demo", h); }, []);
  if (!DEMO_MODE) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="حساب‌های دمو" className={`fixed bottom-28 left-0 z-40 h-11 w-8 place-items-center rounded-r-full bg-ink/80 text-white shadow-lift lg:bottom-5 ${always ? "grid" : "hidden lg:grid"}`}><FlaskConical className="size-5" aria-hidden /></button>
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="حساب‌های دمو">
          <button className="flex-1 bg-ink/40" aria-label="بستن" onClick={() => setOpen(false)} />
          <div className="h-full w-full max-w-sm animate-fade overflow-y-auto bg-surface-2 p-4 shadow-lift">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black">حساب‌های دمو</h2>
              <button onClick={() => setOpen(false)} aria-label="بستن" className="grid size-11 place-items-center rounded-full hover:bg-surface-3"><X className="size-5" /></button>
            </div>
            <p className="mb-3 text-xs leading-6 text-ink-3">کد تأیید همه‌ی حساب‌ها ۱۲۳۴۵ است. هر پورتال نشست جدا دارد؛ می‌توانید در چند تب هم‌زمان وارد شوید.</p>
            <DemoAccounts />
            <button onClick={() => { resetDemo(); toast("داده‌ی دمو بازسازی شد.", "info"); }} className="mt-4 h-11 w-full rounded-ui border border-line bg-white text-sm font-bold">بازنشانی داده‌ی دمو</button>
          </div>
        </div>
      )}
    </>
  );
}
