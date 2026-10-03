"use client";

import { Clapperboard, X } from "lucide-react";
import { useState } from "react";
import { Button, Select, Toggle } from "../ui";
import { toast } from "../Toaster";
import { useAdmin } from "./kit";
import { advanceDisputeWindow, approveAllReceipts, closeToday, dropSuspense, expireDeposits, failFirstPayout, runPayoutBatch, spawnDemoOrder, userSupportMessage } from "@/lib/engine/demo";
import { DEMO_MODE, act, resetDemo, useStore } from "@/lib/store";
import type { Result } from "@/lib/engine/core";

type R = Result<{ msg: string }>;

/** Floating control room for the demo: every button calls the real engine (no mock shortcuts around the ledger). Visible to senior roles in demo mode only. */
export function DemoDirector() {
  const s = useStore();
  const { admin } = useAdmin();
  const [open, setOpen] = useState(false);
  if (!DEMO_MODE || !["super", "ops", "finance_mgr"].includes(admin?.role)) return null;
  const D = <T,>(fn: (st: typeof s) => T) => act((st) => fn(st));
  const run = (fn: (st: typeof s) => R) => { const r = D(fn); if (r.ok) toast(r.msg); else toast(r.error, "err"); };
  const btn = (label: string, fn: (st: typeof s) => R) => <Button size="sm" variant="secondary" key={label} onClick={() => run(fn)}>{label}</Button>;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="کارگردان دمو" aria-expanded={open} className="fixed bottom-5 end-5 z-40 hidden h-12 items-center gap-2 rounded-full bg-ink px-4 text-sm font-bold text-white shadow-lift hover:bg-ink/90 lg:flex"><Clapperboard className="size-5" aria-hidden />کارگردان دمو</button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="کارگردان دمو">
          <button className="flex-1 bg-ink/30" aria-label="بستن" onClick={() => setOpen(false)} />
          <aside className="flex w-[380px] max-w-full animate-rise flex-col gap-5 overflow-y-auto bg-white p-5 shadow-lift">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">کارگردان دمو</h2><button onClick={() => setOpen(false)} aria-label="بستن" className="grid size-11 place-items-center rounded-full hover:bg-ink/5"><X className="size-5" /></button></div>
            <p className="text-xs leading-6 text-ink-3">برای نمایش سناریوها؛ هر دکمه همان موتور واقعی محصول را اجرا می‌کند و در دفتر کل و ممیزی ثبت می‌شود.</p>
            <Section title="سفارش و سفر">{btn("ثبت سفارش باز", (st) => spawnDemoOrder(st, "open"))}{btn("ثبت سفارش پرو", (st) => spawnDemoOrder(st, "pro"))}{btn("درخواست مستقیم به راننده‌ی پرو", (st) => spawnDemoOrder(st, "direct"))}{btn("پایان مهلت بیعانه", expireDeposits)}{btn("گذشتن پنجره‌ی اعتراض", advanceDisputeWindow)}</Section>
            <Section title="درگاه و احراز هویت (تست)">
              <label className="block text-xs font-bold">نتیجه‌ی درگاه پرداخت<Select className="mt-1" value={s.demo.gateway} onChange={(e) => act((st) => { st.demo.gateway = e.target.value as typeof s.demo.gateway; })}><option value="success">موفق</option><option value="fail">ناموفق</option><option value="cancel">انصراف کاربر</option><option value="timeout">تایم‌اوت</option><option value="delayed">تأخیر در تأیید</option><option value="double">پرداخت دوباره (ایدمپوتنسی)</option></Select></label>
              <Toggle label="تطبیق کد ملی با سیم‌کارت" checked={s.demo.idMatch === "ok"} onChange={(v) => act((st) => { st.demo.idMatch = v ? "ok" : "mismatch"; })} />
              <Toggle label="تطبیق نام صاحب شبا" checked={s.demo.ibanHolder === "ok"} onChange={(v) => act((st) => { st.demo.ibanHolder = v ? "ok" : "mismatch"; })} />
            </Section>
            <Section title="مالی">{btn("تأیید همه‌ی رسیدها", (st) => approveAllReceipts(st, admin.name))}{btn("اجرای دسته‌ی برداشت", (st) => runPayoutBatch(st, admin.name))}{btn("دسته با یک ردی بانک", (st) => runPayoutBatch(st, admin.name, true))}{btn("ناموفق‌کردن یک برداشت", failFirstPayout)}{btn("واریز ناشناس (حساب معلق)", dropSuspense)}{btn("بستن روز مالی", (st) => closeToday(st, admin.name))}</Section>
            <Section title="پشتیبانی">{btn("پیام جدید از کاربر", userSupportMessage)}</Section>
            <div className="mt-auto border-t border-line pt-4"><Button variant="secondary" block onClick={() => { if (confirm("همه‌ی داده‌ها به وضعیت اولیه برمی‌گردد. ادامه می‌دهید؟")) { resetDemo(); toast("داده‌ی دمو بازنشانی شد."); } }}>بازنشانی کل داده‌ی دمو</Button></div>
          </aside>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h3 className="text-xs font-extrabold text-ink-3">{title}</h3><div className="flex flex-wrap gap-2">{children}</div></section>;
}
