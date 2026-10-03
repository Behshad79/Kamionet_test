"use client";

import { AlertCircle, Clock, PackagePlus, Search, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, Input, Progress, Stat, Tabs, ButtonLink, Card, Button } from "@/components/ui";
import { OrderCard, OrderGroupCard } from "@/components/order/parts";
import { AcceptSheet } from "@/components/rules";
import { fa, mmss, toman } from "@/lib/format";
import { usePortal, useNow } from "@/lib/hooks";
import { shipperCompleteness } from "@/lib/engine/profiles";
import { needsAcceptance } from "@/lib/engine/trust";
import { shipperWallet } from "@/lib/ledger";
import type { Order } from "@/lib/types";

type Tab = "active" | "open" | "done" | "closed";
const ACTIVE = ["LOCKED", "AWAITING_DEPOSIT", "ASSIGNED", "EN_ROUTE_TO_PICKUP", "AT_PICKUP", "MISMATCH_REVIEW", "IN_TRANSIT", "AT_DELIVERY", "DELIVERED", "DISPUTED"];
const OPEN = ["DRAFT", "OPEN", "PRO_POOL", "DIRECT_REQUESTED"];

export default function Page() {
  const { s, me, shipper } = usePortal("shipper");
  const now = useNow(1000);
  const [tab, setTab] = useState<Tab>("active");
  const [q, setQ] = useState("");
  const [accept, setAccept] = useState(false);
  const mine = useMemo(() => s.orders.filter((o) => o.shipperId === me?.id), [s.orders, me?.id]);
  const by = (t: Tab) => mine.filter((o) => (t === "active" ? ACTIVE.includes(o.status) : t === "open" ? OPEN.includes(o.status) : t === "done" ? o.status === "COMPLETED" : ["EXPIRED"].includes(o.status) || o.status.startsWith("CANCELLED")));
  const list = by(tab).filter((o) => !q.trim() || `${o.origin.city} ${o.dest.city}`.includes(q.trim()));
  const groups = useMemo(() => { const m = new Map<string, Order[]>(); list.forEach((o) => m.set(o.groupId, [...(m.get(o.groupId) ?? []), o])); return [...m.values()]; }, [list]);
  const wallet = me ? shipperWallet(s, me.id) : undefined;
  const todo = mine.flatMap((o) => {
    const out: { id: string; text: string; href: string; due?: number }[] = [];
    const r = `${o.origin.city} ← ${o.dest.city}`;
    if (o.status === "AWAITING_DEPOSIT" && o.depositDueAt) out.push({ id: o.id + "d", text: `پرداخت بیعانه · ${r}`, href: `/app/order/?id=${o.id}`, due: o.depositDueAt });
    if (o.status === "MISMATCH_REVIEW") out.push({ id: o.id + "m", text: `مغایرت بار نیاز به پاسخ شما دارد · ${r}`, href: `/app/order/?id=${o.id}` });
    if (o.status === "DIRECT_REQUESTED" && o.directExpiresAt && o.directExpiresAt < now) out.push({ id: o.id + "x", text: `راننده پاسخ نداد؛ انتخاب بعدی · ${r}`, href: `/app/order/?id=${o.id}` });
    if (o.status === "DELIVERED" && !s.reviews.some((x) => x.orderId === o.id && x.fromId === me?.id)) out.push({ id: o.id + "r", text: `به راننده امتیاز دهید · ${r}`, href: `/app/order/?id=${o.id}` });
    return out;
  });
  const comp = shipper ? Object.values(shipperCompleteness(shipper)).filter(Boolean).length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-black">سلام، {me?.name}</h1><p className="text-sm text-ink-3">وضعیت بارهای شما در یک نگاه</p></div>
        <ButtonLink href="/app/new/" size="lg"><PackagePlus className="size-5" aria-hidden />سفارش جدید</ButtonLink>
      </div>

      {me && needsAcceptance(s, me.id, "shipper") && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border border-warn/30 bg-warn-bg p-4"><span className="font-bold text-warn">نسخه‌ی جدید قوانین منتشر شده است؛ برای ثبت سفارش باید آن را بپذیرید.</span><Button size="sm" onClick={() => setAccept(true)}>مطالعه و پذیرش</Button></Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="سفارش فعال" value={fa(by("active").length)} />
        <Stat label="در انتظار راننده" value={fa(by("open").length)} />
        <Stat label="تکمیل‌شده" value={fa(by("done").length)} />
        <Link href="/app/wallet/"><Stat label="کیف پول" value={wallet ? toman(wallet.available) : "—"} sub={wallet && wallet.held > 0 ? `${toman(wallet.held)} مسدود` : undefined} tone="accent" /></Link>
      </div>

      {shipper && comp < 5 && (
        <Card className="space-y-2 p-4"><div className="flex items-center justify-between text-sm"><span className="font-bold">تکمیل پروفایل</span><span className="text-ink-3">{fa(comp)} از ۵</span></div><Progress value={(comp / 5) * 100} /><Link href="/app/profile/" className="inline-flex h-11 items-center text-sm font-bold text-accent-600">تکمیل پروفایل برای اعتماد بیشتر رانندگان</Link></Card>
      )}

      {todo.length > 0 && (
        <section aria-label="نیازمند اقدام" className="space-y-2">
          <h2 className="flex items-center gap-2 font-extrabold"><AlertCircle className="size-5 text-warn" aria-hidden />نیازمند اقدام شما</h2>
          {todo.map((t) => <Link key={t.id} href={t.href} className="flex min-h-12 items-center justify-between gap-3 rounded-ui bg-white p-3 shadow-soft"><span className="text-sm font-medium">{t.text}</span>{t.due && <span className="flex items-center gap-1 text-sm font-black text-warn tabular"><Clock className="size-4" aria-hidden />{mmss(t.due - now)}</span>}</Link>)}
        </section>
      )}

      <section className="space-y-4">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "active", label: "فعال", count: by("active").length }, { id: "open", label: "در انتظار راننده", count: by("open").length }, { id: "done", label: "تکمیل‌شده", count: by("done").length }, { id: "closed", label: "لغو / منقضی", count: by("closed").length }]} />
        <div className="relative"><Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden /><Input aria-label="جستجوی مسیر" placeholder="جستجوی شهر مبدأ یا مقصد" className="ps-12" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {!s.ready ? null : groups.length === 0 ? (
          <EmptyState icon={<Truck className="size-8" />} title={mine.length === 0 ? "هنوز سفارشی ثبت نکرده‌اید" : "سفارشی در این بخش نیست"} body={mine.length === 0 ? "اولین بار یخچالی‌تان را در کمتر از ۳ دقیقه ثبت کنید." : q ? "عبارت جستجو را تغییر دهید." : undefined} action={mine.length === 0 ? <ButtonLink href="/app/new/"><PackagePlus className="size-5" aria-hidden />ثبت اولین سفارش</ButtonLink> : undefined} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">{groups.map((g) => g.length > 1 ? <OrderGroupCard key={g[0].groupId} items={g} s={s} base="/app/order/?id=" /> : <OrderCard key={g[0].id} o={g[0]} s={s} href={`/app/order/?id=${g[0].id}`} />)}</div>
        )}
      </section>
      <Link href="/app/wallet/" className="sr-only"><Wallet /></Link>
      {me && <AcceptSheet open={accept} onClose={() => setAccept(false)} personId={me.id} audience="shipper" />}
    </div>
  );
}
