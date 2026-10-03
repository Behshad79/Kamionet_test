"use client";

import { ArrowDownLeft, ArrowUpRight, FileText, Plus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { PaymentSheet } from "@/components/order/PaymentSheet";
import { toast } from "@/components/Toaster";
import { Badge, Button, Card, EmptyState, Sheet, Stat, Tabs, NumInput, Field } from "@/components/ui";
import { payArrears } from "@/lib/engine/pay";
import { payInvoice } from "@/lib/engine/payout";
import { fa, jDateTime, toman, tomanWords } from "@/lib/format";
import { usePortal } from "@/lib/hooks";
import { A, bal, shipperWallet } from "@/lib/ledger";
import { R } from "@/lib/money";
import { act } from "@/lib/store";

type Tab = "history" | "invoices" | "refunds";

export default function Page() {
  const { s, me, shipper } = usePortal("shipper");
  const [tab, setTab] = useState<Tab>("history");
  const [top, setTop] = useState(false);
  const [amt, setAmt] = useState<number | undefined>(5_000_000);
  const [pay, setPay] = useState(false);
  const w = me ? shipperWallet(s, me.id) : undefined;
  const arrears = me ? bal(s, A.shipperAr(me.id)) : 0;
  const credit = me ? bal(s, A.shipperCredit(me.id)) : 0;
  const rows = useMemo(() => {
    if (!me) return [];
    let run = 0;
    const own = s.ledger.filter((e) => e.account === A.shipper(me.id)).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    return own.map((e) => { run += -e.amount; return { ...e, run }; }).reverse();
  }, [s.ledger, me]);
  const invoices = s.invoices.filter((i) => i.partyId === me?.id);
  const refunds = s.refunds.filter((r) => r.payerId === me?.id);
  if (!me || !w) return null;
  const hasCredit = (shipper?.controls.creditTermsDays ?? 0) > 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-black">کیف پول و صورت‌حساب</h1><Button onClick={() => setTop(true)}><Plus className="size-5" aria-hidden />افزایش موجودی</Button></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="موجودی قابل استفاده" value={toman(w.available)} tone="accent" />
        <Stat label="مسدود برای سفارش‌ها" value={toman(w.held)} sub="تا تحویل نزد کامیونت امانت است" />
        {hasCredit && <Stat label="اعتبار استفاده‌شده" value={toman(credit)} sub={`از سقف ${toman(shipper!.controls.creditLimit)}`} />}
        {arrears > 0 && <Stat label="بدهی باز" value={toman(arrears)} />}
      </div>
      {arrears > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border border-warn/30 bg-warn-bg p-4"><span className="font-bold text-warn">بدهی {toman(arrears)} دارید؛ تا تسویه امکان ثبت سفارش جدید نیست.</span><Button size="sm" onClick={() => setPay(true)}>تسویه</Button></Card>
      )}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "history", label: "تراکنش‌ها" }, { id: "invoices", label: "فاکتورها", count: invoices.length }, { id: "refunds", label: "بازپرداخت‌ها", count: refunds.length }]} />
      {tab === "history" && (rows.length === 0 ? <EmptyState icon={<Wallet className="size-8" />} title="هنوز تراکنشی ندارید" body="با افزایش موجودی، پرداخت بیعانه یک‌ضرب انجام می‌شود." /> : (
        <Card className="divide-y divide-line">
          {rows.slice(0, 80).map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-4">
              <span className={`grid size-10 shrink-0 place-items-center rounded-full ${e.amount < 0 ? "bg-ok-bg text-ok" : "bg-surface-3 text-ink-2"}`}>{e.amount < 0 ? <ArrowDownLeft className="size-5" aria-hidden /> : <ArrowUpRight className="size-5" aria-hidden />}</span>
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{e.memo}</div><div className="text-xs text-ink-3">{jDateTime(e.at)}</div></div>
              <div className="text-end"><div className={`font-black tabular ${e.amount < 0 ? "text-ok" : ""}`}>{e.amount < 0 ? "+" : "−"}{toman(Math.abs(e.amount))}</div><div className="text-xs text-ink-3">مانده {toman(e.run)}</div></div>
            </div>
          ))}
        </Card>
      ))}
      {tab === "invoices" && (invoices.length === 0 ? <EmptyState icon={<FileText className="size-8" />} title="فاکتوری ندارید" body="فاکتورهای سازمانی و پس‌پرداخت اینجا نمایش داده می‌شود." /> : (
        <div className="grid gap-3">{invoices.map((i) => (
          <Card key={i.id} className="space-y-2 p-4"><div className="flex items-center justify-between"><span className="font-black">فاکتور {i.no}</span><Badge tone={i.status === "PAID" ? "ok" : i.status === "OVERDUE" ? "danger" : "warn"}>{{ PAID: "پرداخت‌شده", OVERDUE: "سررسید گذشته", ISSUED: "صادرشده", DRAFT: "پیش‌نویس", VOID: "باطل" }[i.status]}</Badge></div>
            <div className="text-sm text-ink-3">{jDateTime(i.at)}{i.dueAt ? ` · سررسید ${jDateTime(i.dueAt)}` : ""}</div><div className="font-black">{toman(i.amount)}</div>
            {["ISSUED", "OVERDUE"].includes(i.status) && <Button size="sm" onClick={() => { const r = act((st) => payInvoice(st, me.id, i.id, "wallet")); toast(r.ok ? "فاکتور تسویه شد." : r.error, r.ok ? "ok" : "err"); }}>تسویه از کیف پول</Button>}</Card>
        ))}</div>
      ))}
      {tab === "refunds" && (refunds.length === 0 ? <EmptyState icon={<ArrowDownLeft className="size-8" />} title="بازپرداختی ندارید" /> : (
        <Card className="divide-y divide-line">{refunds.map((r) => <div key={r.id} className="flex items-center justify-between gap-3 p-4"><div><div className="font-medium">{r.reason}</div><div className="text-xs text-ink-3">{jDateTime(r.at)} · به {r.to === "wallet" ? "کیف پول" : "کارت"}</div></div><div className="text-end"><div className="font-black tabular">{toman(r.amount)}</div><Badge tone={r.status === "PAID" ? "ok" : r.status === "REJECTED" ? "danger" : "warn"}>{{ PAID: "پرداخت‌شده", REJECTED: "رد شد", PENDING_APPROVAL: "در انتظار تأیید", APPROVED: "تأییدشده" }[r.status]}</Badge></div></div>)}</Card>
      ))}

      <Sheet open={top} onClose={() => setTop(false)} title="افزایش موجودی" footer={<Button block disabled={!amt || amt < 100_000} onClick={() => { setTop(false); setPay(true); }}>ادامه به پرداخت</Button>}>
        <div className="space-y-4"><Field label="مبلغ (تومان)" hint={amt ? tomanWords(R(amt)) : undefined}>{(id) => <NumInput id={id} value={amt} onChange={setAmt} suffix="تومان" />}</Field>
          <div className="grid grid-cols-3 gap-2">{[1_000_000, 5_000_000, 20_000_000].map((x) => <button key={x} onClick={() => setAmt(x)} className="h-11 rounded-ui border border-line text-sm font-bold">{fa(x / 1_000_000)} میلیون</button>)}</div></div>
      </Sheet>
      {pay && arrears > 0 && !top ? (
        <Sheet open onClose={() => setPay(false)} title="تسویه‌ی بدهی" footer={<div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => { const r = act((st) => payArrears(st, me.id, "card")); toast(r.ok ? "تسویه شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) setPay(false); }}>پرداخت با کارت</Button><Button onClick={() => { const r = act((st) => payArrears(st, me.id, "wallet")); toast(r.ok ? "تسویه شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) setPay(false); }}>از کیف پول</Button></div>}>
          <div className="text-center"><div className="text-sm text-ink-3">مبلغ بدهی</div><div className="mt-1 text-3xl font-black">{toman(arrears)}</div></div>
        </Sheet>
      ) : (
        <PaymentSheet open={pay && !top && !!amt} onClose={() => setPay(false)} payerId={me.id} purpose="topup" amount={R(amt ?? 0)} title="پرداخت" />
      )}
    </div>
  );
}
