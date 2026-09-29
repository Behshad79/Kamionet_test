"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Info, Repeat, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CARGO, fa, jDate, payLabel, PAY, tempClassLabel, tempRange, toman, tomanWords, VEHICLE_CAPACITY, VEHICLE_ORDER, VEHICLES, VEHICLE_SHORT, weightLabel,
} from "@/lib/format";
import { roadKm } from "@/lib/geo";
import { useApp } from "@/lib/hooks";
import { insuranceFee, suggestRate } from "@/lib/pricing";
import { createOrders, createTemplate } from "@/lib/store";
import type { CargoType, PayMethod, Place, VehicleType } from "@/lib/types";
import { CargoIcon } from "./molecules";
import { TempRangeSlider } from "./inputs";
import { emptyPlace, PlacePicker } from "./PlacePicker";
import { toast } from "./Toaster";
import { Button, Card, Field, Input, NumInput, ScrollRow, Segmented, Select, Stepper, Textarea, Toggle, cx } from "./ui";

const STEPS = ["مسیر", "بار و دما", "خودرو و زمان", "قیمت و پرداخت", "مرور نهایی"];
const H = 3_600_000;
const DAY = 24 * H;

const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);
const days = Array.from({ length: 10 }, (_, i) => startOfDay(Date.now()) + i * DAY);
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const hh = (h: number) => `${h < 10 ? "۰" : ""}${fa(h)}:۰۰`;
const dayLabel = (d: number, i: number) => (i === 0 ? "امروز" : i === 1 ? "فردا" : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "short" }).format(d));
const dayNum = (d: number) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short" }).format(d);

function suggestVehicle(kg: number): VehicleType {
  return VEHICLE_ORDER.find((v) => VEHICLE_CAPACITY[v] >= kg) ?? "trailer";
}

export function OrderWizard() {
  const router = useRouter();
  const { s } = useApp();
  const top = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState<Place>(emptyPlace());
  const [dest, setDest] = useState<Place>(emptyPlace());
  const [cargo, setCargo] = useState<CargoType>("dairy");
  const [tempMin, setTempMin] = useState(0);
  const [tempMax, setTempMax] = useState(4);
  const [weight, setWeight] = useState<number>();
  const [pallets, setPallets] = useState<number>();
  const [volume, setVolume] = useState<number>();
  const [value, setValue] = useState<number>();
  const [vehicle, setVehicle] = useState<VehicleType>("truck10");
  const [vehicleTouched, setVehicleTouched] = useState(false);
  const [count, setCount] = useState(1);
  const [day, setDay] = useState(days[1]);
  const [fromH, setFromH] = useState(8);
  const [toH, setToH] = useState(10);
  const [deadlineDays, setDeadlineDays] = useState(1);
  const [deadlineH, setDeadlineH] = useState(18);
  const [pay, setPay] = useState<PayMethod>("deposit");
  const [depositPct, setDepositPct] = useState(30);
  const [price, setPrice] = useState<number>();
  const [insured, setInsured] = useState(false);
  const [note, setNote] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [cadence, setCadence] = useState<"daily" | "weekly">("weekly");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  // Every step change starts at the top with the step title in view and announced.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    top.current?.focus({ preventScroll: true });
  }, [step]);

  // A field error goes away as soon as the user edits anything, not only on the next click.
  useEffect(() => { setErr((e) => (Object.keys(e).length ? {} : e)); }, [origin, dest, weight, value, vehicle, day, fromH, toH, deadlineDays, deadlineH, price, pay, pallets, volume, cargo]);

  // Follow the weight with a vehicle suggestion until the user picks one themselves.
  useEffect(() => {
    if (weight && !vehicleTouched) setVehicle(suggestVehicle(weight));
  }, [weight, vehicleTouched]);

  const cfg = s.config;
  const mandatory = cfg.insuranceMode === "mandatory";
  const withInsurance = mandatory || insured;
  const frozen = tempMax <= -18;
  // One distance, computed from the real pickup/drop points, reused everywhere.
  const km = origin.city && dest.city ? roadKm(origin, dest) : 0;
  const quote = useMemo(
    () => (km ? suggestRate(s.rates, origin.city, dest.city, km, cargo, frozen, vehicle) : null),
    [s.rates, origin.city, dest.city, km, cargo, frozen, vehicle],
  );
  const effectivePrice = price ?? (quote ? Math.round((quote.min + quote.max) / 2 / 100_000) * 100_000 : 0);
  const fee = withInsurance && value ? insuranceFee(value, cfg) : 0;
  const tooLow = quote ? effectivePrice < quote.min * 0.85 : false;
  const pickupAt = day + fromH * H;
  const pickupTo = day + toH * H;
  const deliverBy = day + deadlineDays * DAY + deadlineH * H;
  const capacity = VEHICLE_CAPACITY[vehicle];

  const validate = (st: number) => {
    const e: Record<string, string> = {};
    if (st === 0) {
      if (!origin.city) e.originCity = "شهر مبدأ را انتخاب کنید.";
      if (origin.address.trim().length < 3) e.originAddress = "نشانی محل بارگیری را وارد کنید.";
      if (!dest.city) e.destCity = "شهر مقصد را انتخاب کنید.";
      if (dest.address.trim().length < 3) e.destAddress = "نشانی محل تخلیه را وارد کنید.";
      if (origin.city && origin.city === dest.city && origin.address.trim() === dest.address.trim()) e.destAddress = "مبدأ و مقصد نمی‌توانند یکسان باشند.";
    }
    if (st === 1) {
      if (!weight || weight <= 0) e.weight = "وزن بار را وارد کنید.";
      if (!value || value < 1_000_000) e.value = "ارزش اعلامی بار را وارد کنید (حداقل ۱ میلیون تومان).";
    }
    if (st === 2) {
      if (weight && weight > capacity) e.vehicle = `وزن بار (${weightLabel(weight)}) از ظرفیت این خودرو (${weightLabel(capacity)}) بیشتر است.`;
      if (pickupAt < Date.now()) e.time = "شروع بازه‌ی بارگیری باید در آینده باشد.";
      else if (toH <= fromH) e.time = "پایان بازه‌ی بارگیری باید بعد از شروع آن باشد.";
      else if (deliverBy <= pickupTo) e.deadline = "مهلت تحویل باید بعد از پایان بارگیری باشد.";
    }
    if (st === 3 && effectivePrice < 500_000) e.price = "کرایه‌ی معتبر وارد کنید.";
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErr(e);
    if (Object.keys(e).length) return;
    setStep((x) => x + 1);
  };

  const submit = () => {
    for (let i = 0; i < 4; i++) {
      const e = validate(i);
      if (Object.keys(e).length) { setErr(e); setStep(i); return; }
    }
    setBusy(true);
    const input = {
      origin, dest, pickupAt, pickupTo, deliverBy, count, cargo, tempMin, tempMax, vehicleType: vehicle, weightKg: weight!, pallets, volumeM3: volume,
      declaredValue: value!, price: effectivePrice, payment: { method: pay, depositPct: pay === "deposit" ? depositPct : undefined },
      insurance: withInsurance, note: note.trim() || undefined,
    };
    const r = createOrders(input);
    if (!r.ok) { setBusy(false); return setErr({ submit: r.error }); }
    if (recurring) createTemplate(input, cadence, fromH);
    toast(count > 1 ? `${fa(count)} سفارش ثبت شد و روی نقشه‌ی رانندگان آمد` : "سفارش ثبت شد و روی نقشه‌ی رانندگان آمد");
    router.push(`/shipper/order/?id=${r.id}`);
  };

  const applyCargo = (k: CargoType) => {
    setCargo(k);
    if (k === "icecream") { setTempMin(-25); setTempMax(-18); }
    else if (k === "pharma") { setTempMin(2); setTempMax(8); }
    else if (k === "dairy") { setTempMin(0); setTempMax(4); }
    else if (k === "other") { setTempMin(8); setTempMax(15); }
  };

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0"><dt className="shrink-0 text-ink-3">{k}</dt><dd className="text-end font-bold">{v}</dd></div>
  );

  return (
    <div className="space-y-5">
      <Stepper steps={STEPS} current={step} />
      <Card className="animate-rise space-y-6 p-5 sm:p-6" key={step}>
        <h2 ref={top} tabIndex={-1} className="text-lg font-black outline-none">{STEPS[step]}</h2>

        {step === 0 && (
          <>
            <PlacePicker label="مبدأ (محل بارگیری)" kind="origin" value={origin} onChange={setOrigin} errors={{ city: err.originCity, address: err.originAddress }} />
            <hr className="border-line" />
            <PlacePicker label="مقصد (محل تخلیه)" kind="dest" value={dest} onChange={setDest} errors={{ city: err.destCity, address: err.destAddress }} />
          </>
        )}

        {step === 1 && (
          <>
            <Field label="نوع بار">
              {(id) => (
                <div id={id} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.keys(CARGO) as CargoType[]).map((k) => (
                    <button key={k} type="button" onClick={() => applyCargo(k)} aria-pressed={cargo === k}
                      className={cx("flex min-h-12 items-center gap-2 rounded-ui border-2 px-3 py-3 text-start text-sm font-bold transition", cargo === k ? "border-brand-500 bg-brand-50" : "border-line hover:border-ink-4")}>
                      <CargoIcon type={k} className="size-5 shrink-0 text-ink-2" />{CARGO[k].label}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="وزن بار" error={err.weight}>{(id) => <NumInput id={id} value={weight} onChange={setWeight} suffix="کیلوگرم" placeholder="مثلاً ۸٬۰۰۰" aria-invalid={!!err.weight} />}</Field>
              <Field label="تعداد پالت (اختیاری)">{(id) => <NumInput id={id} value={pallets} onChange={setPallets} suffix="پالت" />}</Field>
              <Field label="حجم (اختیاری)">{(id) => <NumInput id={id} value={volume} onChange={setVolume} suffix="متر مکعب" allowDecimal />}</Field>
            </div>
            <Field label="ارزش تقریبی اعلامی بار (برای هر خودرو)" error={err.value} hint="مبنای محاسبه‌ی حق بیمه است، نه کرایه. هرچه دقیق‌تر، پوشش بیمه‌ای واقعی‌تر.">
              {(id) => <NumInput id={id} value={value} onChange={setValue} suffix="تومان" placeholder="مثلاً ۵٬۰۰۰٬۰۰۰٬۰۰۰" aria-invalid={!!err.value} />}
            </Field>
            {value ? <p className="-mt-3 text-sm font-medium text-accent-700">{tomanWords(value)}</p> : null}
            <div className="space-y-3">
              <span className="text-sm font-medium text-ink-2">بازه‌ی دمایی حمل</span>
              <TempRangeSlider min={tempMin} max={tempMax} onChange={(a, b) => { setTempMin(a); setTempMax(b); }} />
            </div>
            <Field label="توضیحات بار (اختیاری)">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً بسته‌بندی شیشه‌ای، شکستنی" />}</Field>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-2">نوع خودروی موردنیاز</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {VEHICLE_ORDER.map((v) => {
                  const small = !!weight && weight > VEHICLE_CAPACITY[v];
                  return (
                    <button key={v} type="button" disabled={small} aria-pressed={vehicle === v} onClick={() => { setVehicle(v); setVehicleTouched(true); }}
                      className={cx("rounded-ui border-2 p-3 text-center transition disabled:cursor-not-allowed disabled:opacity-40", vehicle === v ? "border-brand-500 bg-brand-50" : "border-line hover:border-ink-4")}>
                      <Truck className="mx-auto mb-1 size-6" aria-hidden />
                      <div className="text-sm font-bold">{VEHICLE_SHORT[v]}</div>
                      <div className="text-xs text-ink-3">تا {weightLabel(VEHICLE_CAPACITY[v])}</div>
                    </button>
                  );
                })}
              </div>
              {weight && !vehicleTouched && <p className="text-[13px] text-ink-3">بر اساس وزن {weightLabel(weight)}، «{VEHICLES[vehicle]}» پیشنهاد شد.</p>}
              {err.vehicle && <p role="alert" className="text-sm text-danger">{err.vehicle}</p>}
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-2">روز بارگیری</span>
              <ScrollRow>
                {days.map((d, i) => (
                  <button key={d} type="button" onClick={() => setDay(d)} aria-pressed={day === d}
                    className={cx("shrink-0 rounded-ui border-2 px-4 py-2.5 text-center transition", day === d ? "border-brand-500 bg-brand-50" : "border-line")}>
                    <div className="text-xs text-ink-3">{dayLabel(d, i)}</div>
                    <div className="mt-0.5 font-black tabular">{dayNum(d)}</div>
                  </button>
                ))}
              </ScrollRow>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="بازه‌ی بارگیری: از ساعت">{(id) => <Select id={id} value={fromH} onChange={(e) => { const v = +e.target.value; setFromH(v); if (toH <= v) setToH(Math.min(v + 2, 23)); }}>{HOURS.filter((h) => h < 23).map((h) => <option key={h} value={h}>{hh(h)}</option>)}</Select>}</Field>
              <Field label="تا ساعت">{(id) => <Select id={id} value={toH} onChange={(e) => setToH(+e.target.value)}>{HOURS.filter((h) => h > fromH).map((h) => <option key={h} value={h}>{hh(h)}</option>)}</Select>}</Field>
            </div>
            {err.time && <p role="alert" className="-mt-3 text-sm text-danger">{err.time}</p>}

            <div className="space-y-3 rounded-ui border border-line p-4">
              <div><div className="font-bold">مهلت تحویل در مقصد</div><p className="text-[13px] text-ink-3">برای بار فسادپذیر، زمان تخلیه معمولاً مهم‌تر از زمان بارگیری است.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="روز تحویل">
                  {(id) => (
                    <Select id={id} value={deadlineDays} onChange={(e) => setDeadlineDays(+e.target.value)}>
                      {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 0 ? "همان روز بارگیری" : `${jDate(day + n * DAY)}`}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="حداکثر ساعت تحویل">{(id) => <Select id={id} value={deadlineH} onChange={(e) => setDeadlineH(+e.target.value)}>{HOURS.concat([24]).map((h) => <option key={h} value={h}>{hh(h % 24)}</option>)}</Select>}</Field>
              </div>
              {err.deadline && <p role="alert" className="text-sm text-danger">{err.deadline}</p>}
            </div>

            <Field label="تعداد خودروی موردنیاز" hint={count > 1 ? `برای هر خودرو یک سفارش مستقل با همین وزن، ارزش بار و کرایه ساخته می‌شود؛ یعنی مجموع ${fa(count)} برابر است.` : undefined}>
              {(id) => (
                <div className="flex h-12 max-w-[200px] items-center justify-between rounded-ui border border-line px-2">
                  <button type="button" aria-label="کم" className="size-10 rounded-full text-xl hover:bg-surface-3" onClick={() => setCount((c) => Math.max(1, c - 1))}>−</button>
                  <span id={id} className="text-lg font-black tabular">{fa(count)}</span>
                  <button type="button" aria-label="زیاد" className="size-10 rounded-full text-xl hover:bg-surface-3" onClick={() => setCount((c) => Math.min(10, c + 1))}>+</button>
                </div>
              )}
            </Field>

            <div className="rounded-ui border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-accent-50 text-accent-600"><Repeat className="size-5" /></span>
                  <div><div className="font-bold">سفارش تکرارشونده</div><div className="text-[13px] text-ink-3">از این سفارش الگو بساز تا خودکار ثبت شود</div></div></div>
                <Toggle checked={recurring} onChange={setRecurring} label="سفارش تکرارشونده" />
              </div>
              {recurring && (
                <div className="mt-4 animate-rise space-y-2">
                  <Segmented value={cadence} onChange={setCadence} options={[{ value: "daily", label: "هر روز" }, { value: "weekly", label: "هر هفته" }]} />
                  <p className="text-[13px] leading-6 text-ink-3">هر {cadence === "daily" ? "روز" : "هفته"} با همین بازه‌ی بارگیری؛ سفارش جدید ۱۲ ساعت قبل از شروع بارگیری خودکار برای رانندگان منتشر می‌شود.</p>
                </div>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            {quote && (
              <div className="rounded-ui bg-brand-50 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-bold text-brand-700"><Sparkles className="size-4" />نرخ پیشنهادی بازار برای هر خودرو · {fa(quote.km)} کیلومتر</div>
                <div className="text-xl font-black tabular sm:text-2xl">{tomanWords(quote.min)} تا {tomanWords(quote.max)}</div>
                <p className="mt-1 text-xs text-ink-3">{quote.source === "table" ? "بر اساس جدول نرخ مرجع این مسیر" : "برآورد بر اساس مسافت (نرخ مرجعی برای این مسیر ثبت نشده)"} · برای «{VEHICLES[vehicle]}»</p>
              </div>
            )}
            <Field label={count > 1 ? `کرایه‌ی هر خودرو (تومان) · برای ${fa(count)} خودرو جمعاً ${toman(effectivePrice * count)}` : "کرایه‌ی پیشنهادی شما (تومان)"} error={err.price}>
              {(id) => (
                <div className="space-y-2">
                  <NumInput id={id} value={effectivePrice || undefined} onChange={setPrice} suffix="تومان" className="text-lg font-black" />
                  {quote && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {[quote.min, Math.round((quote.min + quote.max) / 2 / 100_000) * 100_000, quote.max].map((p, i) => (
                        <button key={i} type="button" onClick={() => setPrice(p)} className="min-h-11 rounded-full bg-surface-3 px-4 font-medium hover:bg-line">{["حداقل", "میانگین", "حداکثر"][i]} · {tomanWords(p)}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>
            {tooLow && (
              <p role="alert" className="flex animate-rise gap-2 rounded-ui bg-warn-bg p-3 text-sm leading-6 text-warn">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                این مبلغ به‌طور محسوسی پایین‌تر از نرخ بازار است و احتمال پیدا شدن راننده کم می‌شود.
              </p>
            )}

            <div className="space-y-3">
              <span className="text-sm font-medium text-ink-2">نحوه‌ی پرداخت</span>
              <Segmented<PayMethod> value={pay} onChange={setPay} options={(Object.keys(PAY) as PayMethod[]).map((k) => ({ value: k, label: k === "prepaid" ? "پیش‌پرداخت" : k === "deposit" ? "بیعانه" : "هنگام تحویل", sub: k === "prepaid" ? "کل مبلغ قبل از حرکت" : k === "deposit" ? "مابقی هنگام تحویل" : "همه هنگام تخلیه" }))} />
              {pay === "deposit" && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink-3">درصد بیعانه:</span>
                  {[20, 30, 50].map((p) => (
                    <button key={p} type="button" aria-pressed={depositPct === p} onClick={() => setDepositPct(p)} className={cx("min-h-11 rounded-full px-4 text-sm font-bold", depositPct === p ? "bg-ink text-white" : "bg-surface-3")}>{fa(p)}٪</button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-ui border border-line p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-ok-bg text-ok"><ShieldCheck className="size-5" /></span>
                <div>
                  <div className="font-bold">بیمه‌ی بار {mandatory && <span className="ms-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-3">اجباری</span>}</div>
                  <div className="text-[13px] text-ink-3">{value ? `${toman(insuranceFee(value, cfg))} (${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(cfg.insuranceRate * 100)}٪ ارزش اعلامی بار)` : "پس از وارد کردن ارزش بار محاسبه می‌شود"}</div>
                </div>
              </div>
              <Toggle checked={withInsurance} disabled={mandatory} onChange={setInsured} label="بیمه‌ی بار" />
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p className="flex gap-2 rounded-ui bg-accent-50 p-3 text-[13px] leading-6 text-accent-700"><Info className="mt-0.5 size-4 shrink-0" />با «ثبت و انتشار»، سفارش فوراً برای رانندگان مناسب نمایش داده می‌شود. اطلاعات را یک‌بار مرور کنید.</p>
            <dl>
              <h3 className="mb-1 font-black">مسیر</h3>
              <Row k="مبدأ" v={<>{origin.city}، {origin.province}<div className="text-xs font-normal text-ink-3">{origin.address}</div></>} />
              <Row k="مقصد" v={<>{dest.city}، {dest.province}<div className="text-xs font-normal text-ink-3">{dest.address}</div></>} />
              <Row k="مسافت" v={`${fa(km)} کیلومتر`} />
            </dl>
            <dl>
              <h3 className="mb-1 font-black">بار</h3>
              <Row k="نوع" v={CARGO[cargo].label} />
              <Row k="وزن" v={<>{weightLabel(weight ?? 0)}{pallets ? ` · ${fa(pallets)} پالت` : ""}{volume ? ` · ${fa(volume)} متر مکعب` : ""}</>} />
              <Row k="ارزش اعلامی" v={tomanWords(value ?? 0)} />
              <Row k="دما" v={<>{tempClassLabel(tempMin, tempMax)} · {tempRange(tempMin, tempMax)}</>} />
              {note.trim() && <Row k="توضیحات" v={note} />}
            </dl>
            <dl>
              <h3 className="mb-1 font-black">خودرو و زمان</h3>
              <Row k="خودرو" v={`${VEHICLES[vehicle]} × ${fa(count)}`} />
              <Row k="بارگیری" v={`${jDate(day)}، ${hh(fromH)} تا ${hh(toH)}`} />
              <Row k="مهلت تحویل" v={`${jDate(deliverBy)}، تا ساعت ${hh(deadlineH % 24)}`} />
              {recurring && <Row k="تکرار" v={cadence === "daily" ? "هر روز" : "هر هفته"} />}
            </dl>
            <dl>
              <h3 className="mb-1 font-black">پرداخت</h3>
              <Row k="نحوه‌ی پرداخت" v={payLabel({ method: pay, depositPct })} />
              <Row k={count > 1 ? "کرایه‌ی هر خودرو" : "کرایه"} v={toman(effectivePrice)} />
              <Row k="بیمه" v={withInsurance ? toman(fee) : "ندارد"} />
              <div className="mt-2 flex justify-between rounded-ui bg-surface-2 p-3 text-base"><dt className="font-bold">مجموع پرداختی{count > 1 ? ` (${fa(count)} خودرو)` : ""}</dt><dd className="font-black tabular">{toman((effectivePrice + fee) * count)}</dd></div>
            </dl>
          </>
        )}

        {err.submit && <p role="alert" className="text-sm font-medium text-danger">{err.submit}</p>}
        {Object.keys(err).length > 0 && !err.submit && step < 4 && <p role="alert" className="text-sm font-medium text-danger">لطفاً موارد مشخص‌شده را کامل کنید.</p>}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => { setErr({}); if (step === 0) router.push("/shipper/"); else setStep(step - 1); }}><ArrowRight className="size-4" />{step === 0 ? "انصراف" : "قبلی"}</Button>
        {step < 4 ? <Button onClick={next}>مرحله‌ی بعد<ArrowLeft className="size-4" /></Button> : <Button size="lg" loading={busy} onClick={submit}>ثبت و انتشار سفارش</Button>}
      </div>
    </div>
  );
}
