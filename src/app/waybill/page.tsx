"use client";

import { Printer } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button, Skeleton } from "@/components/ui";
import { CARGO, fa, jDateTime, toman, weightLabel, tempRange } from "@/lib/format";
import { useQueryParam } from "@/lib/hooks";
import { person } from "@/lib/engine/core";
import { useStore } from "@/lib/store";
import { VEHICLES } from "@/lib/vehicles";

/** Printable waybill. Prototype only: the electronic waybill (بارنامه‌ی الکترونیکی) integration is a stub, see DECISIONS.md. */
export default function Page() {
  const s = useStore();
  const id = useQueryParam("id");
  const v = useQueryParam("v");
  const o = s.orders.find((x) => x.id === id);
  if (!s.ready || id === undefined) return <div className="p-8"><Skeleton className="h-96" /></div>;
  const w = o?.waybills.find((x) => x.v === Number(v)) ?? o?.waybills[o.waybills.length - 1];
  if (!o || !w) return <div className="p-10 text-center font-bold">بارنامه پیدا نشد.</div>;
  const driver = person(s, o.driverId);
  const no = `KM-${o.id.toUpperCase()}-V${w.v}`;
  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-white p-6 sm:p-10">
      <div className="no-print flex justify-end"><Button onClick={() => window.print()}><Printer className="size-4" aria-hidden />چاپ</Button></div>
      <header className="flex items-center justify-between border-b-2 border-ink pb-4"><Logo /><div className="text-end"><div className="text-xl font-black">بارنامه‌ی حمل</div><div dir="ltr" className="text-sm text-ink-3">{no}</div></div></header>
      <p className="rounded-ui bg-warn-bg p-3 text-sm font-medium text-warn">نمونه‌ی نمایشی؛ این سند بارنامه‌ی رسمی الکترونیکی نیست.</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {[["نسخه", `${fa(w.v)} · ${w.reason}`], ["تاریخ صدور", jDateTime(w.at)], ["مبدأ", `${o.origin.city} — ${o.origin.address || "—"}`], ["مقصد", `${o.dest.city} — ${o.dest.address || "—"}`], ["نوع بار", CARGO[w.cargo].label], ["وزن", weightLabel(w.weightKg)], ["تعداد پالت", w.pallets ? fa(w.pallets) : "—"], ["دما", o.tempMin !== undefined && o.tempMax !== undefined ? tempRange(o.tempMin, o.tempMax) : "—"], ["ارزش اعلامی", toman(w.declaredValue)], ["کرایه", toman(w.freight)], ["خودرو", VEHICLES[o.vehicleKind].label], ["راننده", driver?.name ?? "—"], ["گیرنده", o.consignee.name], ["صاحب بار", person(s, o.shipperId)?.name ?? "—"]].map(([k, val]) => <div key={k}><dt className="text-ink-3">{k}</dt><dd className="font-bold">{val}</dd></div>)}
      </dl>
    </main>
  );
}
