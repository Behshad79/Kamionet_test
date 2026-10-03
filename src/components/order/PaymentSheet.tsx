"use client";

import { CheckCircle2, CreditCard, Landmark, Receipt, Wallet, XCircle } from "lucide-react";
import { useState } from "react";
import { pay as payEngine } from "@/lib/engine/pay";
import { shipperOf } from "@/lib/engine/core";
import { shipperWallet, A, bal } from "@/lib/ledger";
import { toman } from "@/lib/format";
import { useStore, act } from "@/lib/store";
import type { Payment, PaymentMethod, PaymentPurpose } from "@/lib/types";
import { Button, Field, Input, Sheet, cx } from "../ui";
import { toast } from "../Toaster";

type Phase = { k: "choose" } | { k: "result"; p: Payment };

const BANK_CARD = "۶۲۷۴ ۱۲۳۴ ۵۶۷۸ ۹۰۱۲";

/**
 * Wallet-first checkout. Gateway outcomes come from the demo gateway scenario (Demo Director),
 * so the UI itself never fakes success: every state below is a real engine result.
 */
export function PaymentSheet({ open, onClose, payerId, orderId, purpose, amount, title, onDone }: {
  open: boolean; onClose: () => void; payerId: string; orderId?: string; purpose: PaymentPurpose; amount: number; title: string; onDone?: (p: Payment) => void;
}) {
  const s = useStore();
  const wallet = shipperWallet(s, payerId).available;
  const sh = shipperOf(s, payerId);
  const creditOk = !!sh && sh.controls.creditTermsDays > 0 && purpose !== "topup" && sh.controls.creditLimit - bal(s, A.shipperCredit(payerId)) >= amount;
  const [method, setMethod] = useState<PaymentMethod>(purpose !== "topup" && wallet >= amount ? "wallet" : wallet > 0 && purpose !== "topup" ? "split" : "card");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>({ k: "choose" });
  const opts: { id: PaymentMethod; label: string; sub: string; icon: typeof Wallet; off?: string }[] = [
    ...(purpose !== "topup" ? [{ id: "wallet" as const, label: "کیف پول", sub: `موجودی ${toman(wallet)}`, icon: Wallet, off: wallet < amount ? "موجودی کافی نیست" : undefined }] : []),
    ...(purpose !== "topup" && wallet > 0 && wallet < amount ? [{ id: "split" as const, label: "کیف پول + کارت", sub: `${toman(wallet)} از کیف پول، ${toman(amount - wallet)} با کارت`, icon: CreditCard }] : []),
    { id: "card", label: "پرداخت اینترنتی (کارت بانکی)", sub: "درگاه امن بانکی", icon: CreditCard },
    { id: "card2card", label: "کارت‌به‌کارت", sub: "پس از بررسی رسید فعال می‌شود", icon: Receipt, off: sh?.controls.blockCardToCard ? "برای حساب شما غیرفعال است" : undefined },
    { id: "paya", label: "پایا / ساتنا", sub: "برای مبالغ بالا؛ پس از بررسی رسید", icon: Landmark },
    ...(creditOk ? [{ id: "credit" as const, label: "اعتبار سازمانی", sub: "پرداخت با فاکتور", icon: Receipt }] : []),
  ];
  const needsRef = method === "card2card" || method === "paya";
  const go = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, method === "card" || method === "split" ? 900 : 300));
    const r = act((st) => payEngine(st, { payerId, orderId, purpose, amount, method, refNo: ref }));
    setBusy(false);
    if (!r.ok) return toast(r.error, "err");
    setPhase({ k: "result", p: r.payment });
    if (r.payment.status === "SUCCEEDED") { toast("پرداخت با موفقیت انجام شد."); onDone?.(r.payment); }
  };
  const close = () => { setPhase({ k: "choose" }); onClose(); };

  return (
    <Sheet open={open} onClose={close} title={title}
      footer={phase.k === "choose" ? (
        <Button block size="lg" loading={busy} disabled={needsRef && ref.trim().length < 4} onClick={go}>پرداخت {toman(amount)}</Button>
      ) : phase.p.status === "FAILED" ? (
        <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={close}>بستن</Button><Button onClick={() => setPhase({ k: "choose" })}>تلاش دوباره</Button></div>
      ) : <Button block onClick={close}>بستن</Button>}>
      {phase.k === "choose" ? (
        <div className="space-y-4">
          <div className="rounded-ui bg-surface-2 p-4 text-center"><div className="text-sm text-ink-3">مبلغ قابل پرداخت</div><div className="mt-1 text-3xl font-black tabular">{toman(amount)}</div></div>
          <div role="radiogroup" aria-label="روش پرداخت" className="grid gap-2">
            {opts.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={method === o.id} disabled={!!o.off} onClick={() => setMethod(o.id)}
                className={cx("flex min-h-14 items-center gap-3 rounded-ui border-2 p-3 text-start transition disabled:opacity-50", method === o.id ? "border-act bg-act-soft" : "border-line bg-white")}>
                <o.icon className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0"><span className="block font-bold">{o.label}</span><span className="block text-xs text-ink-3">{o.off ?? o.sub}</span></span>
              </button>
            ))}
          </div>
          {needsRef && (
            <div className="space-y-3 rounded-ui border border-dashed border-line p-4 text-sm">
              <p className="leading-7">مبلغ را به کارت <b dir="ltr" className="tabular">{BANK_CARD}</b> (کامیونت) واریز کنید و شماره‌ی پیگیری را بنویسید. تیم مالی تا ۲ ساعت رسید را بررسی می‌کند.</p>
              <Field label="شماره‌ی پیگیری / رسید">{(id) => <Input id={id} dir="ltr" value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
            </div>
          )}
        </div>
      ) : (
        <Result p={phase.p} />
      )}
    </Sheet>
  );
}

function Result({ p }: { p: Payment }) {
  const ok = p.status === "SUCCEEDED";
  const wait = p.status === "PROCESSING" || p.status === "AWAITING_VERIFICATION";
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
      {ok ? <CheckCircle2 className="size-14 text-ok" aria-hidden /> : wait ? <Receipt className="size-14 text-warn" aria-hidden /> : <XCircle className="size-14 text-danger" aria-hidden />}
      <h3 className="text-xl font-black">{ok ? "پرداخت موفق" : wait ? "در انتظار تأیید" : "پرداخت انجام نشد"}</h3>
      <p className="max-w-xs text-sm leading-7 text-ink-3">
        {ok ? "مبلغ ثبت شد و سفارش شما به‌روز شد." : p.status === "PROCESSING" ? "نتیجه‌ی بانک هنوز نرسیده است. پس از دریافت، سفارش خودکار به‌روز می‌شود و نیازی به پرداخت دوباره نیست." : p.status === "AWAITING_VERIFICATION" ? "رسید شما ثبت شد؛ پس از تأیید تیم مالی، مبلغ اعمال می‌شود." : p.failReason}
      </p>
      {p.gatewayRef && <div className="text-xs text-ink-3">کد پیگیری: <span dir="ltr" className="tabular">{p.gatewayRef}</span></div>}
    </div>
  );
}
