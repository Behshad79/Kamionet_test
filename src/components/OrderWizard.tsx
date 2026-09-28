"use client";

import { CargoIcon } from "./molecules";
import { AlertTriangle, ArrowLeft, ArrowRight, Info, Repeat, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CARGO, fa, jDate, millions, toman } from "@/lib/format";
import { cityPlace } from "@/lib/geo";
import { useApp } from "@/lib/hooks";
import { driverNet, insuranceFee, suggestRate } from "@/lib/pricing";
import { createOrders, createTemplate } from "@/lib/store";
import type { CargoType, Place } from "@/lib/types";
import { toast } from "./Toaster";
import { PlacePicker } from "./PlacePicker";
import { Button, Card, Field, Input, Segmented, Select, Stepper, Textarea, Toggle, cx } from "./ui";

const STEPS = ["مسیر", "بار و دما", "زمان", "قیمت"];

const days = Array.from({ length: 10 }, (_, i) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + i);
  return d.getTime();
});
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

export function OrderWizard() {
  const router = useRouter();
  const { s } = useApp();
  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState<Place>(cityPlace("تهران"));
  const [dest, setDest] = useState<Place>(cityPlace("اصفهان"));
  const [cargo, setCargo] = useState<CargoType>("dairy");
  const [tempMax, setTempMax] = useState(4);
  const [count, setCount] = useState(1);
  const [day, setDay] = useState(days[1]);
  const [hour, setHour] = useState(8);
  const [price, setPrice] = useState(0);
  const [insured, setInsured] = useState(false);
  const [note, setNote] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [cadence, setCadence] = useState<"daily" | "weekly">("weekly");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const cfg = s.config;
  const mandatory = cfg.insuranceMode === "mandatory";
  const frozen = tempMax <= -10;
  const quote = useMemo(() => suggestRate(s.rates, origin.city, dest.city, cargo, frozen), [s.rates, origin.city, dest.city, cargo, frozen]);
  const effectivePrice = price || Math.round((quote.min + quote.max) / 2 / 500_000) * 500_000;
  const withInsurance = mandatory || insured;
  const fee = withInsurance ? insuranceFee(effectivePrice, cfg) : 0;
  const tooLow = effectivePrice < quote.min * 0.85;
  const pickupAt = day + hour * 3_600_000;

  const next = () => {
    setErr("");
    if (step === 0 && origin.city === dest.city && origin.address === dest.address) return setErr("مبدأ و مقصد نمی‌توانند یکسان باشند.");
    if (step === 2 && pickupAt < Date.now()) return setErr("زمان بارگیری باید در آینده باشد.");
    setStep((x) => x + 1);
  };

  const submit = () => {
    setBusy(true);
    const input = { origin, dest, pickupAt, count, cargo, tempMax, price: effectivePrice, insurance: withInsurance, note: note.trim() || undefined };
    const r = createOrders(input);
    if (!r.ok) { setBusy(false); return setErr(r.error); }
    if (recurring) createTemplate(input, cadence, hour);
    toast(count > 1 ? `${fa(count)} سفارش ثبت شد و روی نقشه‌ی رانندگان آمد` : "سفارش ثبت شد و روی نقشه‌ی رانندگان آمد");
    router.push(`/shipper/order/?id=${r.id}`);
  };

  return (
    <div className="space-y-5">
      <Stepper steps={STEPS} current={step} />
      <Card className="animate-rise space-y-6 p-5 sm:p-6" key={step}>
        {step === 0 && (
          <>
            <PlacePicker label="مبدأ (محل بارگیری)" kind="origin" value={origin} onChange={setOrigin} />
            <hr className="border-line" />
            <PlacePicker label="مقصد (محل تخلیه)" kind="dest" value={dest} onChange={setDest} />
          </>
        )}

        {step === 1 && (
          <>
            <Field label="نوع بار">
              {(id) => (
                <div id={id} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.keys(CARGO) as CargoType[]).map((k) => (
                    <button key={k} type="button" onClick={() => { setCargo(k); if (k === "icecream") setTempMax(-18); }}
                      className={cx("flex items-center gap-2 rounded-ui border-2 px-3 py-3 text-start text-sm font-bold transition", cargo === k ? "border-brand-500 bg-brand-50" : "border-line hover:border-ink-4")}>
                      <CargoIcon type={k} className="size-5 shrink-0 text-ink-2" />{CARGO[k].label}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <div className="space-y-3">
              <span className="text-sm font-medium text-ink-2">دمای موردنیاز حمل</span>
              <Segmented value={frozen ? -18 : 4} onChange={(v) => setTempMax(v)} options={[
                { value: 4, label: "سردخانه‌ای", sub: "بالای صفر (تا ۴°C)" },
                { value: -18, label: "انجمادی", sub: "پایین‌تر از ۱۸− درجه" },
              ]} />
              <div className="rounded-ui bg-surface-2 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-ink-3">دقیق‌تر تنظیم کنید (حداکثر دمای مجاز بار)</span>
                  <b className="tabular" dir="ltr">{tempMax}°C</b>
                </div>
                <input type="range" min={-25} max={8} value={tempMax} onChange={(e) => setTempMax(+e.target.value)} className="w-full" aria-label="حداکثر دمای مجاز" />
                <div className="mt-1 flex justify-between text-xs text-ink-3"><span>سردتر</span><span>گرم‌تر</span></div>
              </div>
              <p className="flex gap-2 rounded-ui bg-accent-50 p-3 text-[13px] leading-6 text-accent-700"><Info className="mt-0.5 size-4 shrink-0" />سفارش فقط به خودروهایی نشان داده می‌شود که کمترین دمای قابل‌دستیابی یخچالشان از {fa(tempMax)}°C سردتر یا برابر باشد. یخچالی −۲۰° می‌تواند بار سردخانه‌ای هم ببرد؛ ولی برعکس نه.</p>
            </div>
            <Field label="توضیحات بار (اختیاری)">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً ۴۰ کارتن، وزن تقریبی ۱٫۲ تن" />}</Field>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-2">روز بارگیری</span>
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {days.map((d, i) => (
                  <button key={d} type="button" onClick={() => setDay(d)}
                    className={cx("shrink-0 rounded-ui border-2 px-4 py-2.5 text-center transition", day === d ? "border-brand-500 bg-brand-50" : "border-line")}>
                    <div className="text-xs text-ink-3">{i === 0 ? "امروز" : i === 1 ? "فردا" : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "short" }).format(d)}</div>
                    <div className="mt-0.5 font-black tabular">{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short" }).format(d)}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ساعت بارگیری">
                {(id) => <Select id={id} value={hour} onChange={(e) => setHour(+e.target.value)}>{HOURS.map((h) => <option key={h} value={h}>{fa(h)}:۰۰</option>)}</Select>}
              </Field>
              <Field label="تعداد خودروی موردنیاز" hint={count > 1 ? "به ازای هر خودرو یک سفارش مستقل (با همین قیمت) ساخته می‌شود." : undefined}>
                {(id) => (
                  <div className="flex h-12 items-center justify-between rounded-ui border border-line px-2">
                    <button type="button" aria-label="کم" className="size-9 rounded-full text-xl hover:bg-surface-3" onClick={() => setCount((c) => Math.max(1, c - 1))}>−</button>
                    <span id={id} className="text-lg font-black tabular">{fa(count)}</span>
                    <button type="button" aria-label="زیاد" className="size-9 rounded-full text-xl hover:bg-surface-3" onClick={() => setCount((c) => Math.min(10, c + 1))}>+</button>
                  </div>
                )}
              </Field>
            </div>
            <p className="text-sm text-ink-3">بارگیری: <b className="text-ink">{jDate(pickupAt)}، ساعت {fa(hour)}:۰۰</b></p>

            <div className="rounded-ui border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-accent-50 text-accent-600"><Repeat className="size-5" /></span>
                  <div><div className="font-bold">سفارش تکرارشونده</div><div className="text-[13px] text-ink-3">از این سفارش الگو بساز تا خودکار ثبت شود</div></div></div>
                <Toggle checked={recurring} onChange={setRecurring} label="سفارش تکرارشونده" />
              </div>
              {recurring && (
                <div className="mt-4 animate-rise space-y-2">
                  <Segmented value={cadence} onChange={setCadence} options={[{ value: "daily", label: "هر روز" }, { value: "weekly", label: "هر هفته" }]} />
                  <p className="text-[13px] leading-6 text-ink-3">هر {cadence === "daily" ? "روز" : "هفته"} ساعت {fa(hour)}:۰۰؛ سفارش جدید ۱۲ ساعت قبل از بارگیری خودکار برای رانندگان منتشر می‌شود.</p>
                </div>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="rounded-ui bg-brand-50 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-bold text-brand-700"><Sparkles className="size-4" />نرخ پیشنهادی بازار · {fa(quote.km)} کیلومتر</div>
              <div className="text-2xl font-black tabular">{millions(quote.min)} تا {millions(quote.max)} <span className="text-base font-bold">تومان</span></div>
              <p className="mt-1 text-xs text-ink-3">{quote.source === "table" ? "بر اساس جدول نرخ مرجع این مسیر" : "برآورد بر اساس مسافت (نرخ مرجعی برای این مسیر ثبت نشده)"}</p>
            </div>
            <Field label="کرایه‌ی پیشنهادی شما (تومان)" error={tooLow ? undefined : undefined}>
              {(id) => (
                <div className="space-y-2">
                  <Input id={id} dir="ltr" inputMode="numeric" className="text-start text-lg font-black tabular" value={effectivePrice ? new Intl.NumberFormat("en-US").format(effectivePrice) : ""}
                    onChange={(e) => setPrice(+e.target.value.replace(/\D/g, ""))} />
                  <div className="flex gap-2 text-xs">
                    {[quote.min, Math.round((quote.min + quote.max) / 2 / 500_000) * 500_000, quote.max].map((p, i) => (
                      <button key={i} type="button" onClick={() => setPrice(p)} className="rounded-full bg-surface-3 px-3 py-1.5 font-medium hover:bg-line">{["حداقل", "میانگین", "حداکثر"][i]} · {millions(p)}</button>
                    ))}
                  </div>
                </div>
              )}
            </Field>
            {tooLow && (
              <p role="alert" className="flex animate-rise gap-2 rounded-ui bg-warn-bg p-3 text-sm leading-6 text-warn">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                این مبلغ به‌طور محسوسی پایین‌تر از نرخ بازار است و احتمال پیدا شدن راننده کم می‌شود.
              </p>
            )}

            <div className="flex items-center justify-between gap-3 rounded-ui border border-line p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-ok-bg text-ok"><ShieldCheck className="size-5" /></span>
                <div>
                  <div className="font-bold">بیمه‌ی بار {mandatory && <span className="ms-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-3">اجباری</span>}</div>
                  <div className="text-[13px] text-ink-3">{toman(insuranceFee(effectivePrice, cfg))} ({new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(cfg.insuranceRate * 100)}٪ کرایه)</div>
                </div>
              </div>
              <Toggle checked={withInsurance} disabled={mandatory} onChange={setInsured} label="بیمه‌ی بار" />
            </div>

            <dl className="space-y-2 rounded-ui bg-surface-2 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink-3">کرایه{count > 1 ? ` (هر خودرو، ${fa(count)} خودرو)` : ""}</dt><dd className="font-bold tabular">{toman(effectivePrice)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">بیمه</dt><dd className="font-bold tabular">{withInsurance ? toman(fee) : "—"}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-base"><dt className="font-bold">مجموع پرداختی</dt><dd className="font-black tabular">{toman((effectivePrice + fee) * count)}</dd></div>
              <div className="flex justify-between text-xs text-ink-3"><dt>سهم راننده ({fa((1 - cfg.commission) * 100)}٪ کرایه)</dt><dd className="tabular">{toman(driverNet(effectivePrice, cfg))}</dd></div>
            </dl>
          </>
        )}

        {err && <p role="alert" className="text-sm font-medium text-danger">{err}</p>}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => (step === 0 ? router.push("/shipper/") : setStep(step - 1))}><ArrowRight className="size-4" />{step === 0 ? "انصراف" : "قبلی"}</Button>
        {step < 3 ? <Button onClick={next}>مرحله‌ی بعد<ArrowLeft className="size-4" /></Button> : <Button size="lg" loading={busy} onClick={submit}>ثبت و انتشار سفارش</Button>}
      </div>
    </div>
  );
}
