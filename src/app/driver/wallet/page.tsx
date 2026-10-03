"use client";

import { ArrowDownLeft, Banknote, Gift, Landmark, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/Toaster";
import { Badge, Button, Card, EmptyState, Field, Input, NumInput, Progress, Sheet, Stat, Tabs } from "@/components/ui";
import { claimIncentive, incentiveProgress } from "@/lib/engine/payout";
import { payDebt, requestPayout } from "@/lib/engine/payout";
import { saveIban } from "@/lib/engine/kyc";
import { cv } from "@/lib/config";
import { fa, jDateTime, toman } from "@/lib/format";
import { usePortal } from "@/lib/hooks";
import { driverWallet, A } from "@/lib/ledger";
import { R } from "@/lib/money";
import { act } from "@/lib/store";

type Tab = "ledger" | "payouts" | "incentives";
const PAYOUT_LABEL: Record<string, [string, "ok" | "warn" | "danger" | "info" | "neutral"]> = {
  REQUESTED: ["ثبت شد", "info"], UNDER_REVIEW: ["در بررسی", "warn"], ON_HOLD: ["نگه‌داشته", "warn"], APPROVED: ["تأییدشده", "info"], BATCHED: ["در دسته‌ی پرداخت", "info"],
  SENT: ["ارسال‌شده به بانک", "info"], SETTLED: ["واریز شد", "ok"], FAILED: ["ناموفق", "danger"], CANCELLED: ["لغو", "neutral"],
};

export default function Page() {
  const { s, me, driver } = usePortal("driver");
  const [tab, setTab] = useState<Tab>("ledger");
  const [po, setPo] = useState(false);
  const [debtSheet, setDebtSheet] = useState(false);
  const [ibanOpen, setIbanOpen] = useState(false);
  const [amt, setAmt] = useState<number | undefined>();
  const [instant, setInstant] = useState(false);
  const [sheba, setSheba] = useState("");
  if (!me || !driver) return null;
  const w = driverWallet(s, me.id);
  const rows = s.ledger.filter((e) => [A.dAvail(me.id), A.dPending(me.id), A.dDebt(me.id)].includes(e.account)).sort((a, b) => b.at - a.at).slice(0, 60);
  const payouts = s.payouts.filter((p) => p.driverId === me.id).sort((a, b) => b.at - a.at);
  const incentives = s.incentives.filter((i) => i.active);
  const fee = instant ? Math.round(((amt ?? 0) * 10 * cv<number>(s, "payout.instantFeePct")) / 1000) * 1000 : 0;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">درآمد و کیف پول</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="قابل برداشت" value={toman(w.available)} tone="accent" />
        <Stat label="در انتظار آزادسازی" value={toman(w.pending)} sub="پس از پنجره‌ی اعتراض" />
      </div>
      {w.debt > 0 && <Card className="space-y-2 border border-danger/30 bg-danger-bg p-4"><div className="font-black text-danger">بدهی کارمزد: {toman(w.debt)}</div><p className="text-sm leading-7 text-danger">از درآمدهای بعدی کسر می‌شود؛ برای رفع محدودیت‌ها می‌توانید هم‌اکنون تسویه کنید.</p><Button size="sm" onClick={() => setDebtSheet(true)}>تسویه‌ی بدهی</Button></Card>}
      <div className="grid grid-cols-2 gap-2"><Button size="lg" disabled={w.available <= 0} onClick={() => { if (!driver.iban?.holderMatches) setIbanOpen(true); else setPo(true); }}><Banknote className="size-5" aria-hidden />برداشت</Button>
        <Button size="lg" variant="secondary" onClick={() => setIbanOpen(true)}><Landmark className="size-5" aria-hidden />{driver.iban ? "تغییر شبا" : "ثبت شبا"}</Button></div>
      {driver.iban && <p className="text-xs text-ink-3">شبا: <span dir="ltr" className="tabular">{driver.iban.sheba}</span> · {driver.iban.holder}</p>}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "ledger", label: "تراکنش‌ها" }, { id: "payouts", label: "برداشت‌ها", count: payouts.length }, { id: "incentives", label: "مشوق‌ها" }]} />

      {tab === "ledger" && (rows.length === 0 ? <EmptyState icon={<Wallet className="size-8" />} title="هنوز درآمدی ثبت نشده" body="پس از اولین تحویل موفق، اینجا می‌بینید." /> : <Card className="divide-y divide-line">{rows.map((e) => <div key={e.id} className="flex items-center gap-3 p-4"><span className={`grid size-10 shrink-0 place-items-center rounded-full ${e.amount < 0 ? "bg-ok-bg text-ok" : "bg-surface-3"}`}><ArrowDownLeft className="size-5" aria-hidden /></span><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{e.memo}</div><div className="text-xs text-ink-3">{jDateTime(e.at)}</div></div><span className={`font-black tabular ${e.amount < 0 ? "text-ok" : ""}`}>{e.amount < 0 ? "+" : "−"}{toman(Math.abs(e.amount))}</span></div>)}</Card>)}
      {tab === "payouts" && (payouts.length === 0 ? <EmptyState icon={<Banknote className="size-8" />} title="برداشتی ثبت نکرده‌اید" /> : <div className="space-y-3">{payouts.map((p) => { const [l, t] = PAYOUT_LABEL[p.status] ?? [p.status, "neutral" as const]; return <Card key={p.id} className="space-y-2 p-4"><div className="flex items-center justify-between"><span className="font-black">{toman(p.amount)}</span><Badge tone={t}>{l}</Badge></div><div className="text-xs text-ink-3">{jDateTime(p.at)}{p.instant ? " · فوری" : ""}{p.fee ? ` · کارمزد ${toman(p.fee)}` : ""}</div>{p.failReason && <p className="text-sm text-danger">{p.failReason}؛ مبلغ به کیف پول شما برگشت.</p>}{p.flags.length > 0 && <p className="text-xs text-ink-3">{p.flags.join(" · ")}</p>}</Card>; })}</div>)}
      {tab === "incentives" && (incentives.length === 0 ? <EmptyState icon={<Gift className="size-8" />} title="مشوق فعالی نیست" /> : <div className="space-y-3">{incentives.map((i) => { const p = incentiveProgress(s, me.id, i); return <Card key={i.id} className="space-y-2 p-4"><div className="flex items-center justify-between"><span className="font-black">{i.title}</span><span className="font-black text-ok">{toman(i.reward)}</span></div><p className="text-sm text-ink-3">{i.desc}</p><Progress value={(p.value / p.target) * 100} /><div className="flex items-center justify-between text-xs"><span>{fa(Math.min(p.value, p.target))} از {fa(p.target)}</span>{p.done && !p.awarded && <Button size="sm" onClick={() => { const r = act((st) => claimIncentive(st, me.id, i.id)); toast(r.ok ? "پاداش به کیف پول شما اضافه شد." : r.error, r.ok ? "ok" : "err"); }}>دریافت پاداش</Button>}{p.awarded && <Badge tone="ok">دریافت شد</Badge>}</div></Card>; })}</div>)}

      <Sheet open={po} onClose={() => setPo(false)} title="درخواست برداشت" footer={<Button block disabled={!amt} onClick={() => { const r = act((st) => requestPayout(st, me.id, R(amt ?? 0), instant)); toast(r.ok ? "درخواست برداشت ثبت شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) setPo(false); }}>ثبت برداشت</Button>}>
        <div className="space-y-4"><div className="rounded-ui bg-surface-2 p-3 text-sm">قابل برداشت: <b>{toman(w.available)}</b></div>
          <Field label="مبلغ (تومان)" hint={`حداقل ${toman(cv<number>(s, "payout.min"))}`}>{(id) => <NumInput id={id} value={amt} onChange={setAmt} suffix="تومان" />}</Field>
          <button type="button" className="h-11 text-sm font-bold text-accent-600" onClick={() => setAmt(Math.floor(w.available / 10))}>برداشت همه‌ی موجودی</button>
          {driver.controls.instantPayout && <label className="flex min-h-12 items-center gap-3"><input type="checkbox" className="size-5" checked={instant} onChange={(e) => setInstant(e.target.checked)} />برداشت فوری {fee > 0 && <span className="text-sm text-ink-3">(کارمزد {toman(fee)})</span>}</label>}
          <p className="text-xs leading-6 text-ink-3">برداشت‌های اول، شبای جدید یا مبلغ بالا ممکن است برای بررسی تا ۲۴ ساعت نگه داشته شود.</p></div>
      </Sheet>
      <Sheet open={ibanOpen} onClose={() => setIbanOpen(false)} title="ثبت شماره‌ی شبا" footer={<Button block onClick={() => { const r = act((st) => saveIban(st, me.id, sheba)); toast(r.ok ? "شبا ثبت شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) setIbanOpen(false); }}>ثبت و بررسی نام صاحب حساب</Button>}>
        <Field label="شماره‌ی شبا" hint="فقط حساب به نام خودتان پذیرفته می‌شود.">{(id) => <Input id={id} dir="ltr" className="text-left" placeholder="IR000000000000000000000000" value={sheba} onChange={(e) => setSheba(e.target.value)} />}</Field>
      </Sheet>
      <Sheet open={debtSheet} onClose={() => setDebtSheet(false)} title="تسویه‌ی بدهی" footer={<div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => { const r = act((st) => payDebt(st, me.id, w.debt, "card")); toast(r.ok ? "بدهی تسویه شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) setDebtSheet(false); }}>با کارت</Button><Button onClick={() => { const r = act((st) => payDebt(st, me.id, w.debt, "wallet")); toast(r.ok ? "بدهی تسویه شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) setDebtSheet(false); }}>از موجودی</Button></div>}>
        <div className="text-center"><div className="text-sm text-ink-3">مبلغ بدهی</div><div className="mt-1 text-3xl font-black">{toman(w.debt)}</div></div>
      </Sheet>
    </div>
  );
}
