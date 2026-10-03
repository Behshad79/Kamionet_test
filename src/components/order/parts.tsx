"use client";

import { AlertTriangle, Check, Clock, Crown, Sparkles, Wind } from "lucide-react";
import Link from "next/link";
import { fa, jDateTime, jShort, hhmm, STATUS, toman, weightLabel } from "@/lib/format";
import { totalDue, shipperPaid, outstanding } from "@/lib/engine/pay";
import { person } from "@/lib/engine/core";
import { VEHICLES } from "@/lib/vehicles";
import type { Order, OrderStatus, State } from "@/lib/types";
import { ProBadge } from "../brand";
import { CargoLabel, RouteLine, StatusBadge, TempChip } from "../molecules";
import { Badge, Card, cx } from "../ui";

export function OdorChip({ odor, sensitive }: { odor: Order["odor"]; sensitive?: boolean }) {
  if (odor === "NONE" && !sensitive) return null;
  const label = sensitive ? "حساس به بو" : odor === "STRONG" ? "بوی شدید" : "بوی کم";
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", sensitive ? "bg-accent-50 text-accent-700" : odor === "STRONG" ? "bg-warn-bg text-warn" : "bg-surface-3 text-ink-2")}><Wind className="size-3.5" aria-hidden />{label}</span>;
}

export function CleanBadge({ className }: { className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full bg-ok-bg px-2.5 py-1 text-xs font-bold text-ok", className)}><Sparkles className="size-3.5" aria-hidden />تمیز تأییدشده</span>;
}

export function ModeChip({ o }: { o: Pick<Order, "cargoMode" | "serviceClass"> }) {
  return (
    <>
      {o.cargoMode === "AMBIENT" && <Badge tone="neutral">غیریخچالی</Badge>}
      {o.serviceClass === "PRO" && <ProBadge />}
    </>
  );
}

export function OrderCard({ o, s, href }: { o: Order; s: State; href: string }) {
  const driver = o.driverId ? person(s, o.driverId)?.name : undefined;
  return (
    <Link href={href} className="block">
      <Card className="space-y-3 p-4 transition hover:shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold"><CargoLabel type={o.cargo} /></span>
          <div className="flex items-center gap-1.5"><ModeChip o={o} /><StatusBadge status={o.status} /></div>
        </div>
        <RouteLine from={o.origin.city} to={o.dest.city} />
        <div className="flex flex-wrap items-center gap-2">
          {o.tempMin !== undefined && o.tempMax !== undefined && <TempChip min={o.tempMin} max={o.tempMax} />}
          <OdorChip odor={o.odor} sensitive={o.odorSensitive} />
        </div>
        <div className="flex items-end justify-between gap-3 border-t border-line pt-3 text-sm">
          <div className="space-y-0.5 text-ink-3">
            <div>{jShort(o.pickupAt)}، {hhmm(o.pickupAt)} · {VEHICLES[o.vehicleKind].short} · {weightLabel(o.weightKg)}</div>
            {driver && <div className="font-medium text-ink-2">راننده: {driver}</div>}
          </div>
          <div className="text-end"><div className="font-black">{toman(totalDue(o))}</div>{o.groupSize > 1 && <div className="text-xs text-ink-3">خودروی {fa(o.groupIndex)} از {fa(o.groupSize)}</div>}</div>
        </div>
      </Card>
    </Link>
  );
}

/** Multi-vehicle order: shared facts once, a row per vehicle. */
export function OrderGroupCard({ items, s, base }: { items: Order[]; s: State; base: string }) {
  const f = items[0];
  const counts = items.reduce<Record<string, number>>((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {});
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold"><CargoLabel type={f.cargo} /> · {fa(items.length)} خودرو</span>
        <div className="flex flex-wrap gap-1.5">{Object.entries(counts).map(([st, n]) => <Badge key={st} tone={STATUS[st as OrderStatus].tone}>{fa(n)} {STATUS[st as OrderStatus].label}</Badge>)}</div>
      </div>
      <RouteLine from={f.origin.city} to={f.dest.city} />
      <ul className="divide-y divide-line rounded-ui bg-surface-2">
        {items.map((o) => (
          <li key={o.id}>
            <Link href={`${base}${o.id}`} className="flex min-h-12 items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium">خودروی {fa(o.groupIndex)} · {o.driverId ? person(s, o.driverId)?.name : "بدون راننده"}</span>
              <StatusBadge status={o.status} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ───────── Status timeline ───────── */

const HAPPY: { to: OrderStatus; label: string }[] = [
  { to: "OPEN", label: "ثبت سفارش" },
  { to: "LOCKED", label: "انتخاب راننده" },
  { to: "ASSIGNED", label: "پرداخت بیعانه و تأیید" },
  { to: "EN_ROUTE_TO_PICKUP", label: "راننده در راه مبدأ" },
  { to: "AT_PICKUP", label: "رسیدن به مبدأ" },
  { to: "IN_TRANSIT", label: "بارگیری و حرکت" },
  { to: "AT_DELIVERY", label: "رسیدن به مقصد" },
  { to: "DELIVERED", label: "تحویل با کد گیرنده" },
  { to: "COMPLETED", label: "تسویه کامل" },
];
const ORDER_RANK: Partial<Record<OrderStatus, number>> = { DRAFT: 0, OPEN: 0, PRO_POOL: 0, DIRECT_REQUESTED: 0, LOCKED: 1, AWAITING_DEPOSIT: 1, ASSIGNED: 2, EN_ROUTE_TO_PICKUP: 3, AT_PICKUP: 4, MISMATCH_REVIEW: 4, IN_TRANSIT: 5, AT_DELIVERY: 6, DELIVERED: 7, COMPLETED: 8, DISPUTED: 7 };

export function StatusTimeline({ o }: { o: Order }) {
  const ended = o.status.startsWith("CANCELLED") || o.status === "EXPIRED";
  const cur = ended ? Math.max(0, ...o.events.map((e) => ORDER_RANK[e.to] ?? 0)) : ORDER_RANK[o.status] ?? 0;
  const at = (to: OrderStatus) => o.events.find((e) => e.to === to)?.at ?? (to === "OPEN" ? o.createdAt : undefined);
  return (
    <ol className="space-y-0" aria-label="روند سفارش">
      {HAPPY.map((st, i) => {
        const done = i < cur || (!ended && i === cur && o.status === "COMPLETED");
        const on = i === cur && !ended && o.status !== "COMPLETED";
        const t = at(st.to);
        return (
          <li key={st.to} className="flex gap-3" aria-current={on ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", done ? "bg-ok text-white" : on ? "bg-brand-500 text-ink ring-4 ring-brand-100" : "bg-surface-3 text-ink-4")}>{done ? <Check className="size-3.5" aria-hidden /> : on ? <Clock className="size-3.5" aria-hidden /> : fa(i + 1)}</span>
              {i < HAPPY.length - 1 && <span className={cx("w-0.5 flex-1", done ? "bg-ok" : "bg-line")} style={{ minHeight: 20 }} />}
            </div>
            <div className="pb-4"><div className={cx("text-sm", on ? "font-black" : done ? "font-medium" : "text-ink-3")}>{st.label}</div>{t && (done || on) && <div className="text-xs text-ink-3">{jDateTime(t)}</div>}</div>
          </li>
        );
      })}
      {ended && <li className="flex gap-3"><span className="grid size-6 place-items-center rounded-full bg-danger text-white"><AlertTriangle className="size-3.5" aria-hidden /></span><div className="text-sm font-bold text-danger">{STATUS[o.status].label}{o.cancel?.reason ? ` · ${o.cancel.reason}` : ""}</div></li>}
    </ol>
  );
}

/* ───────── Price breakdown (shipper perspective: commission is never shown) ───────── */

export function PriceBreakdown({ o, dense }: { o: Order; dense?: boolean }) {
  const rows: [string, number, "neg"?][] = [["کرایه", o.freight]];
  if (o.proUpliftPct > 0) rows[0][0] = `کرایه (شامل ${fa(Math.round(o.proUpliftPct * 100))}٪ سرویس پرو)`;
  if (o.insurance.premium) rows.push(["حق بیمه", o.insurance.premium]);
  if (o.vat) rows.push(["مالیات", o.vat]);
  if (o.tipPre) rows.push(["انعام / جذب سریع", o.tipPre]);
  if (o.discount) rows.push([`تخفیف${o.couponCode ? ` (${o.couponCode})` : ""}`, -o.discount, "neg"]);
  if (o.waitFee) rows.push(["هزینه‌ی انتظار", o.waitFee]);
  const total = totalDue(o) + o.waitFee;
  const paid = shipperPaid(o);
  return (
    <dl className={cx("space-y-2", dense ? "text-sm" : "text-[15px]")}>
      {rows.map(([k, v, neg]) => <div key={k} className="flex justify-between gap-3"><dt className="text-ink-3">{k}</dt><dd className={cx("font-bold tabular", neg && "text-ok")}>{v < 0 ? "−" : ""}{toman(Math.abs(v))}</dd></div>)}
      <div className="flex justify-between gap-3 border-t border-line pt-2 font-black"><dt>جمع کل</dt><dd className="tabular">{toman(total)}</dd></div>
      {paid > 0 && <div className="flex justify-between gap-3 text-ok"><dt>پرداخت‌شده</dt><dd className="font-bold tabular">{toman(paid)}</dd></div>}
      {outstanding(o) > 0 && <div className="flex justify-between gap-3 text-warn"><dt>مانده</dt><dd className="font-bold tabular">{toman(outstanding(o))}</dd></div>}
    </dl>
  );
}
void Crown;
