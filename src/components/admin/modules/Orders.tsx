"use client";

import { AlertTriangle, Eye, Gavel, Hand, MapPin, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { MapView } from "../../MapView";
import { StatusBadge } from "../../molecules";
import { StatusTimeline } from "../../order/parts";
import { Sheet, Tabs, Field, Input, Select, Button, Card, Badge } from "../../ui";
import { toast } from "../../Toaster";
import { DataTable, type Col } from "../DataTable";
import { Denied, KV, PageHead, Panel, Pill, useAdmin } from "../kit";
import { MM_STATUS, MM_TYPES } from "../../mismatch";
import { adminCancel, resolveMismatch } from "@/lib/engine/orders";
import { guard, manualAssign, orderNote, releaseOrderLock, broadcastToPro, boostOrder } from "@/lib/engine/admin";
import { commissionRate, driverNetFor, outstanding, shipperPaid, totalDue } from "@/lib/engine/pay";
import { eligibility } from "@/lib/engine/drivers";
import { driverStats } from "@/lib/engine/stats";
import { person, isTerminal } from "@/lib/engine/core";
import { CARGO, fa, jDateTime, PAY_TERMS, STATUS, toman, weightLabel } from "@/lib/format";
import { accountLabel } from "@/lib/ledger";
import { R } from "@/lib/money";
import { PAYMENT_METHOD, PAYMENT_PURPOSE, PAYMENT_STATUS } from "@/lib/labels";
import { startViewAs, useStore } from "@/lib/store";
import { VEHICLES } from "@/lib/vehicles";
import type { Order, OrderStatus } from "@/lib/types";

const sName = (s: ReturnType<typeof useStore>, id?: string) => (id ? person(s, id)?.name ?? "—" : "—");

/* ───────────────────────── order drawer (360° on one order) ───────────────────────── */

export function OrderDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const s = useStore();
  const { admin, has, run } = useAdmin();
  const [tab, setTab] = useState<"sum" | "fin" | "time" | "act">("sum");
  const [driverPick, setDriverPick] = useState("");
  const [reason, setReason] = useState("");
  const [boost, setBoost] = useState(300_000);
  const o = id ? s.orders.find((x) => x.id === id) : undefined;
  const cands = useMemo(() => (o ? s.drivers.filter((d) => d.kyc.status === "verified" && eligibility(s, d, { ...o, status: "OPEN" } as Order).ok).slice(0, 40) : []), [s, o]);
  if (!o) return null;
  const pays = s.payments.filter((p) => p.orderId === o.id);
  const tx = s.ledger.filter((e) => e.ref?.orderId === o.id).slice(0, 60);
  const dn = o.driverId ? driverNetFor(s, o) : undefined;
  const open = !isTerminal(o.status);
  return (
    <Sheet open onClose={onClose} title={`سفارش ${o.origin.city} ← ${o.dest.city}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={o.status} /><Pill>{o.id}</Pill>{o.serviceClass === "PRO" && <Pill tone="info">پرو</Pill>}{o.cargoMode === "AMBIENT" && <Pill>غیریخچالی</Pill>}{o.flag && <Pill tone="warn">پرچم: {o.flag.note}</Pill>}</div>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "sum", label: "خلاصه" }, { id: "fin", label: "مالی" }, { id: "time", label: "خط زمانی" }, { id: "act", label: "اقدام" }]} />
        {tab === "sum" && (
          <div className="space-y-4">
            <div className="h-48 overflow-hidden rounded-2xl"><MapView className="size-full" fitKey={o.id} markers={[{ id: "a", lat: o.origin.lat, lng: o.origin.lng, kind: "origin" }, { id: "b", lat: o.dest.lat, lng: o.dest.lng, kind: "dest" }]} lines={[{ id: "l", points: [[o.origin.lat, o.origin.lng], [o.dest.lat, o.dest.lng]], dashed: true, tone: "accent" }]} /></div>
            <dl className="grid divide-y divide-line/70 rounded-2xl bg-white px-4 shadow-soft sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
              <div className="divide-y divide-line/70"><KV k="صاحب بار" v={sName(s, o.shipperId)} /><KV k="راننده" v={sName(s, o.driverId)} /><KV k="بار" v={`${CARGO[o.cargo].label} · ${weightLabel(o.weightKg)}`} /><KV k="خودرو" v={VEHICLES[o.vehicleKind].short} /></div>
              <div className="divide-y divide-line/70"><KV k="بارگیری" v={jDateTime(o.pickupAt)} /><KV k="مهلت تحویل" v={jDateTime(o.deliverBy)} /><KV k="مسافت" v={`${fa(o.distanceKm)} کیلومتر`} /><KV k="شرایط پرداخت" v={PAY_TERMS[o.terms]} /></div>
            </dl>
            <p className="text-sm text-ink-3">{o.origin.address} ← {o.dest.address}</p>
          </div>
        )}
        {tab === "fin" && (
          <div className="space-y-4">
            <dl className="divide-y divide-line/70 rounded-2xl bg-white px-4 shadow-soft">
              <KV k="کرایه" v={toman(o.freight)} /><KV k="حق بیمه" v={toman(o.insurance.premium)} /><KV k="انعام" v={toman(o.tipPre + o.tipPost)} /><KV k="تخفیف (پلتفرم)" v={o.discount ? `−${toman(o.discount)}` : undefined} />
              <KV k="جمع کل" v={toman(totalDue(o))} /><KV k="پرداخت‌شده" v={toman(shipperPaid(o))} /><KV k="مانده" v={toman(outstanding(o))} />
              <KV k={`کارمزد پلتفرم (${fa(Math.round(commissionRate(s, o) * 100))}٪)`} v={dn ? toman(dn.commission) : undefined} /><KV k="درآمد خالص راننده" v={dn ? toman(dn.net) : undefined} />
              <KV k="تسویه" v={o.settlement ? `${toman(o.settlement.driverNet)} · ${o.settlement.released ? "آزادشده" : o.settlement.held ? "نگه‌داشته" : `آزادسازی ${jDateTime(o.settlement.releaseAt)}`}` : undefined} />
            </dl>
            <div><h3 className="mb-2 font-extrabold">پرداخت‌ها</h3>{pays.length === 0 ? <p className="text-sm text-ink-3">پرداختی ثبت نشده.</p> : <ul className="space-y-1.5 text-sm">{pays.map((p) => <li key={p.id} className="flex justify-between rounded-xl bg-surface-2 p-2.5"><span>{PAYMENT_PURPOSE[p.purpose] ?? p.purpose} · {PAYMENT_METHOD[p.method] ?? p.method} · {PAYMENT_STATUS[p.status]?.[0] ?? p.status}</span><b className="tabular">{toman(p.amount)}</b></li>)}</ul>}</div>
            <div><h3 className="mb-2 font-extrabold">ردیف‌های دفتر کل</h3><table className="w-full text-xs"><tbody>{tx.map((e) => <tr key={e.id} className="border-t border-line/70"><td className="p-1.5">{accountLabel(e.account)}</td><td className="p-1.5 text-ink-3">{e.memo}</td><td className="p-1.5 text-end tabular">{e.amount > 0 ? "بد " : "بس "}{toman(Math.abs(e.amount))}</td></tr>)}</tbody></table></div>
          </div>
        )}
        {tab === "time" && <StatusTimeline o={o} />}
        {tab === "act" && (
          <div className="space-y-5">
            {!has("orders.act") && <p className="rounded-xl bg-warn-bg p-3 text-sm text-warn">نقش شما فقط مشاهده می‌کند؛ اقدام‌ها هنگام اجرا پیام دسترسی نشان می‌دهند.</p>}
            {["OPEN", "PRO_POOL", "DIRECT_REQUESTED", "LOCKED"].includes(o.status) && (
              <Panel title="تخصیص دستی"><div className="flex gap-2"><Select aria-label="راننده" value={driverPick} onChange={(e) => setDriverPick(e.target.value)}><option value="">انتخاب راننده‌ی مناسب…</option>{cands.map((d) => <option key={d.personId} value={d.personId}>{sName(s, d.personId)} · {fa(Math.round(driverStats(s, d.personId).rating * 10) / 10)}★ · {VEHICLES[d.vehicle.kind].short}</option>)}</Select><Button disabled={!driverPick} onClick={() => run((x, a) => manualAssign(x, a, o.id, driverPick), "پیشنهاد برای راننده ارسال شد.")}><Hand className="size-4" aria-hidden />تخصیص</Button></div></Panel>
            )}
            {open && (
              <Panel title="مداخله‌های عملیاتی">
                <div className="flex flex-wrap gap-2">
                  {["LOCKED", "AWAITING_DEPOSIT"].includes(o.status) && <Button variant="secondary" size="sm" onClick={() => run((x, a) => releaseOrderLock(x, a, o.id), "قفل آزاد شد.")}>آزادسازی قفل/بیعانه</Button>}
                  {["OPEN", "DIRECT_REQUESTED"].includes(o.status) && <Button variant="secondary" size="sm" onClick={() => run((x, a) => broadcastToPro(x, a, o.id), "در بازار ویژه‌ی پرو منتشر شد.")}>انتشار در بازار ویژه‌ی پرو</Button>}
                  {["OPEN", "PRO_POOL"].includes(o.status) && <span className="flex items-center gap-1.5"><Input aria-label="انعام" className="h-9! w-28" dir="ltr" value={boost} onChange={(e) => setBoost(Number(e.target.value.replace(/\D/g, "")))} /><Button variant="secondary" size="sm" onClick={() => run((x, a) => boostOrder(x, a, o.id, R(boost)), "انعام پلتفرم اضافه شد.")}><Zap className="size-4" aria-hidden />افزودن انعام</Button></span>}
                </div>
              </Panel>
            )}
            {open && (
              <Panel title="لغو توسط پشتیبانی">
                <div className="flex gap-2"><Input aria-label="دلیل لغو" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل (الزامی)" /><Button variant="danger" disabled={reason.trim().length < 4} onClick={() => run((x, a) => { const g = guard(x, a, "orders.act"); return g.ok ? adminCancel(x, g.actor, o.id, reason) : g; }, "سفارش لغو شد.")}>لغو</Button></div>
              </Panel>
            )}
            <Panel title="یادداشت داخلی"><NoteBox onSave={(t) => run((x, a) => orderNote(x, a, o.id, t), "یادداشت ثبت شد.")} /></Panel>
            <Panel title="مشاهده به‌جای کاربر (فقط‌خواندنی، ثبت‌شده در ممیزی)"><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => { const r = startViewAs(admin.id, "shipper", o.shipperId); if (!r.ok) toast(r.error, "err"); }}><Eye className="size-4" aria-hidden />صاحب بار</Button>{o.driverId && <Button variant="secondary" size="sm" onClick={() => { const r = startViewAs(admin.id, "driver", o.driverId!); if (!r.ok) toast(r.error, "err"); }}><Eye className="size-4" aria-hidden />راننده</Button>}</div></Panel>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function NoteBox({ onSave }: { onSave: (t: string) => void }) {
  const [t, setT] = useState("");
  return <div className="flex gap-2"><Input aria-label="یادداشت" value={t} onChange={(e) => setT(e.target.value)} placeholder="یادداشت برای همکاران…" /><Button disabled={!t.trim()} onClick={() => { onSave(t); setT(""); }}>ثبت</Button></div>;
}

/* ───────────────────────── orders list ───────────────────────── */

export function OrdersModule() {
  const s = useStore();
  const { has } = useAdmin();
  const [sel, setSel] = useState<string | null>(null);
  if (!has("orders.view")) return <Denied perm="orders.view" />;
  const cols: Col<Order>[] = [
    { id: "id", label: "شناسه", cell: (o) => <span className="font-mono text-xs">{o.id}</span>, value: (o) => o.id },
    { id: "route", label: "مسیر", cell: (o) => <b>{o.origin.city} ← {o.dest.city}</b>, value: (o) => `${o.origin.city}-${o.dest.city}` },
    { id: "status", label: "وضعیت", cell: (o) => <StatusBadge status={o.status} />, value: (o) => STATUS[o.status].label },
    { id: "shipper", label: "صاحب بار", cell: (o) => sName(s, o.shipperId), value: (o) => sName(s, o.shipperId) },
    { id: "driver", label: "راننده", cell: (o) => sName(s, o.driverId), value: (o) => sName(s, o.driverId) },
    { id: "cargo", label: "بار", cell: (o) => CARGO[o.cargo].label, value: (o) => CARGO[o.cargo].label },
    { id: "veh", label: "خودرو", cell: (o) => VEHICLES[o.vehicleKind].short, value: (o) => VEHICLES[o.vehicleKind].short, hidden: true },
    { id: "freight", label: "کرایه", cell: (o) => toman(o.freight), value: (o) => o.freight / 10, num: true },
    { id: "pickup", label: "بارگیری", cell: (o) => jDateTime(o.pickupAt), value: (o) => o.pickupAt },
    { id: "created", label: "ثبت", cell: (o) => jDateTime(o.createdAt), value: (o) => o.createdAt, hidden: true },
  ];
  return (
    <div>
      <PageHead title="سفارش‌ها" sub="همه‌ی سفارش‌ها با جستجو، فیلتر و خروجی" />
      <DataTable id="orders" rows={s.orders} cols={cols} rowKey={(o) => o.id} onRow={(o) => setSel(o.id)} search={(o) => `${o.id} ${o.origin.city} ${o.dest.city} ${sName(s, o.shipperId)} ${sName(s, o.driverId)}`}
        filters={[{ id: "st", label: "وضعیت", options: (Object.keys(STATUS) as OrderStatus[]).map((k) => ({ id: k, label: STATUS[k].label })), test: (o, v) => o.status === v }, { id: "mode", label: "نوع", options: [{ id: "R", label: "یخچالی" }, { id: "A", label: "غیریخچالی" }, { id: "P", label: "پرو" }], test: (o, v) => (v === "R" ? o.cargoMode === "REFRIGERATED" : v === "A" ? o.cargoMode === "AMBIENT" : o.serviceClass === "PRO") }]} />
      <OrderDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}

/* ───────────────────────── dispatch ───────────────────────── */

export function DispatchModule() {
  const s = useStore();
  const { has } = useAdmin();
  const [sel, setSel] = useState<string | null>(null);
  if (!has("dispatch")) return <Denied perm="dispatch" />;
  const now = Date.now();
  const board = s.orders.filter((o) => ["OPEN", "PRO_POOL", "DIRECT_REQUESTED", "LOCKED", "AWAITING_DEPOSIT"].includes(o.status)).sort((a, b) => a.createdAt - b.createdAt);
  const age = (o: Order) => Math.round((now - o.createdAt) / 60_000);
  const cols: Col<Order>[] = [
    { id: "route", label: "مسیر", cell: (o) => <b>{o.origin.city} ← {o.dest.city}</b>, value: (o) => o.origin.city },
    { id: "st", label: "وضعیت", cell: (o) => <StatusBadge status={o.status} />, value: (o) => STATUS[o.status].label },
    { id: "wait", label: "در انتظار", cell: (o) => <Pill tone={age(o) > 180 ? "danger" : age(o) > 60 ? "warn" : "neutral"}>{fa(age(o))} دقیقه</Pill>, value: (o) => age(o), num: true },
    { id: "cands", label: "رانندگان مناسب", cell: (o) => fa(s.drivers.filter((d) => d.kyc.status === "verified" && eligibility(s, d, { ...o, status: o.serviceClass === "PRO" ? "PRO_POOL" : "OPEN" } as Order).ok).length), value: (o) => s.drivers.filter((d) => d.kyc.status === "verified" && eligibility(s, d, { ...o, status: "OPEN" } as Order).ok).length, num: true },
    { id: "tip", label: "انعام", cell: (o) => (o.tipPre ? toman(o.tipPre) : "—"), value: (o) => o.tipPre / 10, num: true },
    { id: "price", label: "کرایه", cell: (o) => toman(o.freight), value: (o) => o.freight / 10, num: true },
    { id: "pick", label: "بارگیری", cell: (o) => jDateTime(o.pickupAt), value: (o) => o.pickupAt },
  ];
  return (
    <div>
      <PageHead title="کنسول توزیع" sub="بارهای منتظر راننده، قدیمی‌ترین بالا. روی ردیف بزنید تا تخصیص دستی، انعام یا انتشار در بازار ویژه‌ی پرو را انجام دهید." />
      <DataTable id="dispatch" rows={board} cols={cols} rowKey={(o) => o.id} onRow={(o) => setSel(o.id)} search={(o) => `${o.origin.city} ${o.dest.city}`} />
      <OrderDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}

/* ───────────────────────── disputes & mismatch center ───────────────────────── */

export function DisputesModule() {
  const s = useStore();
  const { has, run, admin } = useAdmin();
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  if (!has("disputes")) return <Denied perm="disputes" />;
  const list = s.mismatches;
  const m = sel ? list.find((x) => x.id === sel) : undefined;
  const o = m ? s.orders.find((x) => x.id === m.orderId) : undefined;
  const decide = (outcome: "driver" | "shipper" | "split") => run((x, a) => { const g = guard(x, a, "disputes"); return g.ok ? resolveMismatch(x, g.actor, m!.id, outcome, note || "تصمیم پشتیبانی") : g; }, "حکم ثبت شد.");
  const cols: Col<(typeof list)[number]>[] = [
    { id: "id", label: "شناسه", cell: (x) => <span className="font-mono text-xs">{x.id}</span>, value: (x) => x.id },
    { id: "order", label: "سفارش", cell: (x) => { const oo = s.orders.find((y) => y.id === x.orderId); return <b>{oo?.origin.city} ← {oo?.dest.city}</b>; } },
    { id: "types", label: "نوع", cell: (x) => x.types.map((t) => MM_TYPES[t]).join("، ") },
    { id: "st", label: "وضعیت", cell: (x) => <Pill tone={MM_STATUS[x.status].tone}>{MM_STATUS[x.status].label}</Pill>, value: (x) => MM_STATUS[x.status].label },
    { id: "delta", label: "پیشنهاد راننده", cell: (x) => toman(x.proposedFreight), value: (x) => x.proposedFreight / 10, num: true },
    { id: "at", label: "زمان", cell: (x) => jDateTime(x.at), value: (x) => x.at },
  ];
  return (
    <div>
      <PageHead title="مرکز اختلاف و مغایرت" sub={`${fa(list.filter((x) => x.status === "ESCALATED").length)} پرونده منتظر حکم پشتیبانی`} />
      <DataTable id="mismatches" rows={list} cols={cols} rowKey={(x) => x.id} onRow={(x) => setSel(x.id)} filters={[{ id: "st", label: "وضعیت", options: ["PENDING_SHIPPER", "COUNTERED", "APPROVED", "REJECTED", "ESCALATED", "RESOLVED_DRIVER", "RESOLVED_SHIPPER", "SPLIT"].map((k) => ({ id: k, label: k })), test: (x, v) => x.status === v }]}
        empty={<Card className="p-8 text-center text-sm text-ink-3">پرونده‌ی مغایرتی ثبت نشده است.</Card>} />
      {m && o && (
        <Sheet open onClose={() => setSel(null)} title="پرونده‌ی مغایرت" wide footer={["ESCALATED", "PENDING_SHIPPER", "COUNTERED"].includes(m.status) ? <div className="space-y-2"><Input aria-label="دلیل حکم" value={note} onChange={(e) => setNote(e.target.value)} placeholder="دلیل حکم (در پرونده ثبت می‌شود)" /><div className="grid grid-cols-3 gap-2"><Button variant="secondary" onClick={() => decide("driver")}>به نفع راننده</Button><Button variant="secondary" onClick={() => decide("split")}>میانه</Button><Button variant="secondary" onClick={() => decide("shipper")}>به نفع صاحب بار</Button></div></div> : undefined}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">{m.types.map((t) => <Badge key={t}>{MM_TYPES[t]}</Badge>)}</div>
            <dl className="divide-y divide-line/70 rounded-2xl bg-white px-4 shadow-soft"><KV k="صاحب بار" v={sName(s, m.shipperId)} /><KV k="راننده" v={sName(s, m.driverId)} /><KV k="کرایه‌ی فعلی" v={toman(o.freight)} /><KV k="پیشنهاد راننده" v={toman(m.proposedFreight)} /><KV k="پیشنهاد متقابل" v={m.counter ? toman(m.counter.freight) : undefined} /><KV k="وزن اظهارشده / واقعی" v={`${weightLabel(o.weightKg)} / ${m.actual.weightKg ? weightLabel(m.actual.weightKg) : "—"}`} /><KV k="تصمیم" v={m.decision?.note} /></dl>
            <div className="grid grid-cols-3 gap-2">{m.photos.map((p, i) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={i} src={p.dataUrl} alt={`مدرک ${fa(i + 1)}`} className="aspect-square w-full rounded-xl object-cover" />)}</div>
            <div className="space-y-1 text-sm">{m.formula.map((l, i) => <div key={i} className="flex justify-between"><span className="text-ink-3">{l.label}</span><b className="tabular">{toman(l.amount)}</b></div>)}</div>
            <p className="text-xs text-ink-3">ثبت توسط {admin.name}</p>
          </div>
        </Sheet>
      )}
      <span className="sr-only"><AlertTriangle /><Gavel /><MapPin /></span>
    </div>
  );
}
