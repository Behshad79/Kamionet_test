"use client";

import { CargoLabel } from "@/components/molecules";
import { Play, Repeat, Trash2 } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { toast } from "@/components/Toaster";
import { Badge, Button, Card, EmptyState, Toggle } from "@/components/ui";
import { CARGO, fa, jDateTime, toman } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { deleteTemplate, runTemplateNow, toggleTemplate } from "@/lib/store";

export default function Recurring() {
  const { s, me } = useApp();
  const list = s.templates.filter((t) => t.shipperId === me?.id);
  return (
    <AppShell area="shipper">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">سفارش‌های تکرارشونده</h1>
          <p className="mt-1 text-sm text-ink-3">الگو بسازید تا سفارش‌ها خودکار و به‌موقع ثبت شوند.</p>
        </div>
        <Link href="/shipper/new/"><Button variant="secondary">ساخت الگو</Button></Link>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Repeat className="size-7" />} title="الگویی ندارید" body="هنگام ثبت سفارش، گزینه‌ی «سفارش تکرارشونده» را در مرحله‌ی زمان روشن کنید." action={<Link href="/shipper/new/"><Button>ثبت سفارش با الگو</Button></Link>} />
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <Card key={t.id} className="animate-rise space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold">{t.draft.origin.city} ← {t.draft.dest.city}</div>
                <Toggle checked={t.active} onChange={() => toggleTemplate(t.id)} label="فعال" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="info">{t.cadence === "daily" ? "هر روز" : "هر هفته"} · {fa(t.hour)}:۰۰</Badge>
                <Badge><CargoLabel type={t.draft.cargo} /></Badge>
                <Badge>{toman(t.draft.price)}</Badge>
              </div>
              <p className="text-sm text-ink-3">{t.active ? `سفارش بعدی: بارگیری ${jDateTime(t.nextRunAt)}` : "متوقف شده"}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { runTemplateNow(t.id); toast("یک نمونه از الگو همین حالا ثبت شد"); }}><Play className="size-4" />ثبت نمونه اکنون</Button>
                <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}><Trash2 className="size-4" />حذف</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
