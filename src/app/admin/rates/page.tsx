"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { toast } from "@/components/Toaster";
import { Button, Card, Input, Select } from "@/components/ui";
import { CITIES } from "@/lib/geo";
import { useApp } from "@/lib/hooks";
import { deleteRate, upsertRate } from "@/lib/store";

const digits = (v: string) => +v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default function AdminRates() {
  const { s } = useApp();
  const [f, setF] = useState({ from: "تهران", to: "مشهد", min: "", max: "" });
  return (
    <AdminShell title="نرخ مرجع مسیرها">
      <p className="mb-4 max-w-2xl text-sm leading-7 text-ink-3">این جدول پایه‌ی «نرخ پیشنهادی بازار» هنگام ثبت سفارش است. برای مسیرهای بدون ردیف، برآورد بر اساس مسافت استفاده می‌شود. (مبالغ بر حسب تومان، برای یک خودروی سردخانه‌ای معمولی)</p>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-line text-ink-3"><tr><th className="p-3 text-start">مسیر (دوطرفه)</th><th className="p-3 text-start">حداقل</th><th className="p-3 text-start">حداکثر</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {s.rates.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-bold">{r.from} ↔ {r.to}</td>
                <td className="p-3"><Input dir="ltr" className="h-10 w-40 text-start tabular" defaultValue={fmt(r.min)} onBlur={(e) => { upsertRate({ ...r, min: digits(e.target.value) }); toast("ذخیره شد", "info"); }} /></td>
                <td className="p-3"><Input dir="ltr" className="h-10 w-40 text-start tabular" defaultValue={fmt(r.max)} onBlur={(e) => { upsertRate({ ...r, max: digits(e.target.value) }); toast("ذخیره شد", "info"); }} /></td>
                <td className="p-3 text-end"><button aria-label="حذف" className="rounded-full p-2 text-danger hover:bg-danger-bg" onClick={() => deleteRate(r.id)}><Trash2 className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <Select aria-label="مبدأ" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}>{CITIES.map((c) => <option key={c.name}>{c.name}</option>)}</Select>
        <Select aria-label="مقصد" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>{CITIES.map((c) => <option key={c.name}>{c.name}</option>)}</Select>
        <Input dir="ltr" className="text-start" placeholder="حداقل" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
        <Input dir="ltr" className="text-start" placeholder="حداکثر" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />
        <Button disabled={!digits(f.min) || !digits(f.max) || f.from === f.to} onClick={() => { upsertRate({ from: f.from, to: f.to, min: digits(f.min), max: digits(f.max) }); setF({ ...f, min: "", max: "" }); toast("مسیر اضافه شد"); }}><Plus className="size-4" />افزودن</Button>
      </Card>
    </AdminShell>
  );
}
