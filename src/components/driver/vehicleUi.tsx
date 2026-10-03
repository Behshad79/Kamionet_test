"use client";

import { CheckCircle2, CircleAlert, LifeBuoy, Radio, Thermometer } from "lucide-react";
import { toast } from "../Toaster";
import { Button, Card, Field, Input, Select } from "../ui";
import { connectSensor, requestSensorHelp, SENSOR_BONUS_XP } from "@/lib/engine/kyc";
import { fa } from "@/lib/format";
import { act, useStore } from "@/lib/store";
import { cv } from "@/lib/config";
import { MAKES, THERMO_KINDS, vehicleFit, vehicleTitle, VEHICLES } from "@/lib/vehicles";
import type { Order, Thermo, Vehicle } from "@/lib/types";

const nfa = (n: number) => new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(n);

export function SensorBadge({ className }: { className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-extrabold text-accent-700 ring-1 ring-accent-600/20 ${className ?? ""}`}><Radio className="size-3.5" aria-hidden />سنسور کامیونت متصل</span>;
}

/** Thermometer type + brand (shown for refrigerated units only). */
export function ThermoFields({ value, onChange }: { value: Thermo | undefined; onChange: (t: Thermo) => void }) {
  const t = value ?? { kind: "none" as const, connected: false };
  return (
    <div className="space-y-3">
      <Field label="دماسنج داخل باکس یخچال">{(id) => <Select id={id} value={value ? t.kind : ""} onChange={(e) => onChange({ ...t, kind: e.target.value as Thermo["kind"], connected: e.target.value === "none" ? false : t.connected })}><option value="" disabled>انتخاب کنید…</option>{THERMO_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select>}</Field>
      {value && t.kind !== "none" && <Field label="برند یا مدل دماسنج">{(id) => <Input id={id} value={t.brand ?? ""} onChange={(e) => onChange({ ...t, brand: e.target.value })} placeholder="مثلاً Elitech RC-4" />}</Field>}
    </div>
  );
}

/** Explains the sensor programme and lets the driver link (or ask for help). Used in KYC and on the profile. */
export function SensorCard({ pid, thermo, persist }: { pid: string; thermo?: Thermo; persist?: Thermo }) {
  const t = thermo;
  const on = cv<boolean>(useStore(), "feature.sensor");
  /** In the KYC wizard the thermometer answer isn't saved until the step is submitted, so save it before linking. */
  const save = () => { if (persist) act((s) => { const d = s.drivers.find((x) => x.personId === pid); if (d) d.vehicle.thermo = { ...persist, connected: d.vehicle.thermo?.connected ?? false, helpRequested: d.vehicle.thermo?.helpRequested }; }); };
  if (!on) return null;
  if (!t || t.kind === "none") {
    return <Card className="space-y-2 p-4 text-sm leading-7"><div className="flex items-center gap-2 font-extrabold"><Thermometer className="size-5 text-accent-600" aria-hidden />دماسنج ندارید؟</div><p className="text-ink-3">با نصب دیتالاگر دما می‌توانید به سنسور کامیونت وصل شوید، امتیاز بگیرید و بالاتر از بقیه نمایش داده شوید.</p></Card>;
  }
  if (t.connected) return <Card className="flex items-start gap-3 border border-ok/30 bg-ok-bg p-4 text-sm leading-7"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden /><div><div className="font-extrabold text-ok">دماسنج شما به کامیونت وصل است</div><p className="text-ink-2">صاحبان بار دمای لحظه‌ای بارشان را از دماسنج شما می‌بینند. نشان «سنسور متصل» روی پروفایل شما هست و در فهرست‌ها بالاتر نمایش داده می‌شوید.</p></div></Card>;
  return (
    <Card className="space-y-3 border-2 border-accent-600/30 p-4">
      <div className="flex items-center gap-2 font-extrabold"><Radio className="size-5 text-accent-600" aria-hidden />دماسنج خود را به سنسور کامیونت وصل کنید</div>
      <ul className="space-y-1 text-sm leading-7 text-ink-2"><li>+{fa(SENSOR_BONUS_XP)} امتیاز مسیر پرو</li><li>نشان «سنسور کامیونت متصل» روی پروفایل</li><li>نمایش بالاتر در فهرست رانندگان و شانس بیشتر در انتخاب هوشمند</li></ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => { save(); const r = act((s) => connectSensor(s, pid)); toast(r.ok ? "دماسنج متصل شد." : r.error, r.ok ? "ok" : "err"); }}>اتصال به سنسور کامیونت</Button>
        <Button size="sm" variant="secondary" disabled={t.helpRequested} onClick={() => { save(); const r = act((s) => requestSensorHelp(s, pid)); toast(r.ok ? "درخواست راهنمایی ثبت شد؛ پشتیبانی با شما تماس می‌گیرد." : r.error, r.ok ? "ok" : "err"); }}><LifeBuoy className="size-4" aria-hidden />{t.helpRequested ? "درخواست راهنمایی ثبت شد" : "بلد نیستم، راهنمایی می‌خواهم"}</Button>
      </div>
    </Card>
  );
}

/** Spec sheet of the truck exactly as the driver typed it. */
export function VehicleSpecs({ v, hideTitle }: { v: Vehicle; hideTitle?: boolean }) {
  const rows: [string, string | undefined][] = [
    ["خودرو", vehicleTitle(v)], ["نوع", VEHICLES[v.kind].label], ["ظرفیت", `${fa(v.capacityKg)} کیلوگرم`], ["طول باکس", v.bodyLengthM ? `${fa(v.bodyLengthM)} متر` : undefined],
    ["یخچال", v.minTemp === null ? "بدون یخچال" : [v.fridgeBrand, v.fridgeModel, v.fridgeYear ? `مدل ${nfa(v.fridgeYear)}` : ""].filter((x) => x && x !== "—").join(" · ")],
    ["کمترین دما", v.minTemp === null ? undefined : `${fa(v.minTemp)}°`],
    ["دماسنج", v.minTemp === null ? undefined : v.thermo ? `${THERMO_KINDS.find((k) => k.id === v.thermo!.kind)?.label ?? "—"}${v.thermo.brand ? ` · ${v.thermo.brand}` : ""}` : "—"],
    ["بار غیریخچالی", v.canRunAmbient ? "می‌برد" : "نمی‌برد"],
  ];
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">{rows.filter(([k, x]) => x && !(hideTitle && k === "خودرو")).map(([k, x]) => <div key={k} className={k === "خودرو" ? "col-span-2" : ""}><dt className="text-ink-3">{k}</dt><dd className="font-bold">{x}</dd></div>)}</dl>;
}

/** «Is this truck right for my load?» for the shipper, on the assignment card. */
export function FitList({ v, o }: { v: Vehicle; o: Order }) {
  const checks = vehicleFit(v, o);
  return <ul className="space-y-1.5 rounded-ui bg-surface-2 p-3 text-sm">{checks.map((c) => <li key={c.label} className={`flex items-start gap-2 ${c.ok ? "text-ink-2" : "font-bold text-warn"}`}>{c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}{c.label}</li>)}</ul>;
}

export interface VehicleInfo { make?: string; modelName?: string; year?: number; bodyLengthM?: number; fridgeModel?: string; fridgeYear?: number; thermo?: Thermo }
const YEARS = Array.from({ length: 22 }, (_, i) => 1405 - i);

/** Exact make/model/year (typed by the driver), box length and, for refrigerated units, fridge model + thermometer. */
export function VehicleInfoFields({ kind, fridge, value, onChange }: { kind: Vehicle["kind"]; fridge: boolean; value: VehicleInfo; onChange: (v: VehicleInfo) => void }) {
  const makes = MAKES[kind];
  const other = !!value.make && !makes.some((m) => m.make === value.make);
  const models = makes.find((m) => m.make === value.make)?.models ?? [];
  const set = (p: Partial<VehicleInfo>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-4 rounded-ui bg-surface-2 p-4">
      <div><div className="font-extrabold">مشخصات دقیق خودرو</div><p className="text-xs leading-6 text-ink-3">این اطلاعات به صاحب بار نشان داده می‌شود تا بفهمد خودروی شما برای باری که دارد مناسب است یا نه.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="سازنده">{(id) => <Select id={id} value={other ? "__other" : value.make ?? ""} onChange={(e) => set({ make: e.target.value === "__other" ? " " : e.target.value, modelName: "" })}><option value="" disabled>انتخاب…</option>{makes.map((m) => <option key={m.make} value={m.make}>{m.make}</option>)}<option value="__other">سایر</option></Select>}</Field>
        {other && <Field label="نام سازنده">{(id) => <Input id={id} value={value.make?.trim() ?? ""} onChange={(e) => set({ make: e.target.value || " " })} />}</Field>}
        <Field label="مدل دقیق" hint="مثلاً «NPR ۷۵ سقف بلند»">{(id) => <><Input id={id} list={`${id}-models`} value={value.modelName ?? ""} onChange={(e) => set({ modelName: e.target.value })} /><datalist id={`${id}-models`}>{models.map((m) => <option key={m} value={m} />)}</datalist></>}</Field>
        <Field label="سال ساخت (شمسی)">{(id) => <Select id={id} value={value.year ?? ""} onChange={(e) => set({ year: +e.target.value })}><option value="" disabled>انتخاب…</option>{YEARS.map((y) => <option key={y} value={y}>{nfa(y)}</option>)}</Select>}</Field>
        <Field label="طول باکس بار (متر)">{(id) => <Input id={id} inputMode="decimal" value={value.bodyLengthM ?? ""} onChange={(e) => set({ bodyLengthM: Number(e.target.value.replace(/[^\d.]/g, "")) || undefined })} />}</Field>
      </div>
      {fridge && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="مدل دستگاه یخچال">{(id) => <Input id={id} value={value.fridgeModel ?? ""} onChange={(e) => set({ fridgeModel: e.target.value })} placeholder="مثلاً T-600R" />}</Field>
            <Field label="سال ساخت یخچال">{(id) => <Select id={id} value={value.fridgeYear ?? ""} onChange={(e) => set({ fridgeYear: +e.target.value })}><option value="" disabled>انتخاب…</option>{YEARS.map((y) => <option key={y} value={y}>{nfa(y)}</option>)}</Select>}</Field>
          </div>
          <ThermoFields value={value.thermo} onChange={(thermo) => set({ thermo })} />
        </>
      )}
    </div>
  );
}
