"use client";

import { useMemo, useState } from "react";
import { Button, Card, Field, Input, NumInput, Select, Sheet, Tabs, Textarea, Toggle } from "../../ui";
import { toast } from "../../Toaster";
import { DataTable, type Col } from "../DataTable";
import { Kpi, PageHead, Panel, Pill, StatusPill, useAdmin } from "../kit";
import { BATCH_STATUS, CLAIM_STATUS, DEBT_STATUS, INVOICE_KIND, INVOICE_STATUS, PAYMENT_METHOD, PAYMENT_PURPOSE, PAYMENT_STATUS, PAYOUT_STATUS, REFUND_STATUS } from "@/lib/labels";
import { BarList, ShareBar, SERIES } from "../charts";
import { adjustWallet, ALL_PERMS, CEILINGS, guard, requestApproval } from "@/lib/engine/admin";
import { verifyReceipt } from "@/lib/engine/pay";
import { batchAction, bulkCoupons, createBatch, createRefund, payoutAction, requestWriteOff, upsertCoupon } from "@/lib/engine/payout";
import { attributeSuspense, buildReconFile, claimAction, dailyClose, lockPeriod, matchRecon, openClaim, parkInSuspense } from "@/lib/engine/finance";
import { DAY, person } from "@/lib/engine/core";
import { fa, jDate, jDateTime, toman, tomanWords } from "@/lib/format";
import { A, accountLabel, bal, checkInvariants, trialBalance } from "@/lib/ledger";
import { R } from "@/lib/money";
import { useStore } from "@/lib/store";
import type { Coupon, Debt, Invoice, Payout, Refund } from "@/lib/types";

const nm = (s: ReturnType<typeof useStore>, id?: string) => (id ? person(s, id)?.name ?? "—" : "—");
const needPerm = (has: (p: string) => boolean, p: string) => { if (!has(p)) { toast("نقش شما این اقدام را مجاز نمی‌کند.", "err"); return false; } return true; };

/* ───────────────────────── overview + ledger ───────────────────────── */

export function FinanceOverview() {
  const s = useStore();
  const [q, setQ] = useState("");
  const tb = useMemo(() => trialBalance(s), [s]);
  const bad = useMemo(() => checkInvariants(s), [s]);
  const sumBy = (f: (a: string) => boolean) => tb.filter((r) => f(r.account)).reduce((n, r) => n + r.debit - r.credit, 0);
  const rev = -sumBy((a) => a.startsWith("REV:"));
  const exp = sumBy((a) => a.startsWith("EXP:"));
  const shipperW = -sumBy((a) => a.startsWith("W:S:"));
  const driverW = -sumBy((a) => a.startsWith("W:D:"));
  const escrow = -sumBy((a) => a.startsWith("ESCROW:"));
  const ar = sumBy((a) => a.startsWith("AR:"));
  const rows = tb.filter((r) => !/^(W:|ESCROW:|AR:)/.test(r.account) || r.account.startsWith("AR:S:ZZ"));
  const grouped = useMemo(() => {
    const g = new Map<string, { debit: number; credit: number; n: number }>();
    for (const r of tb) {
      const k = /^(W:S:)/.test(r.account) ? "کیف پول صاحبان بار" : /^W:D:/.test(r.account) ? "کیف پول رانندگان" : /^ESCROW:/.test(r.account) ? "امانی سفارش‌ها" : /^AR:S:/.test(r.account) ? "بدهی صاحبان بار" : /^AR:SC:/.test(r.account) ? "اعتبار سازمانی" : /^AR:D:/.test(r.account) ? "بدهی رانندگان" : accountLabel(r.account);
      const c = g.get(k) ?? { debit: 0, credit: 0, n: 0 };
      c.debit += r.debit; c.credit += r.credit; c.n++;
      g.set(k, c);
    }
    return [...g.entries()].map(([k, v]) => ({ k, ...v })).filter((x) => !q || x.k.includes(q));
  }, [tb, q]);
  void rows;
  return (
    <div>
      <PageHead title="مرور مالی" sub="تراز آزمایشی، سلامت دفتر کل و وضعیت بدهی‌ها و تعهدات" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi label="درآمد کارمزد و خدمات" value={tomanWords(rev)} tone="ok" />
        <Kpi label="هزینه‌ها (تخفیف، بازپرداخت، تعدیل)" value={tomanWords(exp)} />
        <Kpi label="کیف پول صاحبان بار" value={tomanWords(shipperW)} sub="تعهد قابل استرداد" />
        <Kpi label="کیف پول رانندگان" value={tomanWords(driverW)} />
        <Kpi label="امانی سفارش‌های جاری" value={tomanWords(escrow)} />
        <Kpi label="مطالبات (بدهی‌ها)" value={tomanWords(ar)} tone={ar > 0 ? "warn" : undefined} />
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Panel title="سلامت دفتر کل" className="lg:col-span-1">
          {bad.length === 0 ? <div className="flex items-center gap-2 font-bold text-ok">همه‌ی ۳ قید برقرار است</div> : <ul className="space-y-1 text-sm text-danger">{bad.slice(0, 6).map((b) => <li key={b}>{b}</li>)}</ul>}
          <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
            <li>مجموع ثبت‌ها صفر است (بدهکار = بستانکار)</li>
            <li>هر تراکنش به‌تنهایی متوازن است</li>
            <li>مبالغ صحیح (ریال) و بدون اعشار؛ هیچ کیف پولی منفی نیست</li>
          </ul>
          <div className="mt-3 text-xs text-ink-3">{fa(s.ledger.length)} ثبت · {fa(new Set(s.ledger.map((e) => e.txId)).size)} تراکنش</div>
        </Panel>
        <Panel title="ترکیب تعهدات و دارایی‌ها" className="lg:col-span-2">
          <ShareBar parts={[{ label: "کیف پول صاحبان بار", value: shipperW, color: SERIES[0] }, { label: "کیف پول رانندگان", value: driverW, color: SERIES[1] }, { label: "امانی", value: escrow, color: SERIES[2] }]} />
          <div className="mt-4"><BarList fmt={toman} rows={[{ label: "درگاه (انتظار تسویه)", value: Math.abs(bal(s, A.GATEWAY)) }, { label: "بانک", value: Math.abs(bal(s, A.BANK)) }, { label: "حساب معلق", value: Math.abs(bal(s, A.SUSPENSE)) }, { label: "بدهی به بیمه‌گر", value: Math.abs(bal(s, A.INS_PAYABLE)) }]} /></div>
        </Panel>
      </div>
      <Panel title="تراز آزمایشی" action={<Input aria-label="جستجوی حساب" placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-44" />}>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead><tr className="text-start text-xs text-ink-3"><th className="py-2 text-start">حساب</th><th className="text-end">بدهکار</th><th className="text-end">بستانکار</th><th className="text-end">تعداد</th></tr></thead>
          <tbody className="divide-y divide-line/70">{grouped.map((r) => <tr key={r.k}><td className="py-2 font-bold">{r.k}</td><td className="tabular text-end">{r.debit ? toman(r.debit) : "—"}</td><td className="tabular text-end">{r.credit ? toman(r.credit) : "—"}</td><td className="tabular text-end text-ink-3">{fa(r.n)}</td></tr>)}</tbody>
          <tfoot><tr className="border-t-2 border-ink/20 font-black"><td className="py-2">جمع</td><td className="tabular text-end">{toman(tb.reduce((n, r) => n + r.debit, 0))}</td><td className="tabular text-end">{toman(tb.reduce((n, r) => n + r.credit, 0))}</td><td /></tr></tfoot></table></div>
      </Panel>
      <JournalForm />
    </div>
  );
}

function JournalForm() {
  const s = useStore();
  const { run, has, admin } = useAdmin();
  const [kind, setKind] = useState<"adjust" | "journal">("adjust");
  const [pid, setPid] = useState("");
  const [amt, setAmt] = useState(0);
  const [reason, setReason] = useState("");
  if (!has("finance.adjust")) return null;
  const people = [...s.shippers.slice(0, 60).map((x) => ({ id: x.personId, portal: "shipper" as const })), ...s.drivers.slice(0, 60).map((x) => ({ id: x.personId, portal: "driver" as const }))];
  return (
    <Panel title="تعدیل دستی کیف پول" className="mt-5">
      <p className="mb-3 text-xs text-ink-3">سقف تأیید مستقیم نقش شما {CEILINGS[admin.role].adjust === Infinity ? "نامحدود" : toman(CEILINGS[admin.role].adjust)}؛ بیش از آن به تأیید نفر دوم می‌رود.</p>
      <Segment value={kind} onChange={setKind} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="کاربر">{(id) => <Select id={id} value={pid} onChange={(e) => setPid(e.target.value)}><option value="">انتخاب…</option>{people.map((p) => <option key={p.id} value={p.id}>{nm(s, p.id)} · {p.portal === "driver" ? "راننده" : "صاحب بار"}</option>)}</Select>}</Field>
        <Field label="مبلغ (تومان، منفی = کسر)">{(id) => <NumInput id={id} value={amt} onChange={(v) => setAmt(v ?? 0)} allowDecimal={false} />}</Field>
        <Field label="دلیل (الزامی)">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </div>
      <Button className="mt-3" onClick={() => { const p = people.find((x) => x.id === pid); if (!p) return toast("کاربر را انتخاب کنید.", "err"); const r = run((x, a) => adjustWallet(x, a, p.id, p.portal, R(amt), reason)); if (r.ok) toast(r.pending ? "برای تأیید نفر دوم ارسال شد." : "اعمال شد."); }}>ثبت تعدیل</Button>
    </Panel>
  );
}

function Segment({ value, onChange }: { value: "adjust" | "journal"; onChange: (v: "adjust" | "journal") => void }) {
  void value; void onChange;
  return null;
}

/* ───────────────────────── payments + receipts ───────────────────────── */

export function PaymentsModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const [tab, setTab] = useState<"pay" | "rc">("rc");
  const [sel, setSel] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const pending = s.receipts.filter((r) => r.status === "PENDING");
  const rc = s.receipts.find((r) => r.id === sel);
  const cols: Col<(typeof s.payments)[number]>[] = [
    { id: "at", label: "زمان", cell: (p) => jDateTime(p.at), value: (p) => p.at },
    { id: "who", label: "پرداخت‌کننده", cell: (p) => nm(s, p.payerId), value: (p) => nm(s, p.payerId) },
    { id: "order", label: "سفارش", cell: (p) => p.orderId ?? "—", value: (p) => p.orderId },
    { id: "purpose", label: "بابت", cell: (p) => PAYMENT_PURPOSE[p.purpose] ?? p.purpose, value: (p) => PAYMENT_PURPOSE[p.purpose] },
    { id: "method", label: "روش", cell: (p) => PAYMENT_METHOD[p.method] ?? p.method, value: (p) => PAYMENT_METHOD[p.method] },
    { id: "amount", label: "مبلغ", cell: (p) => toman(p.amount), value: (p) => p.amount / 10, num: true },
    { id: "rrn", label: "RRN", cell: (p) => <span className="tabular text-xs">{p.trail?.rrn ?? "—"}</span>, value: (p) => p.trail?.rrn, hidden: true },
    { id: "status", label: "وضعیت", cell: (p) => <span className="inline-flex items-center gap-1"><StatusPill map={PAYMENT_STATUS} v={p.status} />{p.deducted && <Pill tone="danger">کسر‌شده از حساب</Pill>}</span>, value: (p) => PAYMENT_STATUS[p.status]?.[0] },
  ];
  return (
    <div>
      <PageHead title="پرداخت‌ها و رسیدها" sub="رسیدهای کارت‌به‌کارت در انتظار تأیید و دفتر تراکنش‌های درگاه" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "rc", label: "رسیدهای در انتظار", count: pending.length }, { id: "pay", label: "همه‌ی پرداخت‌ها" }]} className="mb-4" />
      {tab === "rc" ? (
        <Card className="divide-y divide-line/70">{pending.length === 0 && <div className="p-6 text-sm text-ink-3">رسید در انتظاری نیست.</div>}
          {pending.map((r) => <button key={r.id} onClick={() => { setSel(r.id); setReason(""); }} className="flex w-full items-center justify-between gap-3 p-4 text-start hover:bg-surface-2"><div><div className="font-bold">{nm(s, r.payerId)} · {toman(r.amount)}</div><div className="text-xs text-ink-3">{r.kind === "paya" ? "پایا" : "کارت‌به‌کارت"} · شماره‌ی پیگیری {r.refNo} · {jDateTime(r.at)}</div></div><Pill tone={r.slaDueAt < Date.now() ? "danger" : "warn"}>مهلت {jDateTime(r.slaDueAt)}</Pill></button>)}
        </Card>
      ) : <DataTable id="payments" rows={s.payments} rowKey={(p) => p.id} cols={cols} search={(p) => `${nm(s, p.payerId)} ${p.orderId ?? ""} ${p.trail?.rrn ?? ""}`} filters={[{ id: "st", label: "وضعیت", options: Object.entries(PAYMENT_STATUS).map(([id, [label]]) => ({ id, label })), test: (p, v) => p.status === v }]} />}
      {rc && (
        <Sheet open onClose={() => setSel(null)} title="بررسی رسید" footer={has("finance.receipts") ? <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => { if (!reason.trim()) return toast("دلیل رد را بنویسید.", "err"); const r = run((x, a) => { const g = guard(x, a, "finance.receipts"); return g.ok ? verifyReceipt(x, rc.id, false, g.admin.name, reason) : g; }, "رد شد"); if (r.ok) setSel(null); }}>رد رسید</Button><Button onClick={() => { const r = run((x, a) => { const g = guard(x, a, "finance.receipts"); return g.ok ? verifyReceipt(x, rc.id, true, g.admin.name) : g; }, "تأیید شد و کیف پول شارژ شد"); if (r.ok) setSel(null); }}>تأیید و شارژ</Button></div> : <p className="text-xs text-ink-3">فقط‌خواندنی</p>}>
          <div className="space-y-3 text-sm"><div className="rounded-2xl bg-surface-2 p-4"><div className="text-xs text-ink-3">مبلغ</div><div className="text-2xl font-black">{toman(rc.amount)}</div></div>
            <div className="grid gap-1"><div>پرداخت‌کننده: <b>{nm(s, rc.payerId)}</b></div><div>شماره‌ی پیگیری: <b className="tabular">{rc.refNo}</b></div><div>ثبت: {jDateTime(rc.at)}</div></div>
            {rc.image ? <img src={rc.image} alt="تصویر رسید" className="max-h-72 rounded-2xl" /> : <p className="text-ink-3">تصویری ضمیمه نشده است؛ شماره‌ی پیگیری را با صورت‌حساب بانک تطبیق دهید.</p>}
            <Field label="دلیل رد (در صورت رد)">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field></div>
        </Sheet>
      )}
    </div>
  );
}

/* ───────────────────────── payouts + batches ───────────────────────── */

export function PayoutsModule() {
  const s = useStore();
  const { run, has, admin } = useAdmin();
  const [tab, setTab] = useState<"q" | "b">("q");
  const cols: Col<Payout>[] = [
    { id: "at", label: "درخواست", cell: (p) => jDateTime(p.at), value: (p) => p.at },
    { id: "d", label: "راننده", cell: (p) => nm(s, p.driverId), value: (p) => nm(s, p.driverId) },
    { id: "amt", label: "مبلغ", cell: (p) => toman(p.amount), value: (p) => p.amount / 10, num: true },
    { id: "fee", label: "کارمزد", cell: (p) => (p.fee ? toman(p.fee) : "—"), value: (p) => p.fee / 10, num: true },
    { id: "inst", label: "نوع", cell: (p) => (p.instant ? "آنی" : "عادی"), value: (p) => (p.instant ? "آنی" : "عادی") },
    { id: "flags", label: "هشدار", cell: (p) => (p.flags.length ? <Pill tone="warn">{p.flags.join("، ")}</Pill> : "—"), value: (p) => p.flags.join(",") },
    { id: "st", label: "وضعیت", cell: (p) => <StatusPill map={PAYOUT_STATUS} v={p.status} />, value: (p) => PAYOUT_STATUS[p.status][0] },
  ];
  const act = (ids: string[], a: "approve" | "hold" | "release" | "send" | "settle" | "fail") => {
    if (!needPerm(has, "finance.payouts")) return;
    for (const id of ids) {
      const p = s.payouts.find((x) => x.id === id);
      if (a === "approve" && p && p.amount > CEILINGS[admin.role].payout) { run((x, ad) => { const g = guard(x, ad, "finance.payouts"); if (!g.ok) return g; requestApproval(x, g.actor, { action: "payout", title: `برداشت ${toman(p.amount)} برای ${nm(x, p.driverId)}`, amount: p.amount, payload: { payoutId: p.id } }); return { ok: true as const }; }, "برای تأیید نفر دوم ارسال شد"); continue; }
      run((x, ad) => { const g = guard(x, ad, "finance.payouts"); return g.ok ? payoutAction(x, g.actor, id, a) : g; });
    }
  };
  return (
    <div>
      <PageHead title="برداشت‌ها" sub="صف تأیید، نگه‌داشتن، دسته‌ی بانکی و تطبیق نتیجه" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "q", label: "صف برداشت", count: s.payouts.filter((p) => ["REQUESTED", "UNDER_REVIEW", "APPROVED"].includes(p.status)).length }, { id: "b", label: "دسته‌های بانکی", count: s.batches.length }]} className="mb-4" />
      {tab === "q" ? (
        <DataTable id="payouts" rows={s.payouts} rowKey={(p) => p.id} cols={cols} search={(p) => nm(s, p.driverId)}
          filters={[{ id: "st", label: "وضعیت", options: Object.entries(PAYOUT_STATUS).map(([id, [label]]) => ({ id, label })), test: (p, v) => p.status === v }]}
          bulk={[{ label: "تأیید", run: (ids) => act(ids, "approve") }, { label: "نگه‌داشتن", run: (ids) => act(ids, "hold") }, { label: "ایجاد دسته", run: (ids) => { if (!needPerm(has, "finance.payouts")) return; const r = run((x, a) => { const g = guard(x, a, "finance.payouts"); return g.ok ? createBatch(x, g.actor, ids) : g; }, "دسته ساخته شد"); void r; } }]} />
      ) : (
        <div className="space-y-3">{s.batches.length === 0 && <Card className="p-6 text-sm text-ink-3">دسته‌ای نیست. از صف، برداشت‌های تأییدشده را انتخاب و «ایجاد دسته» را بزنید.</Card>}
          {s.batches.map((b) => { const items = s.payouts.filter((p) => b.payoutIds.includes(p.id)); const total = items.reduce((n, p) => n + p.amount - p.fee, 0); const next = ({ DRAFT: "approve", APPROVED: "export", EXPORTED: "send", SENT: "reconcile" } as Record<string, string>)[b.status] as "approve" | "export" | "send" | "reconcile" | undefined; const nextL = { approve: "تأیید دسته", export: "خروجی فایل بانک", send: "ارسال به بانک", reconcile: "تطبیق نتیجه (همه موفق)" };
            return <Card key={b.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-bold">دسته {b.id} · {fa(items.length)} برداشت · {toman(total)}</div><div className="text-xs text-ink-3">{jDateTime(b.at)} · ایجاد: {b.createdBy}{b.approvedBy ? ` · تأیید: ${b.approvedBy}` : ""}</div></div><div className="flex items-center gap-2"><StatusPill map={BATCH_STATUS} v={b.status} />{next && <Button size="sm" onClick={() => { if (!needPerm(has, "finance.payouts")) return; if (next === "approve" && b.createdBy.includes(admin.name)) return toast("سازنده‌ی دسته نمی‌تواند خودش آن را تأیید کند (تأیید دو نفره).", "err"); run((x, a) => { const g = guard(x, a, "finance.payouts"); return g.ok ? batchAction(x, g.actor, b.id, next) : g; }, "انجام شد"); }}>{nextL[next]}</Button>}</div></div></Card>; })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── refunds + debts ───────────────────────── */

export function RefundsModule() {
  const s = useStore();
  const { run, has, admin } = useAdmin();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ payer: "", amount: 0, to: "wallet" as "wallet" | "card", reason: "" });
  const cols: Col<Refund>[] = [
    { id: "at", label: "زمان", cell: (r) => jDateTime(r.at), value: (r) => r.at },
    { id: "p", label: "کاربر", cell: (r) => nm(s, r.payerId), value: (r) => nm(s, r.payerId) },
    { id: "o", label: "سفارش", cell: (r) => r.orderId ?? "—", value: (r) => r.orderId },
    { id: "a", label: "مبلغ", cell: (r) => toman(r.amount), value: (r) => r.amount / 10, num: true },
    { id: "to", label: "مقصد", cell: (r) => (r.to === "card" ? "کارت" : "کیف پول"), value: (r) => r.to },
    { id: "r", label: "دلیل", cell: (r) => r.reason, value: (r) => r.reason },
    { id: "st", label: "وضعیت", cell: (r) => <StatusPill map={REFUND_STATUS} v={r.status} />, value: (r) => REFUND_STATUS[r.status][0] },
  ];
  return (
    <div>
      <PageHead title="بازپرداخت‌ها" sub="ثبت و پیگیری؛ مبلغ‌های بالاتر از سقف نقش به تأیید نفر دوم می‌رود" actions={has("finance.refunds") && <Button onClick={() => setOpen(true)}>بازپرداخت جدید</Button>} />
      <DataTable id="refunds" rows={s.refunds} rowKey={(r) => r.id} cols={cols} search={(r) => `${nm(s, r.payerId)} ${r.reason}`} />
      {open && <Sheet open onClose={() => setOpen(false)} title="بازپرداخت جدید" footer={<Button block onClick={() => { if (!f.payer || !f.reason.trim() || f.amount <= 0) return toast("کاربر، مبلغ و دلیل را کامل کنید.", "err"); const r = run((x, a) => { const g = guard(x, a, "finance.refunds"); return g.ok ? createRefund(x, g.actor, { payerId: f.payer, amount: R(f.amount), to: f.to, reason: f.reason }, CEILINGS[g.admin.role].refund) : g; }); if (r.ok) { toast(r.pending ? "برای تأیید نفر دوم ارسال شد." : "پرداخت شد."); setOpen(false); } }}>ثبت</Button>}>
        <div className="space-y-3"><p className="text-xs text-ink-3">سقف تأیید مستقیم نقش «{admin.role}»: {CEILINGS[admin.role].refund === Infinity ? "نامحدود" : toman(CEILINGS[admin.role].refund)}</p>
          <Field label="صاحب بار">{(id) => <Select id={id} value={f.payer} onChange={(e) => setF({ ...f, payer: e.target.value })}><option value="">انتخاب…</option>{s.shippers.slice(0, 120).map((x) => <option key={x.personId} value={x.personId}>{nm(s, x.personId)}</option>)}</Select>}</Field>
          <Field label="مبلغ (تومان)">{(id) => <NumInput id={id} value={f.amount} onChange={(v) => setF({ ...f, amount: v ?? 0 })} allowDecimal={false} />}</Field>
          <Field label="مقصد">{(id) => <Select id={id} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value as "wallet" | "card" })}><option value="wallet">کیف پول</option><option value="card">کارت (۳ روز کاری)</option></Select>}</Field>
          <Field label="دلیل">{(id) => <Textarea id={id} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />}</Field></div></Sheet>}
    </div>
  );
}

const STAGES = ["کسر خودکار از درآمد", "یادآوری", "شارژ اجباری", "ارجاع به پیگیری", "تعلیق", "سوخت‌شدن"];

export function DebtsModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const cols: Col<Debt>[] = [
    { id: "d", label: "راننده", cell: (d) => nm(s, d.driverId), value: (d) => nm(s, d.driverId) },
    { id: "o", label: "سفارش", cell: (d) => d.orderId ?? "—", value: (d) => d.orderId },
    { id: "a", label: "اصل", cell: (d) => toman(d.amount), value: (d) => d.amount / 10, num: true },
    { id: "r", label: "مانده", cell: (d) => toman(d.remaining), value: (d) => d.remaining / 10, num: true },
    { id: "age", label: "سن بدهی", cell: (d) => `${fa(Math.floor((Date.now() - d.at) / DAY))} روز`, value: (d) => d.at },
    { id: "st", label: "پله‌ی وصول", cell: (d) => <Pill tone={d.stage >= 4 ? "danger" : d.stage >= 2 ? "warn" : "neutral"}>{STAGES[d.stage]}</Pill>, value: (d) => d.stage },
    { id: "s", label: "وضعیت", cell: (d) => <StatusPill map={DEBT_STATUS} v={d.status} />, value: (d) => DEBT_STATUS[d.status][0] },
    { id: "act", label: "", cell: (d) => has("finance.debt") && d.status === "OPEN" ? <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); run((x, a) => { const g = guard(x, a, "finance.debt"); return g.ok ? requestWriteOff(x, g.actor, d.id) : g; }, "درخواست سوخت‌کردن برای تأیید ارسال شد"); }}>سوخت‌کردن</Button> : null },
  ];
  const open = s.debts.filter((d) => d.status === "OPEN");
  return (
    <div>
      <PageHead title="بدهی کارمزد رانندگان" sub="نردبان وصول: کسر خودکار ← یادآوری ← شارژ اجباری ← پیگیری ← تعلیق ← سوخت‌شدن (با تأیید نفر دوم)" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Kpi label="بدهی باز" value={toman(open.reduce((n, d) => n + d.remaining, 0))} tone="warn" /><Kpi label="تعداد پرونده" value={fa(open.length)} /><Kpi label="پله‌ی ۴ و بالاتر" value={fa(open.filter((d) => d.stage >= 4).length)} tone="danger" /><Kpi label="سوخت‌شده" value={toman(s.debts.filter((d) => d.status === "WRITTEN_OFF").reduce((n, d) => n + d.amount, 0))} /></div>
      <DataTable id="debts" rows={s.debts} rowKey={(d) => d.id} cols={cols} search={(d) => nm(s, d.driverId)} filters={[{ id: "st", label: "وضعیت", options: Object.entries(DEBT_STATUS).map(([id, [label]]) => ({ id, label })), test: (d, v) => d.status === v }]} />
    </div>
  );
}

/* ───────────────────────── invoices + aging ───────────────────────── */

export function InvoicesModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const od = s.invoices.filter((i) => i.status === "OVERDUE");
  const aging = [0, 1, 2, 3].map((k) => od.filter((i) => { const d = (Date.now() - (i.dueAt ?? i.at)) / DAY; return k === 0 ? d < 30 : k === 1 ? d < 60 : k === 2 ? d < 90 : d >= 90; }));
  const cols: Col<Invoice>[] = [
    { id: "no", label: "شماره", cell: (i) => i.no, value: (i) => i.no },
    { id: "k", label: "نوع", cell: (i) => INVOICE_KIND[i.kind] ?? i.kind, value: (i) => INVOICE_KIND[i.kind] },
    { id: "p", label: "طرف حساب", cell: (i) => nm(s, i.partyId), value: (i) => nm(s, i.partyId) },
    { id: "a", label: "مبلغ", cell: (i) => toman(i.amount), value: (i) => i.amount / 10, num: true },
    { id: "at", label: "صدور", cell: (i) => jDate(i.at), value: (i) => i.at },
    { id: "due", label: "سررسید", cell: (i) => (i.dueAt ? jDate(i.dueAt) : "—"), value: (i) => i.dueAt },
    { id: "st", label: "وضعیت", cell: (i) => <StatusPill map={INVOICE_STATUS} v={i.status} />, value: (i) => INVOICE_STATUS[i.status][0] },
    { id: "dun", label: "یادآوری", cell: (i) => fa(i.dunning.length), value: (i) => i.dunning.length, num: true },
    { id: "act", label: "", cell: (i) => has("finance.credit") && i.status === "OVERDUE" ? <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); run((x, a) => { const g = guard(x, a, "finance.credit"); if (!g.ok) return g; const inv = x.invoices.find((y) => y.id === i.id); inv?.dunning.push({ at: Date.now(), channel: "sms" }); return { ok: true as const }; }, "یادآوری پیامکی ارسال شد"); }}>یادآوری</Button> : null },
  ];
  return (
    <div>
      <PageHead title="فاکتورها و مطالبات" sub="سن مطالبات سررسیدگذشته و یادآوری" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">{["۰ تا ۳۰ روز", "۳۰ تا ۶۰ روز", "۶۰ تا ۹۰ روز", "بیش از ۹۰ روز"].map((l, i) => <Kpi key={l} label={l} value={toman(aging[i].reduce((n, x) => n + x.amount, 0))} sub={`${fa(aging[i].length)} فاکتور`} tone={i >= 2 && aging[i].length ? "danger" : undefined} />)}</div>
      <DataTable id="invoices" rows={s.invoices} rowKey={(i) => i.id} cols={cols} search={(i) => `${i.no} ${nm(s, i.partyId)}`} filters={[{ id: "st", label: "وضعیت", options: Object.entries(INVOICE_STATUS).map(([id, [label]]) => ({ id, label })), test: (i, v) => i.status === v }]} />
    </div>
  );
}

/* ───────────────────────── reconciliation + close ───────────────────────── */

export function ReconModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const [fid, setFid] = useState<string | null>(null);
  const [attr, setAttr] = useState<{ ref: string; to: string } | null>(null);
  const f = s.recon.find((x) => x.id === fid);
  const day = new Date(Date.now()).setHours(0, 0, 0, 0);
  const ok = has("finance.recon");
  return (
    <div>
      <PageHead title="مغایرت‌گیری و بستن روز" sub="تطبیق فایل درگاه/بانک با دفتر کل، حساب معلق، بستن روز و قفل دوره" actions={ok && <><Button variant="secondary" onClick={() => run((x) => { const file = buildReconFile(x, "gateway", Date.now() - 30 * DAY, Date.now()); x.recon.unshift(file); matchRecon(x, file.id); return { ok: true as const }; }, "فایل درگاه تولید و تطبیق داده شد")}>فایل تسویه‌ی درگاه</Button><Button variant="secondary" onClick={() => run((x) => { const file = buildReconFile(x, "bank", Date.now() - 30 * DAY, Date.now()); x.recon.unshift(file); matchRecon(x, file.id); return { ok: true as const }; }, "صورت‌حساب بانک تولید و تطبیق داده شد")}>صورت‌حساب بانک</Button></>} />
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel title="فایل‌های تطبیق">{s.recon.length === 0 && <p className="text-sm text-ink-3">فایلی نیست.</p>}<ul className="divide-y divide-line/70">{s.recon.map((r) => { const un = r.rows.filter((x) => !x.matched).length; return <li key={r.id}><button onClick={() => setFid(r.id)} className="flex w-full items-center justify-between gap-3 py-3 text-start hover:bg-surface-2"><span><span className="block font-bold">{r.name}</span><span className="text-xs text-ink-3">{fa(r.rows.length)} ردیف · {jDateTime(r.at)}</span></span><Pill tone={un ? "warn" : "ok"}>{un ? `${fa(un)} مغایرت` : "منطبق"}</Pill></button></li>; })}</ul></Panel>
        <Panel title="بستن روز و قفل دوره" action={ok && <Button size="sm" onClick={() => run((x, a) => { const g = guard(x, a, "finance.recon"); return g.ok ? dailyClose(x, g.actor, day) : g; }, "روز بسته شد")}>بستن امروز</Button>}>
          <p className="mb-2 text-xs text-ink-3">قفل دوره: {s.periodLockedUntil ? `تا ${jDate(s.periodLockedUntil)}` : "بدون قفل"}</p>
          {ok && <Button size="sm" variant="secondary" className="mb-3" onClick={() => run((x, a) => { const g = guard(x, a, "finance.recon"); return g.ok ? lockPeriod(x, g.actor, day - DAY) : g; }, "دوره تا دیروز قفل شد")}>قفل تا دیروز</Button>}
          <ul className="divide-y divide-line/70">{s.closes.slice(0, 8).map((c) => <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm"><span>{jDate(c.day)} · {c.by}</span><Pill tone={c.ok ? "ok" : "danger"}>{c.ok ? "تراز" : "نامتراز"}{c.unmatched ? ` · ${fa(c.unmatched)} مغایرت` : ""}</Pill></li>)}</ul></Panel>
      </div>
      {f && <Sheet open onClose={() => setFid(null)} title={f.name} wide>
        <ul className="divide-y divide-line/70 text-sm">{f.rows.map((r) => <li key={r.ref} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><div><div className="tabular font-bold">{r.ref}</div><div className="text-xs text-ink-3">{toman(r.amount)}{r.note ? ` · ${r.note}` : ""}</div></div>{r.matched && r.note !== "در حساب معلق" ? <Pill tone="ok">منطبق</Pill> : r.note === "در حساب معلق" ? ok && <Button size="sm" variant="secondary" onClick={() => setAttr({ ref: r.ref, to: "" })}>انتساب</Button> : ok && <Button size="sm" variant="secondary" onClick={() => run((x, a) => { const g = guard(x, a, "finance.recon"); return g.ok ? parkInSuspense(x, g.actor, f.id, r.ref) : g; }, "به حساب معلق منتقل شد")}>انتقال به معلق</Button>}</li>)}</ul>
        {attr && <div className="mt-4 space-y-2 rounded-2xl bg-surface-2 p-4"><Field label="انتساب به صاحب بار">{(id) => <Select id={id} value={attr.to} onChange={(e) => setAttr({ ...attr, to: e.target.value })}><option value="">انتخاب…</option>{s.shippers.slice(0, 120).map((x) => <option key={x.personId} value={x.personId}>{nm(s, x.personId)}</option>)}</Select>}</Field><Button size="sm" onClick={() => { if (!attr.to) return; const r = run((x, a) => { const g = guard(x, a, "finance.recon"); return g.ok ? attributeSuspense(x, g.actor, f.id, attr.ref, attr.to) : g; }, "منتسب شد"); if (r.ok) setAttr(null); }}>ثبت انتساب</Button></div>}
      </Sheet>}
    </div>
  );
}

/* ───────────────────────── promotions ───────────────────────── */

export function PromoModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const [open, setOpen] = useState(false);
  const [c, setC] = useState({ code: "", title: "", kind: "PCT" as "PCT" | "FIXED", value: 10, maxDiscount: 0, minOrder: 0, firstOrderOnly: false, total: 100, perUser: 1 });
  const can = has("finance.promo");
  const cols: Col<Coupon>[] = [
    { id: "code", label: "کد", cell: (x) => <b className="tabular">{x.code}</b>, value: (x) => x.code },
    { id: "t", label: "عنوان", cell: (x) => x.title, value: (x) => x.title },
    { id: "v", label: "مقدار", cell: (x) => (x.kind === "PCT" ? `${fa(x.value)}٪` : toman(R(x.value))), value: (x) => x.value },
    { id: "u", label: "استفاده", cell: (x) => `${fa(x.redemptions.length)} / ${fa(x.totalLimit)}`, value: (x) => x.redemptions.length, num: true },
    { id: "cost", label: "هزینه‌ی کمپین", cell: (x) => toman(x.redemptions.reduce((n, r) => n + r.amount, 0)), value: (x) => x.redemptions.reduce((n, r) => n + r.amount, 0) / 10, num: true },
    { id: "end", label: "پایان", cell: (x) => jDate(x.end), value: (x) => x.end },
    { id: "st", label: "وضعیت", cell: (x) => <Pill tone={x.paused ? "warn" : x.end < Date.now() ? "neutral" : "ok"}>{x.paused ? "متوقف" : x.end < Date.now() ? "پایان‌یافته" : "فعال"}</Pill>, value: (x) => (x.paused ? "paused" : "active") },
    { id: "act", label: "", cell: (x) => can ? <Toggle label={`فعال‌بودن ${x.code}`} checked={!x.paused} onChange={() => run((st, a) => { const g = guard(st, a, "finance.promo"); if (!g.ok) return g; upsertCoupon(st, g.actor, { ...x, paused: !x.paused }); return { ok: true as const }; })} /> : null },
  ];
  return (
    <div>
      <PageHead title="کد تخفیف و مشوق‌ها" sub="تخفیف از جیب پلتفرم است و هرگز از سهم راننده کم نمی‌شود" actions={can && <><Button variant="secondary" onClick={() => run((st, a) => { const g = guard(st, a, "finance.promo"); if (!g.ok) return g; bulkCoupons(st, g.actor, "KAM", 10, { title: "کد گروهی", kind: "PCT", value: 10, maxDiscount: R(300_000), firstOrderOnly: false, start: Date.now(), end: Date.now() + 30 * DAY, totalLimit: 1, perUser: 1, stackable: false, fundedBy: "platform", auto: false, paused: false, segment: "all" }); return { ok: true as const }; }, "۱۰ کد یکبارمصرف ساخته شد")}>ساخت ۱۰ کد گروهی</Button><Button onClick={() => setOpen(true)}>کد جدید</Button></>} />
      <DataTable id="coupons" rows={s.coupons} rowKey={(x) => x.code} cols={cols} search={(x) => `${x.code} ${x.title}`} />
      <Panel title="مشوق‌های رانندگان" className="mt-5"><ul className="divide-y divide-line/70 text-sm">{s.incentives.map((i) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><div><b>{i.title}</b><div className="text-xs text-ink-3">{i.desc}</div></div><div className="text-end"><div>پاداش {toman(i.reward)}</div><div className="text-xs text-ink-3">بودجه {toman(i.spent)} / {toman(i.budget)}</div></div></li>)}</ul></Panel>
      {open && <Sheet open onClose={() => setOpen(false)} title="کد تخفیف جدید" footer={<Button block onClick={() => { if (!c.code.trim() || !c.title.trim()) return toast("کد و عنوان الزامی است.", "err"); const r = run((st, a) => { const g = guard(st, a, "finance.promo"); if (!g.ok) return g; upsertCoupon(st, g.actor, { code: c.code, title: c.title, kind: c.kind, value: c.value, maxDiscount: c.maxDiscount ? R(c.maxDiscount) : undefined, minOrder: c.minOrder ? R(c.minOrder) : undefined, firstOrderOnly: c.firstOrderOnly, start: Date.now(), end: Date.now() + 30 * DAY, totalLimit: c.total, perUser: c.perUser, stackable: false, fundedBy: "platform", auto: false, paused: false, segment: "all" }); return { ok: true as const }; }, "ذخیره شد"); if (r.ok) setOpen(false); }}>ذخیره</Button>}>
        <div className="space-y-3"><Field label="کد">{(id) => <Input id={id} value={c.code} onChange={(e) => setC({ ...c, code: e.target.value })} dir="ltr" />}</Field><Field label="عنوان">{(id) => <Input id={id} value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} />}</Field>
          <Field label="نوع">{(id) => <Select id={id} value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value as "PCT" | "FIXED" })}><option value="PCT">درصدی</option><option value="FIXED">مبلغ ثابت (تومان)</option></Select>}</Field>
          <Field label="مقدار">{(id) => <NumInput id={id} value={c.value} onChange={(v) => setC({ ...c, value: v ?? 0 })} allowDecimal={false} />}</Field>
          <Field label="سقف تخفیف (تومان، اختیاری)">{(id) => <NumInput id={id} value={c.maxDiscount} onChange={(v) => setC({ ...c, maxDiscount: v ?? 0 })} allowDecimal={false} />}</Field>
          <Field label="حداقل سفارش (تومان)">{(id) => <NumInput id={id} value={c.minOrder} onChange={(v) => setC({ ...c, minOrder: v ?? 0 })} allowDecimal={false} />}</Field>
          <Field label="سقف کل استفاده">{(id) => <NumInput id={id} value={c.total} onChange={(v) => setC({ ...c, total: v ?? 0 })} allowDecimal={false} />}</Field>
          <Toggle label="فقط سفارش اول" checked={c.firstOrderOnly} onChange={(v) => setC({ ...c, firstOrderOnly: v ?? 0 })} /></div></Sheet>}
    </div>
  );
}

/* ───────────────────────── insurance claims ───────────────────────── */

export function ClaimsModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const [o, setO] = useState({ orderId: "", amount: 0, reason: "" });
  const next: Record<string, "REVIEW" | "APPROVED" | "PAID" | undefined> = { OPEN: "REVIEW", REVIEW: "APPROVED", APPROVED: "PAID" };
  const lbl = { REVIEW: "شروع بررسی", APPROVED: "تأیید خسارت", PAID: "ثبت پرداخت" };
  void ALL_PERMS;
  return (
    <div>
      <PageHead title="بیمه و خسارت" sub="پرونده‌های خسارت، محصولات بیمه و تسویه با بیمه‌گر" />
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel title="پرونده‌های خسارت"><ul className="divide-y divide-line/70">{s.claims.length === 0 && <li className="py-3 text-sm text-ink-3">پرونده‌ای نیست.</li>}{s.claims.map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><b>{c.orderId}</b> · {toman(c.amount)}<div className="text-xs text-ink-3">{c.reason} · {jDate(c.at)}</div></div><div className="flex items-center gap-2"><StatusPill map={CLAIM_STATUS} v={c.status} />{has("insurance") && next[c.status] && <Button size="sm" variant="secondary" onClick={() => run((x, a) => { const g = guard(x, a, "insurance"); return g.ok ? claimAction(x, g.actor, c.id, next[c.status]!) : g; }, "انجام شد")}>{lbl[next[c.status]!]}</Button>}{has("insurance") && ["OPEN", "REVIEW"].includes(c.status) && <Button size="sm" variant="ghost" onClick={() => run((x, a) => { const g = guard(x, a, "insurance"); return g.ok ? claimAction(x, g.actor, c.id, "REJECTED") : g; }, "رد شد")}>رد</Button>}</div></li>)}</ul></Panel>
        <Panel title="محصولات بیمه"><ul className="divide-y divide-line/70 text-sm">{s.products.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 py-2.5"><span><b>{p.name}</b><span className="ms-2 text-xs text-ink-3">{s.insurers.find((i) => i.id === p.insurerId)?.name}</span></span><span className="tabular text-ink-3">نرخ {fa(Number((p.rate * 100).toFixed(2)))}٪ · فرانشیز {fa(p.deductiblePct * 100)}٪</span></li>)}</ul></Panel>
      </div>
      {has("insurance") && <Panel title="ثبت پرونده‌ی خسارت"><div className="grid gap-3 sm:grid-cols-3"><Field label="شناسه‌ی سفارش">{(id) => <Input id={id} value={o.orderId} onChange={(e) => setO({ ...o, orderId: e.target.value })} dir="ltr" />}</Field><Field label="مبلغ (تومان)">{(id) => <NumInput id={id} value={o.amount} onChange={(v) => setO({ ...o, amount: v ?? 0 })} allowDecimal={false} />}</Field><Field label="شرح">{(id) => <Input id={id} value={o.reason} onChange={(e) => setO({ ...o, reason: e.target.value })} />}</Field></div><Button className="mt-3" onClick={() => { const r = run((x, a) => { const g = guard(x, a, "insurance"); return g.ok ? openClaim(x, g.actor, o.orderId.trim(), R(o.amount), o.reason) : g; }, "پرونده ثبت شد"); if (r.ok) setO({ orderId: "", amount: 0, reason: "" }); }}>ثبت</Button></Panel>}
    </div>
  );
}
