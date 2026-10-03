"use client";

import { ArrowRight, Check, Crown, Info, Repeat, ShieldCheck, Snowflake, Users, Wand2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cashEligibleShipper, createOrders, insurancePremium, priceOrder, saveTemplate } from "@/lib/engine/orders";
import { driverStats } from "@/lib/engine/stats";
import { person } from "@/lib/engine/core";
import { CARGO, fa, tempClass, tempRange, toman, tomanWords, PAY_TERMS, weightLabel, jShort, hhmm } from "@/lib/format";
import { cityPlace, roadKm } from "@/lib/geo";
import { matchVehicle } from "@/lib/matching";
import { R, T, normalizeDigits } from "@/lib/money";
import { suggestRate } from "@/lib/pricing";
import { act, useStore } from "@/lib/store";
import { VEHICLES, VEHICLE_KINDS } from "@/lib/vehicles";
import type { AssignMode, CargoKind, CargoMode, DriverProfile, OdorClass, OrderInput, PayTerms, ServiceClass, State, VehicleKind } from "@/lib/types";
import { InsurerLogo, ProBadge } from "../brand";
import { TruckIllustration } from "../graphics/TruckIllustration";
import { PlaceCombobox, TempRangeSlider } from "../inputs";
import { CleanBadge } from "../order/parts";
import { RatingPill } from "../molecules";
import { JalaliDateTimePicker } from "../pickers";
import { toast } from "../Toaster";
import { Button, Card, Field, Input, NumInput, Segmented, Select, Sheet, Stepper, Textarea, Toggle, cx } from "../ui";

const HOUR = 3_600_000;
const STEPS = ["مسیر", "بار", "سرویس", "قیمت و بیمه", "بازبینی"];
const DRAFT = "kamionet:wizard-draft";

interface Form {
  from?: { city: string; province?: string; lat: number; lng: number }; fromAddr: string;
  to?: { city: string; province?: string; lat: number; lng: number }; toAddr: string;
  pickupAt: number; windowH: number; deliverBy: number; count: number;
  consName: string; consPhone: string;
  mode: CargoMode; cargo: CargoKind; tMin: number; tMax: number; odor: OdorClass; odorSensitive: boolean;
  vehicle: VehicleKind; weightKg?: number; pallets?: number; volume?: number; packaging: string; itemized: boolean; declaredT?: number; note: string; cleanOnly: boolean;
  service: ServiceClass; assign: AssignMode; directId?: string;
  freightT?: number; tipT: number; insurance: string | null; coverage: number; coupon: string; terms: PayTerms; autoPay: boolean; recurring: "none" | "daily" | "weekly";
}

const tomorrow8 = () => { const d = new Date(Date.now() + 24 * HOUR); d.setHours(8, 0, 0, 0); return d.getTime(); };
const blank = (): Form => ({
  fromAddr: "", toAddr: "", pickupAt: tomorrow8(), windowH: 2, deliverBy: tomorrow8() + 14 * HOUR, count: 1, consName: "", consPhone: "",
  mode: "REFRIGERATED", cargo: "dairy", tMin: 0, tMax: 4, odor: "NONE", odorSensitive: false, vehicle: "truck10", packaging: "پالت", itemized: false, note: "", cleanOnly: false,
  service: "STANDARD", assign: "OPEN", tipT: 0, insurance: null, coverage: 1, coupon: "", terms: "DEPOSIT_BALANCE_AFTER_DELIVERY", autoPay: false, recurring: "none",
});

const CARGO_PRESET: Partial<Record<CargoKind, [number, number]>> = { dairy: [0, 4], meat: [-2, 2], fish: [-2, 2], produce: [8, 15], icecream: [-25, -18], pharma: [2, 8] };

export function OrderWizard({ shipperId, initial }: { shipperId: string; initial?: Partial<Form> }) {
  const router = useRouter();
  const s = useStore();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(() => ({ ...blank(), ...initial }));
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  // restore / persist draft (a refresh must not lose a long form)
  useEffect(() => { if (initial) return; try { const r = sessionStorage.getItem(DRAFT); if (r) setF({ ...blank(), ...JSON.parse(r) }); } catch { /* ignore */ } }, [initial]);
  useEffect(() => { try { sessionStorage.setItem(DRAFT, JSON.stringify(f)); } catch { /* ignore */ } }, [f]);

  const pickupTo = f.pickupAt + f.windowH * HOUR;
  const km = f.from && f.to ? roadKm(f.from, f.to) : 0;
  const fridge = f.mode === "REFRIGERATED";
  const frozen = fridge && f.tMax <= -18;
  const rate = useMemo(() => (f.from && f.to ? suggestRate(s, f.from.city, f.to.city, km, f.vehicle, frozen, f.mode) : undefined), [s, f.from, f.to, km, f.vehicle, frozen, f.mode]);

  const input = (): OrderInput | undefined => {
    if (!f.from || !f.to) return undefined;
    return {
      origin: { ...cityPlace(f.from.city, f.fromAddr), lat: f.from.lat, lng: f.from.lng, address: f.fromAddr },
      dest: { ...cityPlace(f.to.city, f.toAddr), lat: f.to.lat, lng: f.to.lng, address: f.toAddr },
      pickupAt: f.pickupAt, pickupTo, deliverBy: f.deliverBy, count: f.count, cargoMode: f.mode, cargo: f.cargo, odor: f.odor, odorSensitive: f.odorSensitive,
      tempMin: fridge ? f.tMin : undefined, tempMax: fridge ? f.tMax : undefined, vehicleKind: f.vehicle, weightKg: f.weightKg ?? 0, volumeM3: f.volume, pallets: f.pallets,
      packaging: f.packaging, itemizedInvoice: f.itemized, declaredValue: R(f.declaredT ?? 0), note: f.note || undefined, cleanOnly: f.cleanOnly,
      serviceClass: f.service, assignMode: f.assign, directDriverId: f.assign === "DIRECT" ? f.directId : undefined,
      freightBase: R(f.freightT ?? 0), tipPre: R(f.tipT), insuranceProductId: f.insurance, coveragePct: f.coverage, couponCode: f.coupon.trim() || undefined,
      terms: f.terms, autoPayDeposit: f.autoPay, consignee: { name: f.consName.trim(), phone: normalizeDigits(f.consPhone).replace(/\D/g, "") },
    };
  };
  const quote = useMemo(() => { const i = input(); return i && (f.freightT ?? 0) > 0 ? priceOrder(s, shipperId, i) : undefined; }, [f, s]); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (n: number) => {
    const e: Record<string, string> = {};
    if (n === 0) {
      if (!f.from) e.from = "مبدأ را انتخاب کنید.";
      if (!f.to) e.to = "مقصد را انتخاب کنید.";
      if (f.from && f.to && f.from.city === f.to.city && f.fromAddr.trim() === f.toAddr.trim()) e.to = "مبدأ و مقصد نمی‌توانند یکسان باشند.";
      if (f.pickupAt < Date.now()) e.pickup = "زمان بارگیری گذشته است.";
      if (f.deliverBy <= pickupTo) e.deliver = "مهلت تحویل باید بعد از پایان بازه‌ی بارگیری باشد.";
      if (f.consName.trim().length < 3) e.consName = "نام گیرنده را وارد کنید.";
      if (!/^09\d{9}$/.test(f.consPhone.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))))) e.consPhone = "موبایل گیرنده معتبر نیست (مثلاً ۰۹۱۲۱۲۳۴۵۶۷).";
    }
    if (n === 1) {
      if (!(f.weightKg && f.weightKg > 0)) e.weight = "وزن بار را وارد کنید.";
      else if (f.weightKg > VEHICLES[f.vehicle].capacityKg) e.weight = `وزن بیشتر از ظرفیت ${VEHICLES[f.vehicle].short} (${weightLabel(VEHICLES[f.vehicle].capacityKg)}) است؛ خودروی بزرگ‌تر یا چند خودرو انتخاب کنید.`;
      if (!(f.declaredT && f.declaredT >= 1_000_000)) e.declared = "ارزش اعلامی بار را وارد کنید (حداقل ۱ میلیون تومان).";
    }
    if (n === 2 && f.assign === "DIRECT" && !f.directId) e.direct = "یک راننده‌ی پرو انتخاب کنید.";
    if (n === 3) {
      if (!(f.freightT && f.freightT >= 500_000)) e.freight = "کرایه‌ی پیشنهادی را وارد کنید.";
      if (quote?.couponError) e.coupon = quote.couponError;
    }
    setErr(e);
    return Object.keys(e).length === 0;
  };
  const next = () => { if (validate(step)) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const back = () => { setErr({}); setStep(step - 1); };

  const submit = async () => {
    const i = input();
    if (!i) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    const r = act((st) => { const res = createOrders(st, shipperId, i); if (res.ok && f.recurring !== "none") saveTemplate(st, shipperId, i, f.recurring); return res; });
    setBusy(false);
    if (!r.ok) { toast(r.error, "err"); setStep(0); return setErr({ submit: r.error }); }
    try { sessionStorage.removeItem(DRAFT); } catch { /* ignore */ }
    toast(f.count > 1 ? `${fa(f.count)} سفارش ثبت شد.` : "سفارش ثبت شد.");
    router.replace(r.ids.length === 1 ? `/app/order/?id=${r.ids[0]}` : "/app/");
  };

  const cash = cashEligibleShipper(s, shipperId, quote?.total ?? 0);
  const proDrivers = s.drivers.filter((d) => d.pro.status === "pro" && d.personId !== shipperId && matchVehicle(d.vehicle, { vehicleKind: f.vehicle, tempMax: fridge ? f.tMax : undefined, tempMin: fridge ? f.tMin : undefined, weightKg: f.weightKg ?? 0, cargoMode: f.mode } as never).ok);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-28">
      <div><h1 className="text-2xl font-black">سفارش جدید</h1><p className="mt-1 text-sm text-ink-3">پیش‌نویس به‌صورت خودکار نگه داشته می‌شود.</p></div>
      <Stepper steps={STEPS} current={step} />
      {err.submit && <div role="alert" className="rounded-ui bg-danger-bg p-3 text-sm font-medium text-danger">{err.submit}</div>}

      {step === 0 && (
        <Card className="space-y-5 p-5">
          <PlaceBlock title="مبدأ" value={f.from?.city} onPlace={(p) => set({ from: p ? { city: p.name, province: p.province, lat: p.lat, lng: p.lng } : undefined })} addr={f.fromAddr} onAddr={(v) => set({ fromAddr: v })} error={err.from} />
          <PlaceBlock title="مقصد" value={f.to?.city} onPlace={(p) => set({ to: p ? { city: p.name, province: p.province, lat: p.lat, lng: p.lng } : undefined })} addr={f.toAddr} onAddr={(v) => set({ toAddr: v })} error={err.to} />
          {km > 0 && <p className="rounded-ui bg-accent-50 p-3 text-sm font-medium text-accent-700">فاصله‌ی تقریبی جاده‌ای: {fa(km)} کیلومتر</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <JalaliDateTimePicker label="شروع بازه‌ی بارگیری" value={f.pickupAt} onChange={(v) => set({ pickupAt: v, deliverBy: Math.max(f.deliverBy, v + (f.windowH + 4) * HOUR) })} min={Date.now()} error={err.pickup} />
            <Field label="طول بازه‌ی بارگیری">{(id) => <Select id={id} value={f.windowH} onChange={(e) => set({ windowH: +e.target.value })}>{[1, 2, 3, 4, 6].map((h) => <option key={h} value={h}>{fa(h)} ساعت</option>)}</Select>}</Field>
          </div>
          <JalaliDateTimePicker label="مهلت تحویل در مقصد" value={f.deliverBy} onChange={(v) => set({ deliverBy: v })} min={pickupTo} error={err.deliver} />
          <Field label="تعداد خودرو" hint="برای چند خودرو، یک‌بار ثبت می‌کنید و هر خودرو جداگانه تخصیص می‌یابد.">{(id) => <Select id={id} value={f.count} onChange={(e) => set({ count: +e.target.value })}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{fa(i + 1)} خودرو</option>)}</Select>}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نام گیرنده" error={err.consName}>{(id) => <Input id={id} value={f.consName} onChange={(e) => set({ consName: e.target.value })} />}</Field>
            <Field label="موبایل گیرنده" error={err.consPhone} hint="کد تحویل و پیوند رهگیری برای او پیامک می‌شود.">{(id) => <Input id={id} dir="ltr" inputMode="tel" className="text-left" value={f.consPhone} onChange={(e) => set({ consPhone: e.target.value })} />}</Field>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-5 p-5">
          <Segmented<CargoMode> value={f.mode} onChange={(m) => set({ mode: m, vehicle: m === "AMBIENT" ? "dry" : VEHICLES[f.vehicle].fridge ? f.vehicle : "truck10", cargo: m === "AMBIENT" ? "dry" : "dairy", ...(m === "REFRIGERATED" ? { tMin: 0, tMax: 4 } : {}) })}
            options={[{ value: "REFRIGERATED", label: "یخچالی", sub: "کنترل دما" }, { value: "AMBIENT", label: "غیریخچالی", sub: "خشک‌بار و سایر" }]} />
          <Field label="نوع بار">{(id) => (
            <Select id={id} value={f.cargo} onChange={(e) => { const c = e.target.value as CargoKind; const p = CARGO_PRESET[c]; set({ cargo: c, ...(p && fridge ? { tMin: p[0], tMax: p[1] } : {}), odor: c === "meat" || c === "fish" ? "STRONG" : f.odor }); }}>
              {(Object.keys(CARGO) as CargoKind[]).filter((k) => (fridge ? k !== "dry" : true)).map((k) => <option key={k} value={k}>{CARGO[k].label}</option>)}
            </Select>)}</Field>
          {fridge && <TempRangeSlider min={f.tMin} max={f.tMax} onChange={(a, b) => set({ tMin: a, tMax: b })} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="بوی بار">{() => <Segmented<OdorClass> value={f.odor} onChange={(o) => set({ odor: o })} options={[{ value: "NONE", label: "بدون بو" }, { value: "LOW", label: "کم" }, { value: "STRONG", label: "شدید" }]} />}</Field>
            <div className="flex items-center justify-between gap-3 rounded-ui bg-surface-2 p-4"><div><div className="font-bold">بار من حساس به بو است</div><div className="text-xs text-ink-3">راننده‌ی خودرویی با سابقه‌ی بوی شدید انتخاب نمی‌شود.</div></div><Toggle checked={f.odorSensitive} onChange={(v) => set({ odorSensitive: v })} label="حساس به بو" /></div>
          </div>
          <Field label="خودرو">{() => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {VEHICLE_KINDS.filter((k) => (fridge ? VEHICLES[k].fridge : true)).map((k) => (
                <button key={k} type="button" aria-pressed={f.vehicle === k} onClick={() => set({ vehicle: k })} className={cx("rounded-ui border-2 p-2 text-center transition", f.vehicle === k ? "border-act bg-act-soft" : "border-line bg-white")}>
                  <TruckIllustration kind={k} color="white" className="h-14 w-full" /><div className="text-sm font-bold">{VEHICLES[k].short}</div><div className="text-xs text-ink-3">تا {weightLabel(VEHICLES[k].capacityKg)}</div>
                </button>
              ))}
            </div>)}</Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="وزن (کیلوگرم)" error={err.weight}>{(id) => <NumInput id={id} value={f.weightKg} onChange={(v) => set({ weightKg: v })} suffix="کیلوگرم" />}</Field>
            <Field label="تعداد پالت">{(id) => <NumInput id={id} value={f.pallets} onChange={(v) => set({ pallets: v })} />}</Field>
            <Field label="حجم (مترمکعب)">{(id) => <NumInput id={id} allowDecimal value={f.volume} onChange={(v) => set({ volume: v })} />}</Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="بسته‌بندی">{(id) => <Select id={id} value={f.packaging} onChange={(e) => set({ packaging: e.target.value })}>{["پالت", "کارتن", "جعبه", "یونولیت", "فله", "جعبه چوبی"].map((p) => <option key={p}>{p}</option>)}</Select>}</Field>
            <Field label="ارزش اعلامی بار (تومان)" error={err.declared} hint={f.declaredT ? tomanWords(R(f.declaredT)) : "مبنای بیمه و خسارت"}>{(id) => <NumInput id={id} value={f.declaredT} onChange={(v) => set({ declaredT: v })} suffix="تومان" />}</Field>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-ui bg-surface-2 p-4"><div><div className="font-bold">فاکتور ریزمتن‌دار دارد</div><div className="text-xs text-ink-3">راننده باید هنگام بارگیری و تحویل از فاکتور عکس بگیرد.</div></div><Toggle checked={f.itemized} onChange={(v) => set({ itemized: v })} label="فاکتور ریزمتن" /></div>
          <div className="flex items-center justify-between gap-3 rounded-ui bg-surface-2 p-4"><div><div className="flex items-center gap-1.5 font-bold">فقط خودروی «تمیز تأییدشده» <CleanBadge /></div><div className="text-xs text-ink-3">اختیاری؛ ممکن است زمان تخصیص را کمی بیشتر کند.</div></div><Toggle checked={f.cleanOnly} onChange={(v) => set({ cleanOnly: v })} label="فقط خودروی تمیز" /></div>
          <Field label="توضیحات (اختیاری)">{(id) => <Textarea id={id} value={f.note} onChange={(e) => set({ note: e.target.value })} />}</Field>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <h2 className="font-extrabold">نوع سرویس</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" aria-pressed={f.service === "STANDARD"} onClick={() => set({ service: "STANDARD", assign: "OPEN", directId: undefined })} className={cx("rounded-ui border-2 p-4 text-start", f.service === "STANDARD" ? "border-act bg-act-soft" : "border-line")}>
                <div className="font-black">استاندارد</div><p className="mt-1 text-sm leading-6 text-ink-3">بار در بازار عمومی منتشر می‌شود و هر راننده‌ی تأییدشده‌ی مناسب می‌تواند بردارد.</p>
              </button>
              <button type="button" aria-pressed={f.service === "PRO"} onClick={() => set({ service: "PRO", assign: "PRO_POOL" })} className={cx("rounded-ui border-2 p-4 text-start", f.service === "PRO" ? "border-pro-gold bg-pro-navy text-white" : "border-line")}>
                <div className="flex items-center gap-2 font-black"><ProBadge /> کامیونت پرو</div><p className={cx("mt-1 text-sm leading-6", f.service === "PRO" ? "text-white/75" : "text-ink-3")}>فقط رانندگان بازرسی‌شده‌ی پرو. کرایه‌ی نهایی {fa(Math.round(100 * (s.config.values["pro.uplift"] as number ?? 0.15)))}٪ بیشتر است.</p>
              </button>
            </div>
          </Card>
          {f.service === "PRO" && (
            <Card className="space-y-4 p-5">
              <h2 className="font-extrabold">روش تخصیص</h2>
              <Segmented<AssignMode> value={f.assign} onChange={(a) => set({ assign: a })} options={[
                { value: "PRO_POOL", label: "استخر پرو", sub: "اولین راننده‌ی پذیرنده" },
                { value: "DIRECT", label: "انتخاب مستقیم", sub: "درخواست از یک راننده" },
                { value: "SMART", label: "هوشمند", sub: "تخصیص خودکار" },
              ]} />
              <p className="flex gap-2 text-sm leading-7 text-ink-3"><Info className="mt-1 size-4 shrink-0" aria-hidden />
                {f.assign === "PRO_POOL" ? "بار برای همه‌ی رانندگان پرو مناسب نمایش داده می‌شود." : f.assign === "DIRECT" ? "راننده ۱۰ دقیقه فرصت پاسخ دارد؛ اگر نپذیرد، می‌توانید راننده‌ی دیگری انتخاب کنید یا بار را به استخر پرو بفرستید." : "سیستم از بین رانندگان پروی مناسب، با شانس بیشتر برای امتیاز و وقت‌شناسی بالاتر، یکی را پیشنهاد می‌دهد؛ اگر نپذیرد نفر بعدی."}</p>
              {f.assign === "DIRECT" && (
                <div>
                  {err.direct && <p className="mb-2 text-sm text-danger">{err.direct}</p>}
                  {proDrivers.length === 0 ? <p className="rounded-ui bg-surface-2 p-4 text-sm text-ink-3">راننده‌ی پروی مناسب این خودرو و دما پیدا نشد. روش «استخر پرو» را انتخاب کنید.</p> : (
                    <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
                      {proDrivers.map((d) => <ProDriverCard key={d.personId} d={d} s={s} selected={f.directId === d.personId} onSelect={() => set({ directId: d.personId })} onProfile={() => setProfile(d)} />)}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <h2 className="font-extrabold">کرایه</h2>
            {rate && <div className="rounded-ui bg-accent-50 p-4 text-sm"><div className="font-bold text-accent-700">بازه‌ی رایج این مسیر ({fa(rate.km)} کیلومتر)</div><div className="mt-1 text-lg font-black">{tomanWords(rate.min)} تا {tomanWords(rate.max)}</div>
              <button type="button" onClick={() => set({ freightT: T(Math.round((rate.min + rate.max) / 2 / 100_000) * 100_000) })} className="mt-2 inline-flex h-11 items-center gap-1 font-bold text-accent-600"><Wand2 className="size-4" aria-hidden />استفاده از میانه‌ی بازه</button></div>}
            <Field label="کرایه‌ی پیشنهادی برای هر خودرو (تومان)" error={err.freight} hint={f.freightT ? tomanWords(R(f.freightT)) : undefined}>{(id) => <NumInput id={id} value={f.freightT} onChange={(v) => set({ freightT: v })} suffix="تومان" />}</Field>
            <Field label="انعام / جذب سریع (اختیاری)" hint="مبلغی که تخصیص سریع‌تر را تشویق می‌کند و ۱۰۰٪ به راننده می‌رسد.">{(id) => <NumInput id={id} value={f.tipT || undefined} onChange={(v) => set({ tipT: v ?? 0 })} suffix="تومان" />}</Field>
            <Field label="کد تخفیف" error={err.coupon}>{(id) => <Input id={id} dir="ltr" className="text-left uppercase" value={f.coupon} onChange={(e) => set({ coupon: e.target.value })} />}</Field>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-extrabold"><ShieldCheck className="size-5 text-accent-600" aria-hidden />بیمه‌ی محموله</h2>
            <InsurancePicker s={s} ambient={!fridge} value={f.insurance} onChange={(v) => set({ insurance: v })} declared={R(f.declaredT ?? 0)} coverage={f.coverage} />
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-extrabold">شرایط پرداخت</h2>
            <div role="radiogroup" className="grid gap-2">
              {(Object.keys(PAY_TERMS) as PayTerms[]).map((t) => {
                const off = t === "CASH_BALANCE_TO_DRIVER" && !cash.ok ? (cash as { why: string }).why : undefined;
                return (
                  <button key={t} type="button" role="radio" aria-checked={f.terms === t} disabled={!!off} onClick={() => set({ terms: t })} className={cx("min-h-14 rounded-ui border-2 p-3 text-start disabled:opacity-50", f.terms === t ? "border-act bg-act-soft" : "border-line")}>
                    <div className="font-bold">{PAY_TERMS[t]}</div>
                    <div className="text-xs text-ink-3">{off ?? ({ PREPAID: "کل مبلغ پیش از حرکت پرداخت می‌شود.", DEPOSIT_BALANCE_BEFORE_LOADING: "مابقی پیش از بارگیری در مبدأ پرداخت می‌شود.", DEPOSIT_BALANCE_AFTER_DELIVERY: "مابقی پس از تحویل بار، آنلاین پرداخت می‌شود.", CASH_BALANCE_TO_DRIVER: "مابقی کرایه نقد به راننده؛ بیعانه‌ی آنلاین سهم پلتفرم را پوشش می‌دهد." })[t]}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-ui bg-surface-2 p-4"><div><div className="flex items-center gap-1.5 font-bold"><Zap className="size-4" aria-hidden />پرداخت خودکار بیعانه</div><div className="text-xs text-ink-3">اگر موجودی کیف پول کافی باشد، به‌محض انتخاب راننده پرداخت می‌شود.</div></div><Toggle checked={f.autoPay} onChange={(v) => set({ autoPay: v })} label="پرداخت خودکار بیعانه" /></div>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-extrabold"><Repeat className="size-5" aria-hidden />تکرار سفارش</h2>
            <Segmented<Form["recurring"]> value={f.recurring} onChange={(v) => set({ recurring: v })} options={[{ value: "none", label: "یک‌بار" }, { value: "daily", label: "روزانه" }, { value: "weekly", label: "هفتگی" }]} />
          </Card>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <h2 className="font-extrabold">خلاصه‌ی سفارش</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["مسیر", `${f.from?.city} ← ${f.to?.city} (${fa(km)} کیلومتر)`],
                ["بارگیری", `${jShort(f.pickupAt)}، ${hhmm(f.pickupAt)} تا ${hhmm(pickupTo)}`],
                ["مهلت تحویل", `${jShort(f.deliverBy)}، ${hhmm(f.deliverBy)}`],
                ["بار", `${CARGO[f.cargo].label} · ${weightLabel(f.weightKg ?? 0)} · ${f.packaging}`],
                ["دما", fridge ? `${tempRange(f.tMin, f.tMax)} (${{ frozen: "انجمادی", chilled: "سردخانه‌ای", cool: "خنک" }[tempClass(f.tMin, f.tMax)]})` : "بدون کنترل دما"],
                ["خودرو", `${fa(f.count)} × ${VEHICLES[f.vehicle].short}`],
                ["سرویس", f.service === "PRO" ? `پرو · ${{ PRO_POOL: "استخر پرو", DIRECT: "انتخاب مستقیم", SMART: "تخصیص هوشمند", OPEN: "" }[f.assign]}` : "استاندارد"],
                ["گیرنده", `${f.consName} · ${f.consPhone}`],
              ].map(([k, v]) => <div key={k}><dt className="text-ink-3">{k}</dt><dd className="font-bold">{v}</dd></div>)}
            </dl>
          </Card>
          {quote && (
            <Card className="space-y-3 p-5">
              <h2 className="font-extrabold">هزینه برای {fa(f.count)} خودرو</h2>
              <dl className="space-y-2 text-[15px]">
                <Row k="کرایه (هر خودرو)" v={toman(quote.freight)} />
                {quote.premium > 0 && <Row k="حق بیمه" v={toman(quote.premium)} />}
                {quote.vat > 0 && <Row k="مالیات" v={toman(quote.vat)} />}
                {quote.tip > 0 && <Row k="انعام" v={toman(quote.tip)} />}
                {quote.discount > 0 && <Row k="تخفیف" v={`−${toman(quote.discount)}`} good />}
                <div className="flex justify-between border-t border-line pt-2 text-lg font-black"><dt>جمع هر خودرو</dt><dd className="tabular">{toman(quote.total)}</dd></div>
                {f.count > 1 && <div className="flex justify-between font-black"><dt>جمع کل</dt><dd className="tabular">{toman(quote.total * f.count)}</dd></div>}
                <div className="flex justify-between rounded-ui bg-act-soft p-3 text-sm"><dt className="font-bold">بیعانه‌ی لازم پس از انتخاب راننده (هر خودرو)</dt><dd className="font-black tabular">{toman(quote.depositRequired)}</dd></div>
                {quote.cashAgreed > 0 && <div className="flex justify-between text-sm"><dt className="text-ink-3">نقد به راننده هنگام تحویل</dt><dd className="font-bold tabular">{toman(quote.cashAgreed)}</dd></div>}
              </dl>
              <p className="text-xs leading-6 text-ink-3">بیعانه ۱۰ دقیقه پس از انتخاب راننده سررسید می‌شود. تا آن زمان آدرس دقیق و شماره‌ی شما برای راننده پنهان است.</p>
            </Card>
          )}
        </div>
      )}

      <div className="pb-safe fixed inset-x-0 bottom-14 z-20 border-t border-line bg-white/95 p-3 backdrop-blur lg:bottom-0 lg:start-[248px]">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {step > 0 && <Button variant="secondary" onClick={back}><ArrowRight className="size-4" aria-hidden />قبلی</Button>}
          {step < 4 ? <Button className="flex-1" onClick={next}>ادامه</Button> : <Button className="flex-1" loading={busy} onClick={submit}><Check className="size-5" aria-hidden />ثبت و انتشار سفارش</Button>}
        </div>
      </div>

      <Sheet open={!!profile} onClose={() => setProfile(null)} title="پروفایل راننده" footer={profile && <Button block onClick={() => { set({ directId: profile.personId }); setProfile(null); }}>انتخاب این راننده</Button>}>
        {profile && <DriverProfileBody d={profile} s={s} />}
      </Sheet>
    </div>
  );
}

const Row = ({ k, v, good }: { k: string; v: string; good?: boolean }) => <div className="flex justify-between gap-3"><dt className="text-ink-3">{k}</dt><dd className={cx("font-bold tabular", good && "text-ok")}>{v}</dd></div>;

function PlaceBlock({ title, value, onPlace, addr, onAddr, error }: { title: string; value?: string; onPlace: (p: Parameters<NonNullable<React.ComponentProps<typeof PlaceCombobox>["onSelect"]>>[0]) => void; addr: string; onAddr: (v: string) => void; error?: string }) {
  return (
    <div className="space-y-3">
      <PlaceCombobox label={title} value={value} onSelect={onPlace} error={error} allowClear />
      <Field label={`نشانی ${title}`} hint="تا پیش از پرداخت بیعانه فقط محدوده‌ی تقریبی به راننده نمایش داده می‌شود.">{(id) => <Input id={id} value={addr} onChange={(e) => onAddr(e.target.value)} placeholder="خیابان، پلاک، انبار…" />}</Field>
    </div>
  );
}

function ProDriverCard({ d, s, selected, onSelect, onProfile }: { d: DriverProfile; s: State; selected: boolean; onSelect: () => void; onProfile: () => void }) {
  const st = driverStats(s, d.personId);
  const clean = !!d.clean.badgeUntil && d.clean.badgeUntil > Date.now();
  return (
    <div className={cx("w-64 shrink-0 snap-start space-y-2 rounded-ui border-2 p-3", selected ? "border-pro-gold bg-pro-navy text-white" : "border-line bg-white")}>
      <TruckIllustration kind={d.vehicle.kind} color={d.vehicle.color} state="cooling" className="h-16 w-full" />
      <div className="flex items-center justify-between gap-2"><span className="truncate font-black">{person(s, d.personId)?.name}</span><ProBadge /></div>
      <div className="flex flex-wrap items-center gap-2 text-xs">{<RatingPill r={{ avg: st.rating, count: st.ratingCount }} />}<span className={selected ? "text-white/70" : "text-ink-3"}>{fa(st.trips)} سفر</span>{clean && <CleanBadge />}</div>
      <div className="grid grid-cols-2 gap-2"><Button size="sm" variant={selected ? "secondary" : "primary"} onClick={onSelect}>{selected ? "انتخاب شد" : "انتخاب"}</Button><Button size="sm" variant="secondary" onClick={onProfile}>پروفایل</Button></div>
    </div>
  );
}

export function DriverProfileBody({ d, s }: { d: DriverProfile; s: State }) {
  const st = driverStats(s, d.personId);
  return (
    <div className="space-y-4">
      <TruckIllustration kind={d.vehicle.kind} color={d.vehicle.color} state="cooling" className="h-24 w-full" label="خودروی راننده" />
      <div className="flex items-center justify-between"><h3 className="text-lg font-black">{person(s, d.personId)?.name}</h3><ProBadge /></div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-ui bg-surface-2 p-3"><dt className="text-ink-3">امتیاز</dt><dd className="font-black">{fa(Math.round(st.rating * 10) / 10)} از ۵</dd></div>
        <div className="rounded-ui bg-surface-2 p-3"><dt className="text-ink-3">سفر</dt><dd className="font-black">{fa(st.trips)}</dd></div>
        <div className="rounded-ui bg-surface-2 p-3"><dt className="text-ink-3">وقت‌شناسی</dt><dd className="font-black">{fa(Math.round(st.onTime * 100))}٪</dd></div>
        <div className="rounded-ui bg-surface-2 p-3"><dt className="text-ink-3">لغو</dt><dd className="font-black">{fa(Math.round(st.cancelRate * 100))}٪</dd></div>
      </dl>
      <div className="space-y-2"><div className="text-sm font-bold">ریز امتیازها</div>{Object.entries(st.breakdown).map(([k, v]) => <div key={k} className="flex items-center gap-3 text-sm"><span className="w-28 text-ink-3">{({ punctuality: "وقت‌شناسی", cleanliness: "نظافت و بو", coldchain: "زنجیره‌ی سرد", behavior: "رفتار", communication: "ارتباط" } as Record<string, string>)[k] ?? k}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(v / 5) * 100}%` }} /></div><span className="w-8 text-end font-bold tabular">{fa(Math.round(v * 10) / 10)}</span></div>)}</div>
      <p className="flex items-center gap-2 text-xs text-ink-3"><Crown className="size-4" aria-hidden />دارای بازرسی خودرو و تأیید مدارک · <Snowflake className="size-4" aria-hidden />دمای خودرو تا {d.vehicle.minTemp === null ? "—" : `${d.vehicle.minTemp}°`}</p>
      <p className="flex items-center gap-2 text-xs text-ink-3"><Users className="size-4" aria-hidden />پلاک و شماره‌ی راننده پس از پرداخت بیعانه نمایش داده می‌شود.</p>
    </div>
  );
}

function InsurancePicker({ s, ambient, value, onChange, declared, coverage }: { s: State; ambient: boolean; value: string | null; onChange: (v: string | null) => void; declared: number; coverage: number }) {
  const mandatory = s.config.values["insurance.mode"] === "mandatory";
  const prods = s.products.filter((p) => p.ambient === ambient);
  const Opt = ({ id, children }: { id: string | null; children: React.ReactNode }) => (
    <button type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)} className={cx("w-full rounded-ui border-2 p-3 text-start", value === id ? "border-act bg-act-soft" : "border-line")}>{children}</button>
  );
  return (
    <div role="radiogroup" aria-label="بیمه" className="grid gap-2">
      {!mandatory && <Opt id={null}><div className="font-bold">بدون بیمه</div><div className="text-xs text-ink-3">خسارت احتمالی بر عهده‌ی صاحب بار است.</div></Opt>}
      {prods.map((p) => {
        const q = insurancePremium(s, p.id, declared, coverage);
        const ins = s.insurers.find((i) => i.id === p.insurerId);
        return (
          <Opt key={p.id} id={p.id}>
            <div className="flex items-center justify-between gap-3"><span className="font-black">{p.name}</span><span className="font-black tabular">{declared ? toman(q.premium) : `${fa(p.rate * 100)}٪ ارزش`}</span></div>
            {ins && <InsurerLogo name={ins.name} hue={ins.hue} className="mt-1 text-xs" />}
            <div className="mt-1 text-xs text-ink-3">پوشش: {p.covers.join("، ")}{p.deductiblePct > 0 ? ` · فرانشیز ${fa(p.deductiblePct * 100)}٪` : " · بدون فرانشیز"}</div>
          </Opt>
        );
      })}
    </div>
  );
}
void CARGO_PRESET;
