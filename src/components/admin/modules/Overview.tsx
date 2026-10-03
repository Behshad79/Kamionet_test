"use client";

import { AlertTriangle, ArrowLeft, Clock, FileSearch, Thermometer } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MapView } from "../../MapView";
import { StatusBadge } from "../../molecules";
import { Card, Tabs } from "../../ui";
import { BarList, LineChart, SERIES, ShareBar, Spark } from "../charts";
import { Denied, Kpi, PageHead, Panel, Pill, useAdmin } from "../kit";
import { OrderDrawer } from "./Orders";
import { A, bal, trialBalance } from "@/lib/ledger";
import { person, ACTIVE_TRIP } from "@/lib/engine/core";
import { fa, jShort, STATUS, toman, tomanWords } from "@/lib/format";
import { lerp } from "@/lib/geo";
import { useNow } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { excursions, readings, telemetryOf, tripProgress } from "@/lib/telemetry";
import type { Order, OrderStatus } from "@/lib/types";

const DAY = 86_400_000;
const day0 = (t: number) => new Date(t).setHours(0, 0, 0, 0);
const dFmt = (x: number) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short" }).format(x);

/** Orders currently out of temperature range (uses the same sensor simulation the shippers see). */
export function liveAlerts(orders: Order[], now: number) {
  return orders.filter((o) => o.status === "IN_TRANSIT" && o.tempMin !== undefined).map((o) => ({ o, ex: excursions(readings(telemetryOf(o), now)).find((e) => e.ongoing) })).filter((x) => x.ex);
}

export function DashboardModule() {
  const s = useStore();
  const { has } = useAdmin();
  const now = useNow(5000);
  const k = useMemo(() => {
    const from = day0(now) - 29 * DAY;
    const days = Array.from({ length: 30 }, (_, i) => from + i * DAY);
    const created = days.map((d) => s.orders.filter((o) => day0(o.createdAt) === d).length);
    const completed = days.map((d) => s.orders.filter((o) => o.completedAt ? day0(o.completedAt) === d : o.deliveredAt && day0(o.deliveredAt) === d).length);
    const gmvDay = days.map((d) => s.payments.filter((p) => p.status === "SUCCEEDED" && day0(p.at) === d && p.purpose !== "topup").reduce((n, p) => n + p.amount, 0) / 10);
    const last30 = s.orders.filter((o) => o.createdAt >= from);
    const gmv = s.orders.filter((o) => ["COMPLETED", "DELIVERED"].includes(o.status) && (o.deliveredAt ?? 0) >= from).reduce((n, o) => n + o.freight, 0);
    const routes = new Map<string, number>();
    last30.forEach((o) => routes.set(`${o.origin.city} ← ${o.dest.city}`, (routes.get(`${o.origin.city} ← ${o.dest.city}`) ?? 0) + 1));
    const status = new Map<OrderStatus, number>();
    s.orders.forEach((o) => status.set(o.status, (status.get(o.status) ?? 0) + 1));
    return { days, created, completed, gmvDay, gmv, last30, routes: [...routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6), status };
  }, [s, now]);
  if (!has("dashboard")) return <Denied perm="dashboard" />;
  const revenue = bal(s, A.REV_COMM) + bal(s, A.REV_FEES);
  const cancelled = k.last30.filter((o) => o.status.startsWith("CANCELLED") || o.status === "EXPIRED").length;
  const transit = s.orders.filter((o) => o.status === "IN_TRANSIT");
  const alerts = liveAlerts(s.orders, now);
  const unassigned = s.orders.filter((o) => ["OPEN", "PRO_POOL"].includes(o.status));
  const oldest = unassigned.reduce((m, o) => Math.min(m, o.createdAt), now);
  const todo = [
    { n: alerts.length, label: "انحراف دمایی در جریان", href: "/admin/live/", tone: "danger" as const },
    { n: unassigned.filter((o) => now - o.createdAt > 3_600_000).length, label: "بار بیش از ۱ ساعت بدون راننده", href: "/admin/dispatch/", tone: "warn" as const },
    { n: s.drivers.filter((d) => d.kyc.status === "pending").length, label: "پرونده‌ی احراز در صف", href: "/admin/kyc/", tone: "warn" as const },
    { n: s.mismatches.filter((m) => m.status === "ESCALATED").length, label: "مغایرت ارجاع‌شده", href: "/admin/disputes/", tone: "warn" as const },
    { n: s.payouts.filter((p) => ["UNDER_REVIEW", "REQUESTED", "ON_HOLD"].includes(p.status)).length, label: "برداشت در انتظار تصمیم", href: "/admin/payouts/", tone: "warn" as const },
    { n: s.receipts.filter((r) => r.status === "PENDING").length, label: "رسید کارت‌به‌کارت در انتظار", href: "/admin/payments/", tone: "warn" as const },
    { n: s.approvals.filter((a) => a.status === "PENDING").length, label: "درخواست تأیید دو نفره", href: "/admin/approvals/", tone: "info" as const },
    { n: s.tickets.filter((t) => ["OPEN", "ESCALATED"].includes(t.status) && t.slaDueAt < now).length, label: "تیکت با SLA نقض‌شده", href: "/admin/support/", tone: "danger" as const },
  ].filter((x) => x.n > 0);
  return (
    <div>
      <PageHead title="داشبورد اجرایی" sub="نمای زنده‌ی عملیات و مالی ۳۰ روز اخیر" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="سفارش‌ها (۳۰ روز)" value={fa(k.last30.length)} spark={<Spark values={k.created} />} />
        <Kpi label="ارزش کرایه‌ی تحویل‌شده" value={tomanWords(k.gmv)} spark={<Spark values={k.gmvDay} color={SERIES[1]} />} />
        <Kpi label="درآمد پلتفرم (تجمعی)" value={tomanWords(revenue)} tone="ok" sub="کارمزد + کارمزد برداشت" />
        <Kpi label="کامیون در مسیر" value={fa(transit.length)} sub={alerts.length ? `${fa(alerts.length)} با انحراف دما` : "همه در بازه‌ی مجاز"} tone={alerts.length ? "danger" : undefined} />
        <Kpi label="بار منتظر راننده" value={fa(unassigned.length)} sub={unassigned.length ? `قدیمی‌ترین ${fa(Math.round((now - oldest) / 60_000))} دقیقه` : "—"} tone={unassigned.length > 40 ? "warn" : undefined} />
        <Kpi label="نرخ لغو / انقضا" value={`${fa(Math.round((cancelled / Math.max(1, k.last30.length)) * 100))}٪`} sub={`${fa(cancelled)} مورد`} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="سفارش‌های ثبت‌شده و تکمیل‌شده (۳۰ روز)"><LineChart series={[{ name: "ثبت‌شده", points: k.days.map((d, i) => ({ x: d, y: k.created[i] })) }, { name: "تحویل‌شده", points: k.days.map((d, i) => ({ x: d, y: k.completed[i] })) }]} xLabel={dFmt} /></Panel>
        <Panel title="نیازمند اقدام">{todo.length === 0 ? <p className="text-sm text-ink-3">مورد معوقه‌ای نیست.</p> : <ul className="space-y-2">{todo.map((t) => <li key={t.label}><Link href={t.href} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 text-sm font-medium transition hover:bg-act-soft"><span className="flex items-center gap-2">{t.tone === "danger" ? <AlertTriangle className="size-4 text-danger" aria-hidden /> : <Clock className="size-4 text-warn" aria-hidden />}{t.label}</span><span className="flex items-center gap-2"><Pill tone={t.tone}>{fa(t.n)}</Pill><ArrowLeft className="size-4 text-ink-4" aria-hidden /></span></Link></li>)}</ul>}</Panel>
        <Panel title="پرتقاضاترین مسیرها"><BarList rows={k.routes.map(([label, value]) => ({ label, value }))} /></Panel>
        <Panel title="توزیع وضعیت سفارش‌ها (کل)"><ShareBar parts={[...k.status.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([st, value], i) => ({ label: STATUS[st].label, value, color: SERIES[i % 5] }))} /></Panel>
        <Panel title="سلامت مالی" className="xl:col-span-2"><FinanceHealth /></Panel>
      </div>
    </div>
  );
}

function FinanceHealth() {
  const s = useStore();
  const tb = trialBalance(s);
  const debit = tb.reduce((n, r) => n + r.debit, 0), credit = tb.reduce((n, r) => n + r.credit, 0);
  const wallets = tb.filter((r) => r.account.startsWith("W:S:")).reduce((n, r) => n + r.credit, 0);
  const dw = tb.filter((r) => r.account.startsWith("W:D:")).reduce((n, r) => n + r.credit, 0);
  const esc = tb.filter((r) => r.account.startsWith("ESCROW:")).reduce((n, r) => n + r.credit, 0);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi label="تراز دفتر کل" value={debit === credit ? "متوازن" : "نامتراز"} tone={debit === credit ? "ok" : "danger"} sub={`${fa(s.ledger.length)} ردیف`} />
      <Kpi label="کیف پول صاحبان بار" value={tomanWords(wallets)} />
      <Kpi label="کیف پول رانندگان" value={tomanWords(dw)} />
      <Kpi label="امانی‌های جاری (Escrow)" value={tomanWords(esc)} sub={`حساب معلق: ${tomanWords(bal(s, A.SUSPENSE))}`} />
    </div>
  );
}

/* ───────────────────────── live ops ───────────────────────── */

export function LiveModule() {
  const s = useStore();
  const { has } = useAdmin();
  const now = useNow(2000);
  const [only, setOnly] = useState<"all" | "alert">("all");
  const [sel, setSel] = useState<string | null>(null);
  if (!has("liveops")) return <Denied perm="liveops" />;
  const trips = s.orders.filter((o) => ACTIVE_TRIP.includes(o.status) && o.loadedAt);
  const bad = new Set(liveAlerts(s.orders, now).map((x) => x.o.id));
  const shown = trips.filter((o) => only === "all" || bad.has(o.id));
  const pos = (o: Order) => lerp(o.origin, o.dest, tripProgress(telemetryOf(o), now));
  return (
    <div>
      <PageHead title="نقشه‌ی زنده‌ی عملیات" sub="موقعیت و دمای کامیون‌های در مسیر (شبیه‌سازی‌شده)" actions={<Tabs value={only} onChange={setOnly} tabs={[{ id: "all", label: "همه", count: trips.length }, { id: "alert", label: "هشدار دما", count: bad.size }]} />} />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden"><MapView className="h-[62dvh] min-h-96" cluster fitKey={`${only}${shown.length}`} markers={shown.map((o) => ({ id: o.id, lat: pos(o).lat, lng: pos(o).lng, kind: "truck" as const }))} onMarkerClick={setSel} /></Card>
        <Card className="max-h-[62dvh] min-h-96 overflow-y-auto p-2"><ul className="space-y-1">{shown.length === 0 ? <li className="p-6 text-center text-sm text-ink-3">موردی نیست.</li> : shown.map((o) => (
          <li key={o.id}><button onClick={() => setSel(o.id)} className="flex min-h-14 w-full items-center gap-3 rounded-xl p-2.5 text-start hover:bg-act-soft"><span className={`grid size-9 shrink-0 place-items-center rounded-full ${bad.has(o.id) ? "bg-danger-bg text-danger" : "bg-ok-bg text-ok"}`}><Thermometer className="size-4" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{o.origin.city} ← {o.dest.city}</span><span className="block truncate text-xs text-ink-3">{person(s, o.driverId)?.name} · {fa(Math.round(tripProgress(telemetryOf(o), now) * 100))}٪ مسیر</span></span><StatusBadge status={o.status} /></button></li>
        ))}</ul></Card>
      </div>
      <OrderDrawer id={sel} onClose={() => setSel(null)} />
      <span className="sr-only"><FileSearch />{jShort(now)}{toman(0)}</span>
    </div>
  );
}
