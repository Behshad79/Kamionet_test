"use client";

import { ArrowLeft, ArrowRight, BadgeCheck, CheckCircle2, Circle, Clock, Snowflake, ThermometerSnowflake } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { degrees, fa, jNum, VEHICLES } from "@/lib/format";
import { useApp } from "@/lib/hooks";
import { expiryStatus } from "@/lib/matching";
import { REQUIRED_DOCS, saveDriver, submitKyc } from "@/lib/store";
import type { DocKey, VehicleType } from "@/lib/types";
import { FileDrop, VerificationBadge } from "./molecules";
import { toast } from "./Toaster";
import { Button, Card, Field, Input, Segmented, Stepper, cx } from "./ui";

const STEPS = ["هویت", "خودرو", "بیمه و معاینه", "سیستم برودتی", "مرور و ارسال"];
const DAY = 86_400_000;

const DOC_LABEL: Record<DocKey, string> = {
  nationalFront: "کارت ملی (رو)", nationalBack: "کارت ملی (پشت)", license: "گواهینامه‌ی متناسب با خودرو", smartCard: "کارت هوشمند راننده‌ی حمل‌ونقل",
  selfie: "سلفی زنده با کارت ملی", regFront: "کارت خودرو (رو)", regBack: "کارت خودرو (پشت)", insurance: "بیمه‌ی شخص ثالث", inspection: "معاینه‌ی فنی معتبر",
  carExterior: "عکس کامل بیرونی خودرو", carInterior: "عکس داخل باکس یخچالی",
};

function Doc({ k, hint }: { k: DocKey; hint?: string }) {
  const { driver } = useApp();
  return <FileDrop label={DOC_LABEL[k]} hint={hint} value={driver?.docs[k]?.dataUrl} onChange={(c) => saveDriver({ docs: { [k]: { dataUrl: c.dataUrl } } })} />;
}

function Expiry({ k }: { k: "insurance" | "inspection" }) {
  const { driver } = useApp();
  const cur = driver?.docs[k]?.expiresAt;
  const presets: [string, number][] = [["۱۰ روز", 10], ["۳ ماه", 90], ["۶ ماه", 180], ["۱ سال", 365], ["۲ سال", 730]];
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-ink-2">تاریخ انقضا {cur && <b className="ms-1 text-ink">· {jNum(cur)}</b>}</span>
      <div className="flex flex-wrap gap-2">
        {presets.map(([l, d]) => {
          const on = cur !== undefined && Math.abs(cur - (Date.now() + d * DAY)) < DAY;
          return <button key={d} type="button" onClick={() => saveDriver({ docs: { [k]: { expiresAt: Date.now() + d * DAY } } })}
            className={cx("h-9 rounded-full px-4 text-sm font-medium transition", on ? "bg-ink text-white" : "bg-surface-3 hover:bg-line")}>{l} دیگر</button>;
        })}
      </div>
      <p className="text-[13px] text-ink-3">۳۰ روز قبل از انقضا هشدار می‌گیرید و پس از انقضا حساب موقتاً معلق می‌شود.</p>
    </div>
  );
}

export function KycWizard() {
  const router = useRouter();
  const { driver, standing } = useApp();
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (driver?.kyc === "rejected") setEditing(true); }, [driver?.kyc]);

  const veh = driver?.vehicle;
  const done = (k: DocKey) => !!driver?.docs[k]?.dataUrl;
  const missing = REQUIRED_DOCS.filter((k) => !done(k));

  /* Non-editing states */
  if (driver && !editing && (driver.kyc === "pending" || driver.kyc === "verified")) {
    const ex = expiryStatus(driver);
    return (
      <div className="space-y-4">
        <Card className="animate-rise space-y-3 p-6 text-center">
          <span className={cx("mx-auto grid size-16 place-items-center rounded-full", standing === "verified" ? "bg-ok-bg text-ok" : standing === "suspended" ? "bg-danger-bg text-danger" : "bg-accent-50 text-accent-600")}>
            {driver.kyc === "pending" ? <Clock className="size-8" /> : <BadgeCheck className="size-8" />}
          </span>
          <VerificationBadge standing={standing} />
          <h2 className="text-xl font-black">{driver.kyc === "pending" ? "مدارک شما در حال بررسی است" : standing === "suspended" ? "حساب شما معلق است" : "حساب راننده‌ی شما تأیید شده است"}</h2>
          <p className="text-sm leading-7 text-ink-3">{driver.kyc === "pending" ? "تیم کامیونت معمولاً کمتر از ۲۴ ساعت مدارک را بررسی می‌کند. نتیجه را از طریق اعلان‌ها می‌گیرید." : "می‌توانید سفارش انتخاب کنید. تاریخ انقضای مدارک زیر را زیر نظر داشته باشید."}</p>
        </Card>
        {driver.kyc === "verified" && (
          <Card className="space-y-5 p-5">
            <h3 className="font-bold">تمدید مدارک</h3>
            {ex.items.map((i) => (
              <div key={i.key} className="space-y-3 rounded-ui border border-line p-4">
                <div className="flex items-center justify-between">
                  <b>{i.label}</b>
                  <span className={cx("text-sm font-bold", (i.days ?? 99) < 0 ? "text-danger" : (i.days ?? 99) <= 30 ? "text-warn" : "text-ok")}>
                    {(i.days ?? 99) < 0 ? "منقضی شده" : `${fa(i.days ?? 0)} روز تا انقضا`}
                  </span>
                </div>
                <Doc k={i.key} />
                <Expiry k={i.key as "insurance" | "inspection"} />
              </div>
            ))}
          </Card>
        )}
        <Button block variant="secondary" onClick={() => router.push("/driver/")}>رفتن به بازار بار</Button>
      </div>
    );
  }

  const next = () => {
    setErr("");
    const need: Record<number, DocKey[]> = { 0: ["nationalFront", "nationalBack", "license", "smartCard", "selfie"], 1: ["regFront", "regBack", "carExterior"], 2: ["insurance", "inspection"], 3: ["carInterior"] };
    const m = (need[step] ?? []).filter((k) => !done(k));
    if (m.length) return setErr(`بارگذاری این موارد باقی مانده: ${m.map((k) => DOC_LABEL[k]).join("، ")}`);
    if (step === 1 && !veh?.plate.trim()) return setErr("پلاک خودرو را وارد کنید.");
    if (step === 2 && (!driver?.docs.insurance?.expiresAt || !driver?.docs.inspection?.expiresAt)) return setErr("تاریخ انقضای بیمه و معاینه فنی را انتخاب کنید.");
    if (step === 3 && !veh?.fridgeBrand.trim()) return setErr("برند و مدل یخچال را وارد کنید.");
    if (step === 3 && !veh?.lastServiceAt) return setErr("تاریخ آخرین سرویس یخچال را انتخاب کنید.");
    setStep(step + 1);
  };

  const submit = () => {
    const r = submitKyc();
    if (!r.ok) return setErr(r.error);
    setEditing(false);
    toast("مدارک ارسال شد و در صف بررسی قرار گرفت");
  };

  return (
    <div className="space-y-5">
      {driver?.kyc === "rejected" && <Card className="bg-danger-bg p-4 text-sm leading-7 text-danger shadow-none"><b>نیاز به اصلاح:</b> {driver.rejectReason}</Card>}
      <Stepper steps={STEPS} current={step} />
      <Card className="animate-rise space-y-5 p-5 sm:p-6" key={step}>
        {step === 0 && (
          <>
            <div><h2 className="text-lg font-black">مدارک هویتی</h2><p className="mt-1 text-sm text-ink-3">تصاویر واضح و کامل بارگذاری کنید. این مرحله فقط یک‌بار لازم است.</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Doc k="nationalFront" /><Doc k="nationalBack" /><Doc k="license" /><Doc k="smartCard" hint="الزام قانونی" /><Doc k="selfie" hint="کارت ملی کنار صورت" />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2 className="text-lg font-black">مشخصات خودرو</h2>
            <Field label="نوع خودرو (یخچال‌دار)">{() => <Segmented<VehicleType> value={veh?.type ?? "truck"} onChange={(t) => saveDriver({ vehicle: { type: t } })} options={(Object.keys(VEHICLES) as VehicleType[]).map((k) => ({ value: k, label: VEHICLES[k].replace(" یخچال‌دار", "") }))} />}</Field>
            <Field label="پلاک خودرو">{(id) => <Input id={id} value={veh?.plate ?? ""} placeholder="مثلاً ۱۲ ب ۳۴۵ ایران ۶۸" onChange={(e) => saveDriver({ vehicle: { plate: e.target.value } })} />}</Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Doc k="regFront" /><Doc k="regBack" /><Doc k="carExterior" /></div>
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="text-lg font-black">بیمه و معاینه‌ی فنی</h2>
            {(["insurance", "inspection"] as const).map((k) => (
              <div key={k} className="grid gap-4 rounded-ui border border-line p-4 sm:grid-cols-[180px_1fr]"><Doc k={k} /><div className="flex items-center"><Expiry k={k} /></div></div>
            ))}
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="text-lg font-black">سیستم برودتی</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Doc k="carInterior" hint="داخل باکس یخچالی" /></div>
            <Field label="برند و مدل دستگاه یخچال">{(id) => <Input id={id} value={veh?.fridgeBrand ?? ""} placeholder="مثلاً Thermo King T-600" onChange={(e) => saveDriver({ vehicle: { fridgeBrand: e.target.value } })} />}</Field>
            <div className="space-y-2 rounded-ui bg-surface-2 p-4">
              <div className="flex items-center justify-between text-sm"><span className="font-medium text-ink-2">کمترین دمای قابل‌دستیابی یخچال</span><b className="tabular text-lg" dir="ltr">{degrees(veh?.minTemp ?? 0)}</b></div>
              <input type="range" min={-30} max={8} value={veh?.minTemp ?? 0} onChange={(e) => saveDriver({ vehicle: { minTemp: +e.target.value } })} className="w-full" aria-label="کمترین دمای یخچال" />
              <p className="flex items-start gap-2 text-[13px] leading-6 text-ink-3">
                {(veh?.minTemp ?? 0) <= -18 ? <Snowflake className="mt-0.5 size-4 shrink-0 text-accent-600" /> : <ThermometerSnowflake className="mt-0.5 size-4 shrink-0" />}
                {(veh?.minTemp ?? 0) <= -18 ? "یخچال انجماد: هم بار انجمادی و هم بار سردخانه‌ای به شما نمایش داده می‌شود." : "یخچال سردخانه‌ای: فقط بارهایی که دمای مجازشان بالاتر از این عدد است به شما نمایش داده می‌شود."}
              </p>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-ink-2">آخرین سرویس یخچال {veh?.lastServiceAt && <b className="ms-1 text-ink">· {jNum(veh.lastServiceAt)}</b>}</span>
              <div className="flex flex-wrap gap-2">
                {[["این ماه", 10], ["۳ ماه پیش", 90], ["۶ ماه پیش", 180], ["۱ سال پیش", 365]].map(([l, d]) => (
                  <button key={l} type="button" onClick={() => saveDriver({ vehicle: { lastServiceAt: Date.now() - (d as number) * DAY } })} className="h-9 rounded-full bg-surface-3 px-4 text-sm font-medium hover:bg-line">{l}</button>
                ))}
              </div>
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="text-lg font-black">مرور نهایی</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {REQUIRED_DOCS.map((k) => (
                <li key={k} className="flex items-center gap-2 text-sm">{done(k) ? <CheckCircle2 className="size-5 text-ok" /> : <Circle className="size-5 text-ink-4" />}{DOC_LABEL[k]}</li>
              ))}
            </ul>
            <p className="rounded-ui bg-accent-50 p-3 text-[13px] leading-6 text-accent-700">پس از ارسال، مدارک شما توسط تیم کامیونت بررسی می‌شود. تا آن زمان می‌توانید بارها را ببینید ولی دکمه‌ی انتخاب سفارش غیرفعال است.</p>
            {missing.length > 0 && <p className="text-sm font-medium text-warn">{fa(missing.length)} مدرک هنوز بارگذاری نشده است.</p>}
          </>
        )}
        {err && <p role="alert" className="text-sm font-medium text-danger">{err}</p>}
      </Card>
      <div className="flex items-center justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => { setErr(""); setStep(step - 1); }}><ArrowRight className="size-4" />قبلی</Button>
        {step < 4 ? <Button onClick={next}>مرحله‌ی بعد<ArrowLeft className="size-4" /></Button> : <Button size="lg" onClick={submit}>ارسال برای بررسی</Button>}
      </div>
    </div>
  );
}
