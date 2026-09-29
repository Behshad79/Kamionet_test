"use client";

import { Flag } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { toast } from "@/components/Toaster";
import { Badge, Button, Card, EmptyState, ButtonLink } from "@/components/ui";
import { fa, jDateTime } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { resolveFlag } from "@/lib/store";

export default function AdminFlags() {
  const { s } = useApp();
  const list = s.orders.filter((o) => o.flag);
  const name = (id?: string) => s.users.find((u) => u.id === id)?.name ?? "—";
  return (
    <AdminShell title="مغایرت فاکتور">
      {list.length === 0 ? <EmptyState icon={<Flag className="size-7" />} title="موردی برای بررسی نیست" body="وقتی تعداد اقلام فاکتور مبدأ و تحویل نخواند یا یکی از طرفین گزارش دهد، اینجا می‌آید." /> : (
        <div className="space-y-4">
          {list.map((o) => {
            const p = o.media.find((m) => m.kind === "invoice_pickup");
            const d = o.media.find((m) => m.kind === "invoice_delivery");
            return (
              <Card key={o.id} className="space-y-3 p-5">
                <div className="flex items-center justify-between"><b>{o.origin.city} ← {o.dest.city}</b><Badge tone={o.flag!.status === "open" ? "warn" : "ok"}>{o.flag!.status === "open" ? "در انتظار بررسی" : "بسته شد"}</Badge></div>
                <p className="text-sm leading-7">{o.flag!.note} <span className="text-ink-3">· {o.flag!.by === "system" ? "تشخیص خودکار" : "گزارش کاربر"} · {jDateTime(o.flag!.at)}</span></p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-ui bg-surface-2 p-3">فاکتور مبدأ: <b>{p?.items !== undefined ? `${fa(p.items)} قلم` : "—"}</b></div>
                  <div className="rounded-ui bg-surface-2 p-3">فاکتور تحویل: <b>{d?.items !== undefined ? `${fa(d.items)} قلم` : "—"}</b></div>
                </div>
                <div className="text-xs text-ink-3">صاحب بار: {name(o.shipperId)} · راننده: {name(o.driverId)}</div>
                <div className="flex gap-2">
                  <ButtonLink href={`/waybill/?id=${o.id}`} size="sm" variant="secondary">بارنامه</ButtonLink>
                  {o.flag!.status === "open" && <Button size="sm" onClick={() => { resolveFlag(o.id); toast("مورد بسته شد"); }}>بستن مورد</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
