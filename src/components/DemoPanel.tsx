"use client";

import { FlaskConical, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/hooks";
import { demoApproveMe, demoExpireInsurance, demoReset, demoRivalClaim, demoSpawnOrder } from "@/lib/store";
import { toast } from "./Toaster";
import { Button } from "./ui";

/** Prototype-only tools: simulate the other side of the marketplace. */
export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const { me } = useApp();
  return (
    <div className="no-print fixed bottom-24 start-3 z-40 md:bottom-4">
      {open && (
        <div className="mb-2 w-72 animate-rise space-y-2 rounded-ui bg-white p-4 shadow-lift">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">ابزار دمو</h3>
            <button onClick={() => setOpen(false)} aria-label="بستن"><X className="size-4" /></button>
          </div>
          <p className="text-xs leading-6 text-ink-3">پروتوتایپ بدون سرور است. این دکمه‌ها طرف مقابل بازار را شبیه‌سازی می‌کنند. برای دیدن رقابت واقعی، اپ را در دو تب با دو شماره‌ی راننده باز کنید.</p>
          <Button size="sm" variant="secondary" block onClick={() => { demoSpawnOrder(); toast("سفارش جدید از یک صاحب بار ثبت شد", "info"); }}>ثبت سفارش جدید (زنده روی نقشه)</Button>
          <Button size="sm" variant="secondary" block onClick={() => toast(demoRivalClaim() ? "راننده رقیب یک سفارش باز را برداشت" : "سفارش بازی برای رقیب نبود", "info")}>راننده رقیب یک سفارش را می‌گیرد</Button>
          {me && <Button size="sm" variant="secondary" block onClick={() => { demoApproveMe(); toast("حساب راننده‌ی شما تأیید شد", "ok"); }}>تأیید فوری مدارک من</Button>}
          {me && <Button size="sm" variant="secondary" block onClick={() => { demoExpireInsurance(); toast("بیمه‌ی شما منقضی شد → حساب معلق", "err"); }}>منقضی‌کردن بیمه‌ی من</Button>}
          <div className="flex items-center justify-between pt-1 text-sm">
            <Link href="/admin/" className="font-bold text-accent-600">پنل ادمین (۰۹۱۲۰۰۰۰۰۰۰)</Link>
            <button className="text-danger" onClick={() => { if (confirm("همه‌ی داده‌ها به حالت اولیه برگردد؟")) { demoReset(); toast("داده‌ها بازنشانی شد", "info"); } }}>بازنشانی</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label="ابزار دمو"
        className="grid size-11 place-items-center rounded-full bg-ink text-white shadow-lift transition active:scale-95">
        <FlaskConical className="size-5" />
      </button>
    </div>
  );
}
