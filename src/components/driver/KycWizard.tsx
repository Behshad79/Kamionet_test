"use client";

import { ArrowRight, BadgeCheck, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { TruckIllustration } from "../graphics/TruckIllustration";
import { PlateInput } from "../graphics/PlateInput";
import { FileDrop } from "../molecules";
import { JalaliDatePicker } from "../pickers";
import { RuleCard } from "../rules";
import { toast } from "../Toaster";
import { Button, Card, Field, Input, NumInput, Select, Stepper, Toggle, cx } from "../ui";
import { KYC_STEPS, MAX_ID_ATTEMPTS, kycReady, saveIdentity, saveVehicle, setDoc, submitKyc, validNationalId, verifyShahkar } from "@/lib/engine/kyc";
import { acceptRules, needsAcceptance } from "@/lib/engine/trust";
import { driverOf, person } from "@/lib/engine/core";
import { fromJalali, jalaliParts } from "@/lib/jalali";
import { normalizeDigits } from "@/lib/money";
import { act, useStore } from "@/lib/store";
import { VEHICLES, VEHICLE_COLORS, VEHICLE_KINDS } from "@/lib/vehicles";
import type { Plate, VehicleKind } from "@/lib/types";

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const toBirth = (ts: number) => { const p = jalaliParts(ts); return `${p.jy}/${pad(p.jm)}/${pad(p.jd)}`; };
const fromBirth = (b?: string) => { const m = b?.match(/^(\d{4})\/(\d{2})\/(\d{2})$/); return m ? fromJalali(+m[1], +m[2], +m[3], 12) : fromJalali(1370, 1, 1, 12); };

const VISIBLE = ["هویت", "تطبیق شاهکار", "چهره", "گواهینامه", "خودرو", "قوانین", "ارسال"];

/** Resumable KYC wizard. `step` lives on the profile, so closing the app and returning continues where the driver stopped. */
export function KycWizard({ pid }: { pid: string }) {
  const s = useStore();
  const d = driverOf(s, pid)!;
  const p = person(s, pid)!;
  const [step, setStep] = useState(() => Math.min(Math.max(1, d.kyc.step), 7));
  const [nid, setNid] = useState(p.nationalId ?? "");
  const [birth, setBirth] = useState(fromBirth(p.birthDate));
  const [err, setErr] = useState("");
  const [plate, setPlate] = useState<Plate | null>(d.vehicle.plate);
  const [kind, setKind] = useState<VehicleKind>(d.vehicle.kind);
  const [cap, setCap] = useState<number | undefined>(d.vehicle.capacityKg);
  const [color, setColor] = useState(d.vehicle.color);
  const [fridge, setFridge] = useState(d.vehicle.fridgeBrand);
  const [minTemp, setMinTemp] = useState<number | null>(d.vehicle.minTemp);
  const [amb, setAmb] = useState(d.vehicle.canRunAmbient);
  const [ins, setIns] = useState(d.docs.insurance?.expiresAt ?? Date.now() + 180 * DAY);
  const [insp, setInsp] = useState(d.docs.inspection?.expiresAt ?? Date.now() + 180 * DAY);
  const [accepted, setAccepted] = useState(false);
  const meta = VEHICLES[kind];
  const go = (n: number) => { setErr(""); setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const doc = (key: Parameters<typeof setDoc>[2]) => (c: { dataUrl: string }) => act((st) => setDoc(st, pid, key, c.dataUrl));

  const step1 = () => {
    const id = normalizeDigits(nid).replace(/\D/g, "");
    if (!validNationalId(id)) return setErr("کد ملی معتبر نیست؛ ۱۰ رقم را دوباره بررسی کنید.");
    const r = act((st) => saveIdentity(st, pid, id, toBirth(birth)));
    if (!r.ok) return setErr(r.error);
    go(2);
  };
  const step2 = () => {
    const r = act((st) => verifyShahkar(st, pid));
    if (!r.ok) return setErr(r.error);
    if (r.match) { toast("هویت شما با سیم‌کارت تطبیق داده شد."); go(3); }
  };
  const step5 = () => {
    const r = act((st) => saveVehicle(st, pid, { kind, capacityKg: cap ?? meta.capacityKg, color, plate, fridgeBrand: meta.fridge ? fridge : "—", minTemp: meta.fridge ? minTemp : null, canRunAmbient: !meta.fridge || amb }, { insurance: ins, inspection: insp }));
    if (!r.ok) return setErr(r.error);
    if (!d.docs.regFront?.dataUrl) return setErr("عکس روی کارت خودرو را بارگذاری کنید.");
    if (!d.docs.insurance?.dataUrl || !d.docs.inspection?.dataUrl) return setErr("عکس بیمه‌نامه و برگ معاینه‌ی فنی الزامی است.");
    go(6);
  };
  const missing = kycReady(s, pid);

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-black">احراز هویت راننده</h1><p className="mt-1 text-sm text-ink-3">هر مرحله ذخیره می‌شود؛ هر زمان خواستید می‌توانید ادامه دهید.</p></div>
      <Stepper steps={VISIBLE} current={step - 1} />
      {err && <div role="alert" className="rounded-ui bg-danger-bg p-3 text-sm font-medium text-danger">{err}</div>}

      {step === 1 && (
        <Card className="space-y-4 p-5">
          <h2 className="font-extrabold">{KYC_STEPS[1]}</h2>
          <Field label="کد ملی" hint="باید به نام خودتان باشد.">{(id) => <Input id={id} dir="ltr" inputMode="numeric" className="text-left tabular" maxLength={10} value={nid} onChange={(e) => setNid(e.target.value)} />}</Field>
          <JalaliDatePicker label="تاریخ تولد" value={birth} onChange={setBirth} />
          <Button block size="lg" onClick={step1}>ثبت و ادامه</Button>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4 p-5">
          <h2 className="font-extrabold">تطبیق کد ملی با سیم‌کارت</h2>
          <p className="text-sm leading-7 text-ink-3">برای جلوگیری از سوءاستفاده، باید کد ملی با شماره‌ی موبایل شما در سامانه‌ی تطبیق (شاهکار) یکی باشد. این بخش در نسخه‌ی نمایشی شبیه‌سازی می‌شود.</p>
          {d.kyc.idMatch.status === "ok" ? (
            <p className="flex items-center gap-2 font-bold text-ok"><CheckCircle2 className="size-5" aria-hidden />تطبیق انجام شد.</p>
          ) : d.kyc.idMatch.status === "mismatch" ? (
            <div className="space-y-3 rounded-ui bg-danger-bg p-4 text-sm text-danger">
              <p className="flex items-center gap-2 font-bold"><ShieldAlert className="size-5" aria-hidden />کد ملی با این شماره‌ی موبایل مطابقت ندارد.</p>
              {d.kyc.idMatch.attempts >= MAX_ID_ATTEMPTS ? <p className="leading-7">تعداد تلاش‌ها به سقف رسید و پرونده برای بررسی به تیم احراز هویت رفت. لطفاً از بخش پشتیبانی (حساب و احراز) پیگیری کنید.</p> : <p>{MAX_ID_ATTEMPTS - d.kyc.idMatch.attempts} تلاش دیگر باقی مانده است. کد ملی را اصلاح کنید.</p>}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => go(1)}><ArrowRight className="size-4" aria-hidden />ویرایش کد ملی</Button>
            {d.kyc.idMatch.status === "ok" ? <Button onClick={() => go(3)}>ادامه</Button> : <Button disabled={d.kyc.idMatch.attempts >= MAX_ID_ATTEMPTS} onClick={step2}>استعلام تطبیق</Button>}
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4 p-5">
          <h2 className="font-extrabold">عکس چهره</h2>
          <p className="text-sm leading-7 text-ink-3">یک عکس واضح از صورت خود بگیرید؛ بدون عینک آفتابی و کلاه.</p>
          <FileDrop label="عکس چهره" hint="دوربین جلو را باز می‌کند" capture value={d.docs.selfie?.dataUrl} onChange={doc("selfie")} />
          <Nav back={() => go(2)} next={() => (d.docs.selfie?.dataUrl ? go(4) : setErr("عکس چهره را بارگذاری کنید."))} />
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-4 p-5">
          <h2 className="font-extrabold">گواهینامه یا کارت هوشمند</h2>
          <div className="grid gap-3 sm:grid-cols-2"><FileDrop label="گواهینامه" hint="روی کارت" value={d.docs.license?.dataUrl} onChange={doc("license")} /><FileDrop label="کارت هوشمند راننده" hint="اختیاری" value={d.docs.smartCard?.dataUrl} onChange={doc("smartCard")} /></div>
          <Nav back={() => go(3)} next={() => (d.docs.license?.dataUrl || d.docs.smartCard?.dataUrl ? go(5) : setErr("حداقل یکی از دو مدرک را بارگذاری کنید."))} />
        </Card>
      )}

      {step === 5 && (
        <Card className="space-y-5 p-5">
          <h2 className="font-extrabold">خودرو و مدارک آن</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {VEHICLE_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setCap(VEHICLES[k].capacityKg); if (!VEHICLES[k].fridge) setMinTemp(null); else if (minTemp === null) setMinTemp(0); }} className={cx("rounded-ui border-2 p-2 text-center", kind === k ? "border-act bg-act-soft" : "border-line bg-white")}>
                <TruckIllustration kind={k} color={color} className="h-14 w-full" /><div className="text-sm font-bold">{VEHICLES[k].short}</div>
              </button>
            ))}
          </div>
          <div className="text-sm font-medium text-ink-2">رنگ خودرو</div>
          <div className="-mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="رنگ خودرو">{VEHICLE_COLORS.map((c) => <button key={c.id} type="button" role="radio" aria-checked={color === c.id} aria-label={c.label} onClick={() => setColor(c.id)} className={cx("grid size-11 place-items-center rounded-full border-2", color === c.id ? "border-act" : "border-line")}><span className="size-7 rounded-full border border-ink/20" style={{ background: c.hex }} /></button>)}</div>
          <PlateInput value={plate} onChange={setPlate} />
          <Field label="ظرفیت بار (کیلوگرم)">{(id) => <NumInput id={id} value={cap} onChange={setCap} suffix="کیلوگرم" />}</Field>
          {meta.fridge && (
            <div className="space-y-3 rounded-ui bg-surface-2 p-4">
              <Field label="برند یخچال">{(id) => <Input id={id} value={fridge} onChange={(e) => setFridge(e.target.value)} placeholder="مثلاً Thermo King" />}</Field>
              <Field label="کمترین دمایی که یخچال می‌تواند نگه دارد">{(id) => <Select id={id} value={minTemp ?? 0} onChange={(e) => setMinTemp(+e.target.value)}>{[-25, -22, -18, -10, 0, 2, 4].map((t) => <option key={t} value={t}>{t < 0 ? `منفی ${Math.abs(t)}` : t} درجه</option>)}</Select>}</Field>
              <div className="flex items-center justify-between gap-3"><div><div className="font-bold">می‌توانم بار غیریخچالی با یخچال خاموش ببرم</div><div className="text-xs text-ink-3">برای دریافت بارهای خشک‌بار در سفرهای برگشت.</div></div><Toggle checked={amb} onChange={setAmb} label="بار غیریخچالی" /></div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2"><FileDrop label="کارت خودرو (رو)" value={d.docs.regFront?.dataUrl} onChange={doc("regFront")} /><FileDrop label="کارت خودرو (پشت)" value={d.docs.regBack?.dataUrl} onChange={doc("regBack")} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><FileDrop label="عکس بیمه‌نامه‌ی شخص ثالث" hint="الزامی" value={d.docs.insurance?.dataUrl} onChange={doc("insurance")} /><FileDrop label="عکس برگ معاینه‌ی فنی" hint="الزامی" value={d.docs.inspection?.dataUrl} onChange={doc("inspection")} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><JalaliDatePicker label="انقضای بیمه‌ی شخص ثالث" value={ins} onChange={setIns} /><JalaliDatePicker label="انقضای معاینه‌ی فنی" value={insp} onChange={setInsp} /></div>
          <Nav back={() => go(4)} next={step5} />
        </Card>
      )}

      {step === 6 && (
        <Card className="space-y-4 p-5">
          <RuleCard audience="driver" />
          <label className="flex min-h-12 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5" checked={accepted || !needsAcceptance(s, pid, "driver")} onChange={(e) => setAccepted(e.target.checked)} />قوانین و مقررات رانندگان را خوانده‌ام و می‌پذیرم.</label>
          <Nav back={() => go(5)} next={() => { if (needsAcceptance(s, pid, "driver")) { if (!accepted) return setErr("برای ادامه باید قوانین را بپذیرید."); act((st) => acceptRules(st, pid, "driver", "kyc")); } go(7); }} />
        </Card>
      )}

      {step === 7 && (
        <Card className="space-y-4 p-5">
          <h2 className="font-extrabold">بازبینی و ارسال</h2>
          {missing.length === 0 ? <p className="flex items-center gap-2 text-sm text-ok"><BadgeCheck className="size-5" aria-hidden />همه‌ی مدارک کامل است.</p> : <p className="rounded-ui bg-warn-bg p-3 text-sm text-warn">موارد ناقص: {missing.join("، ")}</p>}
          <p className="text-sm leading-7 text-ink-3">پس از ارسال، تیم احراز هویت مدارک را بررسی می‌کند. تا تأیید نمی‌توانید بار انتخاب کنید و در صورت نیاز به اصلاح، اعلان می‌گیرید.</p>
          <div className="flex gap-2"><Button variant="secondary" onClick={() => go(6)}><ArrowRight className="size-4" aria-hidden />قبلی</Button><Button className="flex-1" disabled={missing.length > 0} onClick={() => { const r = act((st) => submitKyc(st, pid)); toast(r.ok ? "مدارک برای بررسی ارسال شد." : r.error, r.ok ? "ok" : "err"); }}>ارسال برای بررسی</Button></div>
        </Card>
      )}
    </div>
  );
}

function Nav({ back, next }: { back: () => void; next: () => void }) {
  return <div className="flex gap-2"><Button variant="secondary" onClick={back}><ArrowRight className="size-4" aria-hidden />قبلی</Button><Button className="flex-1" onClick={next}>ادامه</Button></div>;
}

export function InReview({ submittedAt }: { submittedAt?: number }) {
  void submittedAt;
  return (
    <Card className="space-y-3 p-6 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-warn-bg text-warn"><Clock className="size-8" aria-hidden /></span>
      <h2 className="text-xl font-black">مدارک شما در حال بررسی است</h2>
      <p className="text-sm leading-7 text-ink-3">معمولاً بررسی کمتر از یک روز کاری طول می‌کشد. نتیجه را با اعلان و پیامک خبر می‌دهیم. تا آن زمان می‌توانید بارهای موجود را ببینید اما نمی‌توانید انتخاب کنید.</p>
    </Card>
  );
}
