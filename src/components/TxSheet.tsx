"use client";

import { ArrowDownLeft, ArrowUpRight, Copy } from "lucide-react";
import Link from "next/link";
import { accountLabel } from "@/lib/ledger";
import { fa, jDateTime, toman } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { LedgerEntry, PaymentMethod, PaymentStatus } from "@/lib/types";
import { toast } from "./Toaster";
import { Badge, Sheet } from "./ui";

const METHOD: Record<PaymentMethod, string> = { wallet: "کیف پول", card: "پرداخت اینترنتی (درگاه بانکی)", split: "کیف پول + درگاه بانکی", card2card: "کارت‌به‌کارت", paya: "حواله‌ی پایا", credit: "اعتبار سازمانی" };
const PURPOSE: Record<string, string> = { topup: "شارژ کیف پول", deposit: "بیعانه‌ی سفارش", balance: "مابقی کرایه", tip: "انعام", mismatch_delta: "مابه‌التفاوت مغایرت", debt: "تسویه‌ی بدهی", fee: "جریمه" };
const STATUS: Record<PaymentStatus, [string, "ok" | "warn" | "danger" | "neutral"]> = {
  SUCCEEDED: ["موفق", "ok"], PENDING: ["در انتظار", "warn"], PROCESSING: ["در حال پردازش بانک", "warn"], FAILED: ["ناموفق", "danger"], EXPIRED: ["منقضی", "neutral"],
  REFUNDED: ["بازپرداخت‌شده", "neutral"], PARTIAL_REFUND: ["بازپرداخت جزئی", "neutral"], AWAITING_VERIFICATION: ["در انتظار تأیید رسید", "warn"],
};
const sec = (t: number) => `${jDateTime(t)}:${String(new Date(t).getSeconds()).padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])}`;

function Row({ k, v, mono, copy }: { k: string; v?: React.ReactNode; mono?: boolean; copy?: string }) {
  if (v === undefined || v === null || v === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-ink-3">{k}</dt>
      <dd className={`flex items-center gap-1.5 text-end font-bold ${mono ? "tabular" : ""}`} dir={mono ? "ltr" : undefined}>{v}{copy && <button aria-label="کپی" className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-3" onClick={() => { navigator.clipboard?.writeText(copy); toast("کپی شد.", "info"); }}><Copy className="size-3.5" /></button>}</dd>
    </div>
  );
}

/** Full audit view of one wallet movement: what, when, which bank/terminal, and the double-entry lines behind it. */
export function TxSheet({ e, balanceAfter, onClose, orderBase }: { e: LedgerEntry | null; balanceAfter?: number; onClose: () => void; orderBase: string }) {
  const s = useStore();
  if (!e) return null;
  const lines = s.ledger.filter((x) => x.txId === e.txId);
  const pay = e.ref?.paymentId ? s.payments.find((p) => p.id === e.ref!.paymentId) : undefined;
  const order = e.ref?.orderId ? s.orders.find((o) => o.id === e.ref!.orderId) : undefined;
  const payout = e.ref?.payoutId ? s.payouts.find((p) => p.id === e.ref!.payoutId) : undefined;
  const refund = s.refunds.find((r) => r.id && e.memo.includes("بازپرداخت") && r.payerId === e.ref?.personId && r.orderId === e.ref?.orderId);
  const credit = e.amount < 0;
  const tr = pay?.trail;
  return (
    <Sheet open onClose={onClose} title="جزئیات تراکنش" wide>
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-ui bg-surface-2 p-4">
          <span className={`grid size-12 shrink-0 place-items-center rounded-full ${credit ? "bg-ok-bg text-ok" : "bg-surface-3 text-ink-2"}`}>{credit ? <ArrowDownLeft className="size-6" aria-hidden /> : <ArrowUpRight className="size-6" aria-hidden />}</span>
          <div className="min-w-0"><div className="font-black">{e.memo}</div><div className={`text-2xl font-black tabular ${credit ? "text-ok" : ""}`}>{credit ? "+" : "−"}{toman(Math.abs(e.amount))}</div></div>
        </div>
        <dl className="divide-y divide-line rounded-ui bg-white px-4 shadow-soft">
          <Row k="زمان ثبت" v={sec(e.at)} />
          <Row k="شناسه‌ی تراکنش" v={e.txId} mono copy={e.txId} />
          <Row k="مانده‌ی کیف پول پس از تراکنش" v={balanceAfter !== undefined ? toman(balanceAfter) : undefined} />
          {order && <Row k="سفارش" v={<Link href={`${orderBase}${order.id}`} className="text-accent-600">{order.origin.city} ← {order.dest.city}</Link>} />}
          {payout && <><Row k="شبای مقصد" v={payout.sheba} mono copy={payout.sheba} /><Row k="صاحب حساب" v={payout.holder} /><Row k="وضعیت برداشت" v={payout.status} /><Row k="کارمزد برداشت" v={payout.fee ? toman(payout.fee) : "بدون کارمزد"} /></>}
        </dl>
        {pay && (
          <section aria-label="جزئیات پرداخت" className="space-y-2">
            <div className="flex items-center justify-between"><h3 className="font-extrabold">جزئیات پرداخت</h3><Badge tone={STATUS[pay.status][1]}>{STATUS[pay.status][0]}</Badge></div>
            <dl className="divide-y divide-line rounded-ui bg-white px-4 shadow-soft">
              <Row k="بابت" v={PURPOSE[pay.purpose] ?? pay.purpose} />
              <Row k="روش پرداخت" v={METHOD[pay.method]} />
              <Row k="مبلغ کل" v={toman(pay.amount)} />
              {pay.walletPart > 0 && <Row k="از کیف پول" v={toman(pay.walletPart)} />}
              {pay.cardPart > 0 && <Row k="از درگاه / حواله" v={toman(pay.cardPart)} />}
              {tr?.bank && <Row k="بانک فرستنده" v={tr.bank} />}
              {tr?.holder && <Row k="نام دارنده‌ی حساب / کارت" v={tr.holder} />}
              {tr?.cardMasked && <Row k="شماره‌ی کارت" v={tr.cardMasked} mono />}
              {tr?.terminalId && <Row k="شماره‌ی ترمینال" v={tr.terminalId} mono copy={tr.terminalId} />}
              {tr?.merchantId && <Row k="پذیرنده" v={`کامیونت · ${tr.merchantId}`} />}
              {tr?.rrn && <Row k="شماره‌ی مرجع بانکی (RRN)" v={tr.rrn} mono copy={tr.rrn} />}
              {tr?.traceNo && <Row k="شماره‌ی پیگیری" v={tr.traceNo} mono copy={tr.traceNo} />}
              {tr?.authCode && <Row k="کد تأیید تراکنش" v={tr.authCode} mono />}
              {pay.gatewayRef && <Row k="شناسه‌ی درگاه" v={pay.gatewayRef} mono copy={pay.gatewayRef} />}
              {tr && <Row k="آغاز پرداخت" v={sec(tr.initiatedAt)} />}
              {tr?.paidAt && <Row k="زمان پرداخت موفق" v={sec(tr.paidAt)} />}
              {tr?.callbackAt && tr.channel === "gateway" && <Row k="دریافت تأیید از بانک" v={sec(tr.callbackAt)} />}
              {tr?.ip && <Row k="نشانی IP" v={tr.ip} mono />}
              {tr?.device && <Row k="دستگاه" v={tr.device} />}
              {pay.failReason && <Row k="علت ناموفق‌بودن" v={pay.failReason} />}
              {pay.refunded > 0 && <Row k="بازپرداخت‌شده" v={toman(pay.refunded)} />}
              {refund && <Row k="بازپرداخت" v={`${toman(refund.amount)} به ${refund.to === "wallet" ? "کیف پول" : "کارت"}`} />}
            </dl>
            {pay.method === "card" || pay.method === "split" ? <p className="text-xs leading-6 text-ink-3">اطلاعات بانکی در این نسخه‌ی نمایشی شبیه‌سازی شده است؛ در نسخه‌ی عملیاتی از پاسخ درگاه پرداخت ثبت می‌شود.</p> : null}
          </section>
        )}
        <section aria-label="ردیف‌های حسابداری" className="space-y-2">
          <h3 className="font-extrabold">ردیف‌های دفتر کل (دوطرفه)</h3>
          <div className="overflow-hidden rounded-ui bg-white shadow-soft">
            <table className="w-full text-sm"><thead className="bg-surface-2 text-ink-3"><tr><th className="p-2.5 text-start font-medium" scope="col">حساب</th><th className="p-2.5 text-start font-medium" scope="col">بدهکار</th><th className="p-2.5 text-start font-medium" scope="col">بستانکار</th></tr></thead>
              <tbody>{lines.map((l) => <tr key={l.id} className="border-t border-line"><td className="p-2.5">{accountLabel(l.account)}</td><td className="p-2.5 tabular">{l.amount > 0 ? toman(l.amount) : "—"}</td><td className="p-2.5 tabular">{l.amount < 0 ? toman(-l.amount) : "—"}</td></tr>)}</tbody></table>
          </div>
          <p className="text-xs text-ink-3">{fa(lines.length)} ردیف · جمع بدهکار و بستانکار برابر است.</p>
        </section>
      </div>
    </Sheet>
  );
}
