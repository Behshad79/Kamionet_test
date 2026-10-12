"use client";

import { Radio } from "lucide-react";
import { useState } from "react";
import { PlaceCombobox } from "../inputs";
import { JalaliDateTimePicker } from "../pickers";
import { toast } from "../Toaster";
import { Badge, Button, Card, Field, NumInput, Segmented, Sheet, Textarea, Toggle } from "../ui";
import { announce, cancelAvailability, driverTimes } from "@/lib/engine/avail";
import { fa, jShort, hhmm, toman } from "@/lib/format";
import { R } from "@/lib/money";
import { act } from "@/lib/store";
import { vehicleTitle } from "@/lib/vehicles";
import { useStore } from "@/lib/store";
import type { Availability, CargoKind, PayTerms, State } from "@/lib/types";

const KINDS: [CargoKind, string][] = [["dairy", "لبنیات"], ["meat", "گوشت"], ["fish", "ماهی"], ["produce", "میوه و سبزی"], ["icecream", "بستنی"], ["pharma", "دارو"], ["dry", "خشک‌بار"]];
const TERMS: [PayTerms, string][] = [["PREPAID", "پیش‌پرداخت کامل"], ["DEPOSIT_BALANCE_BEFORE_LOADING", "بیعانه + مابقی قبل از بارگیری"], ["DEPOSIT_BALANCE_AFTER_DELIVERY", "بیعانه + مابقی بعد از تحویل"], ["CASH_BALANCE_TO_DRIVER", "بخشی نقد به من"]];

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-10 rounded-full border-2 px-3 text-sm font-bold ${on ? "border-act bg-act-soft text-act-ink" : "border-line bg-white text-ink-2"}`}>{children}</button>;
const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * One announcement for both «I'm free here» and «I'm heading there / coming back»: area or route, time window, price range, load size,
 * cargo, payment terms and personal conditions. Matching loads then appear in «بار سر راه من» and shippers see the driver.
 */
export function AvailSheet({ open, onClose, pid }: { open: boolean; onClose: () => void; pid: string }) {
  const s = useStore();
  const d = s.drivers.find((x) => x.personId === pid);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [addTo, setAddTo] = useState("");
  const [fromAt, setFromAt] = useState(Date.now() + 3_600_000);
  const [until, setUntil] = useState(Date.now() + 36 * 3_600_000);
  const [min, setMin] = useState<number | undefined>();
  const [max, setMax] = useState<number | undefined>();
  const [wMin, setWMin] = useState<number | undefined>();
  const [wMax, setWMax] = useState<number | undefined>();
  const [mode, setMode] = useState<"REFRIGERATED" | "AMBIENT" | "BOTH">(d?.vehicle.minTemp === null ? "AMBIENT" : "REFRIGERATED");
  const [kinds, setKinds] = useState<CargoKind[]>([]);
  const [terms, setTerms] = useState<PayTerms[]>([]);
  const [detour, setDetour] = useState<number | undefined>(25);
  const [help, setHelp] = useState(false);
  const [wait, setWait] = useState<number | undefined>(1);
  const [note, setNote] = useState("");
  const [auto, setAuto] = useState(false);
  const v = d?.vehicle;
  return (
    <Sheet open={open} onClose={onClose} title="بار سر راه من" wide footer={<Button block disabled={!from || !min} onClick={() => { const r = act((st) => announce(st, pid, { from, to, fromAt, until, minFreight: R(min ?? 0), maxFreight: max ? R(max) : undefined, minWeightKg: wMin, maxWeightKg: wMax, cargoMode: mode, cargoKinds: kinds, terms, detourKm: detour, helpsLoading: help, waitHours: wait, note, acceptAuto: auto })); toast(r.ok ? "مسیر شما ثبت شد؛ بارهای مناسب در «بار سر راه من» نمایش داده می‌شود." : r.error, r.ok ? "ok" : "err"); if (r.ok) onClose(); }}>شروع جست‌وجوی بار</Button>}>
      <div className="space-y-5">
        <p className="text-sm leading-7 text-ink-3">بگویید از کجا تا کجا می‌روید (یا کجا آزادید)، چه موقع، با چه قیمتی و چه باری می‌برید. بارهای مناسب را سر راهتان پیدا می‌کنیم و صاحبان بار هم شما را می‌بینند.</p>
        {v && <div className="rounded-ui bg-surface-2 p-3 text-sm leading-7"><b>خودروی من:</b> {vehicleTitle(v)} · ظرفیت {fa(v.capacityKg)} کیلوگرم · {v.minTemp === null ? "بدون یخچال" : `یخچال تا ${fa(v.minTemp)}°`}{v.thermo?.connected ? " · سنسور متصل" : ""}</div>}

        <section className="space-y-3"><h3 className="font-extrabold">مسیر و زمان</h3>
          <PlaceCombobox label="از (شهر)" value={from} onSelect={(p) => setFrom(p?.name ?? "")} />
          <div className="space-y-2"><PlaceCombobox label="به (چند مقصد؛ خالی = هر مقصد)" value={addTo} onSelect={(p) => { const c = p?.name; if (c && !to.includes(c)) setTo([...to, c]); setAddTo(""); }} />{to.length > 0 && <div className="flex flex-wrap gap-2">{to.map((c) => <button key={c} onClick={() => setTo(to.filter((x) => x !== c))} aria-label={`حذف ${c}`} className="min-h-9 rounded-full bg-act-soft px-3 text-sm font-bold">{c} ×</button>)}</div>}</div>
          <div className="grid gap-3 sm:grid-cols-2"><JalaliDateTimePicker label="از زمان" value={fromAt} onChange={setFromAt} min={Date.now()} /><JalaliDateTimePicker label="تا زمان" value={until} onChange={setUntil} min={fromAt} /></div>
          <Field label="حداکثر انحراف از مسیر برای بارگیری (کیلومتر)">{(id) => <NumInput id={id} value={detour} onChange={setDetour} suffix="کیلومتر" />}</Field></section>

        <section className="space-y-3"><h3 className="font-extrabold">قیمت و حجم بار</h3>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="حداقل کرایه (تومان)">{(id) => <NumInput id={id} value={min} onChange={setMin} suffix="تومان" />}</Field><Field label="حداکثر کرایه (اختیاری)" hint="خالی = بدون سقف">{(id) => <NumInput id={id} value={max} onChange={setMax} suffix="تومان" />}</Field>
            <Field label="کمترین وزن بار (کیلوگرم)">{(id) => <NumInput id={id} value={wMin} onChange={setWMin} suffix="کیلوگرم" />}</Field><Field label="بیشترین وزن بار" hint={v ? `ظرفیت خودرو ${fa(v.capacityKg)}` : undefined}>{(id) => <NumInput id={id} value={wMax} onChange={setWMax} suffix="کیلوگرم" />}</Field></div></section>

        <section className="space-y-3"><h3 className="font-extrabold">چه باری می‌برم؟</h3>
          <Segmented<"REFRIGERATED" | "AMBIENT" | "BOTH"> value={mode} onChange={setMode} options={[{ value: "REFRIGERATED", label: "یخچالی", sub: v?.minTemp === null ? "یخچال ندارم" : `تا ${fa(v?.minTemp ?? 0)}°` }, { value: "AMBIENT", label: "غیریخچالی" }, { value: "BOTH", label: "هر دو" }]} />
          <div><div className="mb-1.5 text-sm font-medium text-ink-2">نوع بار (خالی = همه)</div><div className="flex flex-wrap gap-2">{KINDS.map(([k, l]) => <Chip key={k} on={kinds.includes(k)} onClick={() => setKinds(flip(kinds, k))}>{l}</Chip>)}</div></div>
          <div><div className="mb-1.5 text-sm font-medium text-ink-2">شرایط پرداخت قابل‌قبول (خالی = همه)</div><div className="flex flex-wrap gap-2">{TERMS.map(([k, l]) => <Chip key={k} on={terms.includes(k)} onClick={() => setTerms(flip(terms, k))}>{l}</Chip>)}</div></div></section>

        <section className="space-y-3"><h3 className="font-extrabold">شرایط من</h3>
          <div className="flex items-center justify-between gap-3 rounded-ui bg-surface-2 p-4"><div className="font-bold">در بارگیری و تخلیه کمک می‌کنم</div><Toggle label="کمک در بارگیری" checked={help} onChange={setHelp} /></div>
          <Field label="تا چند ساعت انتظار را می‌پذیرم">{(id) => <NumInput id={id} value={wait} onChange={setWait} suffix="ساعت" />}</Field>
          <Field label="توضیح دیگر (اختیاری)">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: بار شکستنی نمی‌برم" />}</Field>
          <div className="flex items-center justify-between gap-3 rounded-ui bg-surface-2 p-4"><div><div className="font-bold">پذیرش خودکار بار مناسب</div><div className="text-xs leading-6 text-ink-3">اگر صاحب بار «انتخاب خودکار» را بزند، بدون تأیید دستی بار برای شما رزرو می‌شود.</div></div><Toggle label="پذیرش خودکار" checked={auto} onChange={setAuto} /></div></section>
      </div>
    </Sheet>
  );
}

const MODE_L = { REFRIGERATED: "یخچالی", AMBIENT: "غیریخچالی", BOTH: "یخچالی و غیریخچالی" } as const;
export function AvailLine({ a, full }: { a: Availability; full?: boolean }) {
  return (
    <>
      {a.from} ← {a.to.length ? a.to.join("، ") : "هر مقصد"} · تا {jShort(a.until)}، {hhmm(a.until)} · کرایه از {toman(a.minFreight)}{a.maxFreight ? ` تا ${toman(a.maxFreight)}` : ""}
      {full && <span className="mt-1 block text-xs leading-6 text-ink-3">
        {a.cargoMode ? `${MODE_L[a.cargoMode]}` : ""}{a.minWeightKg || a.maxWeightKg ? ` · وزن ${a.minWeightKg ? fa(a.minWeightKg) : "۰"} تا ${a.maxWeightKg ? fa(a.maxWeightKg) : "ظرفیت"} کیلو` : ""}{a.cargoKinds?.length ? ` · ${a.cargoKinds.map((k) => KINDS.find((x) => x[0] === k)?.[1]).join("، ")}` : ""}{a.detourKm ? ` · انحراف تا ${fa(a.detourKm)} کیلومتر` : ""}{a.helpsLoading ? " · کمک در بارگیری" : ""}{a.waitHours ? ` · انتظار تا ${fa(a.waitHours)} ساعت` : ""}{a.terms?.length ? ` · پرداخت: ${a.terms.map((k) => TERMS.find((x) => x[0] === k)?.[1]).join("، ")}` : ""}
      </span>}
    </>
  );
}

export function MyAvailability({ s, pid }: { s: State; pid: string }) {
  const mine = s.availabilities.filter((a) => a.driverId === pid && a.active && a.until > Date.now());
  if (mine.length === 0) return null;
  return (
    <Card className="space-y-2 border border-ok/30 bg-ok-bg p-4">
      <div className="flex items-center gap-2 font-extrabold text-ok"><Radio className="size-5" aria-hidden />مسیرهای فعال شما</div>
      {mine.map((a) => <div key={a.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 leading-7"><AvailLine a={a} full />{a.acceptAuto && <Badge tone="ok" className="ms-2">خودکار</Badge>}</span><Button size="sm" variant="secondary" onClick={() => act((x) => cancelAvailability(x, pid, a.id))}>لغو</Button></div>)}
    </Card>
  );
}

export function TimesChip({ s, pid }: { s: State; pid: string }) {
  const t = driverTimes(s, pid);
  if (t.n === 0) return null;
  return <span className="text-xs text-ink-3">میانگین رسیدن به مبدأ {fa(Math.round(t.toPickupMin ?? 0))} دقیقه{t.legHours ? ` · مسیر بارگیری‌شده ${fa(Math.round(t.legHours * 10) / 10)} ساعت` : ""}</span>;
}
