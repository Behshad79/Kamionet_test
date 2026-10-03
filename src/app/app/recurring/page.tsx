"use client";

import { CalendarClock, Pause, Play, Plus, Repeat, Trash2 } from "lucide-react";
import Link from "next/link";
import { RouteLine, TempChip } from "@/components/molecules";
import { StatusBadge } from "@/components/molecules";
import { Badge, Button, ButtonLink, Card, EmptyState } from "@/components/ui";
import { fa, hhmm, jShort, toman } from "@/lib/format";
import { usePortal } from "@/lib/hooks";
import { act } from "@/lib/store";
import { VEHICLES } from "@/lib/vehicles";

const DAY = 86_400_000;

export default function Page() {
  const { s, me } = usePortal("shipper");
  if (!me) return null;
  const templates = s.templates.filter((t) => t.shipperId === me.id);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black">سفارش‌های تکرارشونده</h1><p className="text-sm text-ink-3">مسیرهای ثابت شما؛ هر نوبت خودکار ثبت و منتشر می‌شود.</p></div><ButtonLink href="/app/new/"><Plus className="size-5" aria-hidden />ایجاد سفارش تکرارشونده</ButtonLink></div>
      {templates.length === 0 ? <EmptyState icon={<Repeat className="size-8" />} title="هنوز سفارش تکرارشونده‌ای ندارید" body="در مرحله‌ی «قیمت و بیمه» ویزارد سفارش، گزینه‌ی تکرار روزانه یا هفتگی را انتخاب کنید." action={<ButtonLink href="/app/new/">ثبت سفارش</ButtonLink>} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((t) => {
            const runs = [0, 1, 2].map((i) => t.nextRunAt + i * (t.cadence === "daily" ? DAY : 7 * DAY));
            const made = s.orders.filter((o) => o.templateId === t.id).slice(0, 4);
            return (
              <Card key={t.id} className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-2"><Badge tone={t.active ? "ok" : "neutral"}>{t.active ? "فعال" : "متوقف"}</Badge><Badge><Repeat className="size-3.5" aria-hidden />{t.cadence === "daily" ? "روزانه" : "هفتگی"}</Badge></div>
                <RouteLine from={t.draft.origin.city} to={t.draft.dest.city} />
                <div className="flex flex-wrap items-center gap-2 text-sm">{t.draft.tempMin !== undefined && t.draft.tempMax !== undefined ? <TempChip min={t.draft.tempMin} max={t.draft.tempMax} /> : <Badge>غیریخچالی</Badge>}<span className="text-ink-3">{VEHICLES[t.draft.vehicleKind].short} · {toman(t.draft.freightBase)}</span></div>
                <div className="rounded-2xl bg-surface-2 p-3"><div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold"><CalendarClock className="size-4" aria-hidden />نوبت‌های بعدی</div><ul className="space-y-1 text-sm text-ink-2">{runs.map((r) => <li key={r}>{jShort(r)}، {hhmm(r)}</li>)}</ul></div>
                {made.length > 0 && <div><div className="mb-1.5 text-sm font-bold">آخرین سفارش‌های ثبت‌شده</div><ul className="space-y-1">{made.map((o) => <li key={o.id}><Link href={`/app/order/?id=${o.id}`} className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-2 text-sm hover:bg-surface-2"><span>{jShort(o.createdAt)}</span><StatusBadge status={o.status} /></Link></li>)}</ul></div>}
                <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => act((x) => { const tp = x.templates.find((q) => q.id === t.id); if (tp) tp.active = !tp.active; })}>{t.active ? <><Pause className="size-4" aria-hidden />توقف</> : <><Play className="size-4" aria-hidden />ادامه</>}</Button><Button size="sm" variant="danger" onClick={() => act((x) => { x.templates = x.templates.filter((q) => q.id !== t.id); })}><Trash2 className="size-4" aria-hidden />حذف</Button></div>
              </Card>
            );
          })}
        </div>
      )}
      <span className="sr-only">{fa(templates.length)}</span>
    </div>
  );
}
