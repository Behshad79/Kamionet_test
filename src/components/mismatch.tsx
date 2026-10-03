"use client";

import { AlertTriangle, CheckCircle2, Gavel, Handshake, XCircle } from "lucide-react";
import { useState } from "react";
import { cv } from "@/lib/config";
import { driverRespondCounter, escalateMismatch, mismatchFormula, payMismatchDelta, reportMismatch, respondMismatch, type MismatchInput } from "@/lib/engine/orders";
import { shipperPaid } from "@/lib/engine/pay";
import { CARGO, fa, jDateTime, toman, tomanWords, weightLabel } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { R, T } from "@/lib/money";
import { act, useStore } from "@/lib/store";
import type { CargoKind, Media, Mismatch, MismatchType, Order, OdorClass } from "@/lib/types";
import { Countdown, FileDrop, type Captured } from "./molecules";
import { PaymentSheet } from "./order/PaymentSheet";
import { toast } from "./Toaster";
import { Badge, Button, Card, Field, NumInput, Select, Sheet, Textarea, cx } from "./ui";

export const MM_TYPES: Record<MismatchType, string> = {
  weight_up: "وزن بیشتر از اظهار", quantity_down: "وزن کمتر از اظهار", volume_up: "حجم بیشتر", pallets_up: "تعداد پالت بیشتر",
  cargo_type: "نوع بار متفاوت", temperature: "نیاز به دمای سردتر", packaging: "بسته‌بندی نیازمند جابه‌جایی اضافه", odor_hazard: "بوی شدید یا خطرناک",
};
export const MM_STATUS: Record<Mismatch["status"], { label: string; tone: "ok" | "warn" | "danger" | "info" | "neutral" }> = {
  PENDING_SHIPPER: { label: "در انتظار تصمیم صاحب بار", tone: "warn" }, COUNTERED: { label: "پیشنهاد متقابل", tone: "info" }, APPROVED: { label: "تأییدشده", tone: "ok" },
  REJECTED: { label: "ردشده", tone: "danger" }, ESCALATED: { label: "ارجاع به پشتیبانی", tone: "warn" }, RESOLVED_DRIVER: { label: "حکم به نفع راننده", tone: "neutral" },
  RESOLVED_SHIPPER: { label: "حکم به نفع صاحب بار", tone: "neutral" }, SPLIT: { label: "حکم میانه", tone: "neutral" },
};
const asMedia = (c: Captured): Media => ({ kind: "mismatch", dataUrl: c.dataUrl, takenAt: c.takenAt, lat: c.lat, lng: c.lng });

/* ───────────────────────── driver: report ───────────────────────── */

export function MismatchSheet({ open, onClose, o, driverId }: { open: boolean; onClose: () => void; o: Order; driverId: string }) {
  const s = useStore();
  const [types, setTypes] = useState<MismatchType[]>([]);
  const [weight, setWeight] = useState<number | undefined>();
  const [volume, setVolume] = useState<number | undefined>();
  const [pallets, setPallets] = useState<number | undefined>();
  const [cargo, setCargo] = useState<CargoKind>(o.cargo);
  const [odor, setOdor] = useState<OdorClass>(o.odor);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<(Captured | undefined)[]>([undefined, undefined, undefined]);
  const [adj, setAdj] = useState(0);
  const [busy, setBusy] = useState(false);
  const tgl = (t: MismatchType) => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
  const input: MismatchInput = { types, actual: { weightKg: weight, volumeM3: volume, pallets, cargo: types.includes("cargo_type") ? cargo : undefined, odor: types.includes("odor_hazard") ? odor : undefined, note }, photos: photos.filter(Boolean).map((p) => asMedia(p!)), adjustPct: adj / 100 };
  const f = types.length ? mismatchFormula(s, o, input) : undefined;
  const pct = Math.round(cv<number>(s, "mismatch.adjustPct") * 100);
  const need = (types.some((t) => t === "weight_up" || t === "quantity_down") && !weight) ? "وزن واقعی را وارد کنید." : types.length === 0 ? "حداقل یک نوع مغایرت را انتخاب کنید." : input.photos.length < 2 ? "حداقل دو عکس به‌عنوان مدرک لازم است." : "";
  return (
    <Sheet open={open} onClose={onClose} title="گزارش مغایرت بار" wide footer={<Button block size="lg" loading={busy} disabled={!!need} onClick={async () => {
      setBusy(true); await new Promise((r) => setTimeout(r, 400));
      const r = act((st) => reportMismatch(st, driverId, o.id, input)); setBusy(false);
      toast(r.ok ? "مغایرت ثبت شد و برای صاحب بار ارسال شد." : r.error, r.ok ? "ok" : "err"); if (r.ok) onClose();
    }}>{need || "ارسال برای صاحب بار"}</Button>}>
      <div className="space-y-5">
        <p className="text-sm leading-7 text-ink-3">اگر بار واقعی با اظهار صاحب بار فرق دارد، با مدرک گزارش کنید. صاحب بار {fa(cv<number>(s, "mismatch.slaMin"))} دقیقه برای تأیید، پیشنهاد متقابل یا رد فرصت دارد؛ سپس پرونده به پشتیبانی می‌رود.</p>
        <fieldset className="space-y-2"><legend className="mb-1 text-sm font-bold">نوع مغایرت</legend>
          <div className="grid gap-2 sm:grid-cols-2">{(Object.keys(MM_TYPES) as MismatchType[]).map((t) => <label key={t} className={cx("flex min-h-12 items-center gap-3 rounded-ui border-2 px-3 text-sm font-medium", types.includes(t) ? "border-act bg-act-soft" : "border-line bg-white")}><input type="checkbox" className="size-5" checked={types.includes(t)} onChange={() => tgl(t)} />{MM_TYPES[t]}</label>)}</div></fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={`وزن واقعی (اظهار: ${weightLabel(o.weightKg)})`}>{(id) => <NumInput id={id} value={weight} onChange={setWeight} suffix="کیلوگرم" />}</Field>
          <Field label="حجم واقعی (مترمکعب)">{(id) => <NumInput id={id} allowDecimal value={volume} onChange={setVolume} />}</Field>
          <Field label="تعداد پالت واقعی">{(id) => <NumInput id={id} value={pallets} onChange={setPallets} />}</Field>
        </div>
        {types.includes("cargo_type") && <Field label="نوع واقعی بار">{(id) => <Select id={id} value={cargo} onChange={(e) => setCargo(e.target.value as CargoKind)}>{(Object.keys(CARGO) as CargoKind[]).map((k) => <option key={k} value={k}>{CARGO[k].label}</option>)}</Select>}</Field>}
        {types.includes("odor_hazard") && <Field label="بوی بار">{(id) => <Select id={id} value={odor} onChange={(e) => setOdor(e.target.value as OdorClass)}><option value="LOW">کم</option><option value="STRONG">شدید</option></Select>}</Field>}
        <div><div className="mb-2 text-sm font-bold">مدرک تصویری (حداقل ۲ عکس)</div><div className="grid grid-cols-3 gap-2">{photos.map((p, i) => <FileDrop key={i} label={`عکس ${fa(i + 1)}`} stamp capture value={p?.dataUrl} onChange={(c) => setPhotos((x) => x.map((y, j) => (j === i ? c : y)))} />)}</div></div>
        <Field label="توضیح">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        {f && (
          <div className="space-y-3 rounded-ui bg-surface-2 p-4">
            <div className="font-extrabold">محاسبه‌ی کرایه‌ی پیشنهادی</div>
            <dl className="space-y-1.5 text-sm"><div className="flex justify-between"><dt className="text-ink-3">کرایه‌ی فعلی</dt><dd className="tabular font-bold">{toman(o.freight)}</dd></div>{f.lines.map((l) => <div key={l.label} className="flex justify-between gap-3"><dt className="text-ink-3">{l.label}</dt><dd className={cx("tabular font-bold", l.amount < 0 ? "text-ok" : "text-warn")}>{l.amount < 0 ? "−" : "+"}{toman(Math.abs(l.amount))}</dd></div>)}<div className="flex justify-between border-t border-line pt-2 font-black"><dt>کرایه‌ی پیشنهادی</dt><dd className="tabular">{toman(f.suggested)}</dd></div></dl>
            <Field label={`تعدیل دستی (حداکثر ±${fa(pct)}٪): ${adj > 0 ? "+" : ""}${fa(adj)}٪`}>{(id) => <input id={id} type="range" min={-pct} max={pct} value={adj} onChange={(e) => setAdj(+e.target.value)} className="w-full" />}</Field>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ───────────────────────── shared status panel ───────────────────────── */

export function MismatchPanel({ o, role, meId }: { o: Order; role: "shipper" | "driver"; meId: string }) {
  const s = useStore();
  const now = useNow(1000);
  const m = s.mismatches.find((x) => x.id === o.mismatchId);
  const [counter, setCounter] = useState(false);
  const [cv_, setCv] = useState<number | undefined>(m ? T(Math.round((m.proposedFreight + o.freight) / 2 / 10_000) * 10_000) : undefined);
  const [rej, setRej] = useState(false);
  const [pay, setPay] = useState(false);
  if (!m) return null;
  const st = MM_STATUS[m.status];
  const need = Math.max(0, o.depositRequired - shipperPaid(o));
  const waitingPay = m.status === "APPROVED" && o.status === "MISMATCH_REVIEW";
  const exp = m.dueAt - now;
  const run = (fn: () => { ok: boolean; error?: string }, msg: string) => { const r = fn(); toast(r.ok ? msg : r.error ?? "انجام نشد", r.ok ? "ok" : "err"); return r; };
  return (
    <Card className="space-y-4 border-2 border-warn/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-extrabold"><AlertTriangle className="size-5 text-warn" aria-hidden />مغایرت بار</h2><Badge tone={st.tone}>{st.label}</Badge></div>
      <div className="flex flex-wrap gap-1.5">{m.types.map((t) => <Badge key={t}>{MM_TYPES[t]}</Badge>)}</div>
      {m.actual.note && <p className="rounded-ui bg-surface-2 p-3 text-sm leading-7">«{m.actual.note}»</p>}
      <dl className="grid grid-cols-2 gap-3 text-sm">{m.actual.weightKg && <div><dt className="text-ink-3">وزن واقعی</dt><dd className="font-black">{weightLabel(m.actual.weightKg)}</dd></div>}{m.actual.pallets && <div><dt className="text-ink-3">پالت</dt><dd className="font-black">{fa(m.actual.pallets)}</dd></div>}</dl>
      <div className="grid grid-cols-3 gap-2">{m.photos.map((p, i) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={i} src={p.dataUrl} alt={`مدرک مغایرت ${fa(i + 1)}`} className="aspect-square w-full rounded-ui object-cover" />)}</div>
      <div className="space-y-1.5 rounded-ui bg-surface-2 p-4 text-sm">{m.formula.map((l, i) => <div key={i} className="flex justify-between gap-3"><span className="text-ink-3">{l.label}</span><b className="tabular">{i === 0 ? "" : l.amount < 0 ? "−" : "+"}{toman(Math.abs(l.amount))}</b></div>)}<div className="flex justify-between border-t border-line pt-2 text-base font-black"><span>کرایه‌ی پیشنهادی راننده</span><span className="tabular">{toman(m.proposedFreight)}</span></div>{m.counter && <div className="flex justify-between font-black text-accent-700"><span>پیشنهاد متقابل صاحب بار</span><span className="tabular">{toman(m.counter.freight)}</span></div>}</div>
      {["PENDING_SHIPPER", "COUNTERED"].includes(m.status) && <><Countdown until={m.dueAt} total={cv<number>(s, "mismatch.slaMin") * 60} /><p className="text-xs text-ink-3">{exp > 0 ? "در صورت پاسخ‌ندادن، پرونده خودکار به پشتیبانی ارجاع می‌شود." : "مهلت تمام شد؛ در حال ارجاع به پشتیبانی."}</p></>}
      {m.status === "ESCALATED" && <p className="flex items-start gap-2 rounded-ui bg-warn-bg p-3 text-sm leading-7 text-warn"><Gavel className="mt-1 size-4 shrink-0" aria-hidden />پرونده نزد پشتیبانی است و با بررسی مدارک تصمیم‌گیری می‌شود. تا آن زمان بارگیری متوقف است.</p>}
      {m.decision && <p className="rounded-ui bg-surface-2 p-3 text-sm">تصمیم: {m.decision.note} · {m.decision.by} · {jDateTime(m.decision.at)}</p>}

      {role === "shipper" && ["PENDING_SHIPPER", "ESCALATED"].includes(m.status) && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Button onClick={() => { const r = run(() => act((x) => respondMismatch(x, meId, m.id, "approve")), "مغایرت تأیید شد."); void r; }}><CheckCircle2 className="size-4" aria-hidden />تأیید و اصلاح بارنامه</Button>
          <Button variant="secondary" disabled={!!m.counter} onClick={() => setCounter(true)}><Handshake className="size-4" aria-hidden />پیشنهاد متقابل</Button>
          <Button variant="danger" onClick={() => setRej(true)}><XCircle className="size-4" aria-hidden />رد مغایرت</Button>
        </div>
      )}
      {role === "shipper" && waitingPay && <div className="space-y-2 rounded-ui bg-act-soft p-4"><div className="font-bold">برای ادامه‌ی بارگیری، مابه‌التفاوت را بپردازید: {toman(need)}</div><Button block onClick={() => setPay(true)}>پرداخت مابه‌التفاوت</Button></div>}
      {role === "shipper" && ["PENDING_SHIPPER", "COUNTERED"].includes(m.status) && <button className="h-11 text-sm font-bold text-accent-600" onClick={() => run(() => act((x) => escalateMismatch(x, m.id, "درخواست صاحب بار")), "به پشتیبانی ارجاع شد.")}>ارجاع به پشتیبانی</button>}
      {role === "driver" && m.status === "COUNTERED" && m.counter && (
        <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => run(() => act((x) => driverRespondCounter(x, meId, m.id, false)), "به پشتیبانی ارجاع شد.")}>نمی‌پذیرم</Button><Button onClick={() => run(() => act((x) => driverRespondCounter(x, meId, m.id, true)), "پیشنهاد پذیرفته شد.")}>می‌پذیرم</Button></div>
      )}
      {role === "driver" && waitingPay && <p className="rounded-ui bg-act-soft p-3 text-sm font-medium">منتظر پرداخت مابه‌التفاوت توسط صاحب بار هستیم.</p>}

      <Sheet open={counter} onClose={() => setCounter(false)} title="پیشنهاد متقابل" footer={<Button block disabled={!cv_} onClick={() => { const r = run(() => act((x) => respondMismatch(x, meId, m.id, "counter", R(cv_ ?? 0))), "پیشنهاد برای راننده ارسال شد."); if (r.ok) setCounter(false); }}>ارسال پیشنهاد</Button>}>
        <div className="space-y-3"><p className="text-sm leading-7 text-ink-3">فقط یک پیشنهاد متقابل مجاز است. اگر راننده نپذیرد، پرونده به پشتیبانی می‌رود.</p><Field label="کرایه‌ی پیشنهادی شما (تومان)" hint={cv_ ? tomanWords(R(cv_)) : undefined}>{(id) => <NumInput id={id} value={cv_} onChange={setCv} suffix="تومان" />}</Field></div>
      </Sheet>
      <Sheet open={rej} onClose={() => setRej(false)} title="رد مغایرت و لغو سفر" footer={<div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setRej(false)}>انصراف</Button><Button variant="danger" onClick={() => { const r = run(() => act((x) => respondMismatch(x, meId, m.id, "reject")), "سفر لغو شد."); if (r.ok) setRej(false); }}>رد و لغو</Button></div>}>
        <p className="text-sm leading-7">با رد مغایرت، سفر لغو می‌شود، جبران رفت خالی راننده کسر و بقیه‌ی مبلغ به کیف پول شما برمی‌گردد. اگر مدارک راننده درست باشد، برای حساب شما امتیاز «اظهار صادقانه» کم می‌شود.</p>
      </Sheet>
      <PaymentSheet open={pay} onClose={() => setPay(false)} payerId={meId} orderId={o.id} purpose="mismatch_delta" amount={need} title="پرداخت مابه‌التفاوت مغایرت" onDone={() => act((x) => payMismatchDelta(x, meId, o.id, "wallet"))} />
    </Card>
  );
}
