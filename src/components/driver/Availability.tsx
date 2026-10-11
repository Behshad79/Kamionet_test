"use client";

import { Radio } from "lucide-react";
import { useState } from "react";
import { PlaceCombobox } from "../inputs";
import { JalaliDateTimePicker } from "../pickers";
import { toast } from "../Toaster";
import { Badge, Button, Card, Field, NumInput, Sheet, Textarea, Toggle } from "../ui";
import { announce, cancelAvailability, driverTimes } from "@/lib/engine/avail";
import { fa, jShort, hhmm, toman } from "@/lib/format";
import { R } from "@/lib/money";
import { act } from "@/lib/store";
import type { Availability, State } from "@/lib/types";

/** «I'm free» announcement: route, window, minimum freight, conditions, and whether matching loads are accepted automatically. */
export function AvailSheet({ open, onClose, pid }: { open: boolean; onClose: () => void; pid: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [addTo, setAddTo] = useState("");
  const [fromAt, setFromAt] = useState(Date.now() + 3_600_000);
  const [until, setUntil] = useState(Date.now() + 36 * 3_600_000);
  const [min, setMin] = useState<number | undefined>();
  const [note, setNote] = useState("");
  const [auto, setAuto] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="اعلام آزادی" footer={<Button block disabled={!from || !min} onClick={() => { const r = act((s) => announce(s, pid, { from, to, fromAt, until, minFreight: R(min ?? 0), note, acceptAuto: auto })); toast(r.ok ? "آزادی شما برای صاحبان بار نمایش داده می‌شود." : r.error, r.ok ? "ok" : "err"); if (r.ok) onClose(); }}>ثبت و نمایش به صاحبان بار</Button>}>
      <div className="space-y-4">
        <p className="text-sm leading-7 text-ink-3">بگویید از کجا و با چه شرایطی آزادید. صاحبان بار شما را می‌بینند و اگر باری مناسب ثبت شود، همان لحظه به شما پیشنهاد می‌شود.</p>
        <PlaceCombobox label="آزاد از (شهر مبدأ)" value={from} onSelect={(p) => setFrom(p?.name ?? "")} />
        <div className="space-y-2"><PlaceCombobox label="مقصدهای دلخواه (خالی = هر مقصد)" value={addTo} onSelect={(p) => { const c = p?.name; if (c && !to.includes(c)) setTo([...to, c]); setAddTo(""); }} />
          {to.length > 0 && <div className="flex flex-wrap gap-2">{to.map((c) => <button key={c} onClick={() => setTo(to.filter((x) => x !== c))} aria-label={`حذف ${c}`} className="min-h-9 rounded-full bg-act-soft px-3 text-sm font-bold">{c} ×</button>)}</div>}</div>
        <JalaliDateTimePicker label="آزاد از زمان" value={fromAt} onChange={setFromAt} min={Date.now()} />
        <JalaliDateTimePicker label="آزاد تا زمان" value={until} onChange={setUntil} min={fromAt} />
        <Field label="حداقل کرایه‌ی قابل‌قبول (تومان)">{(id) => <NumInput id={id} value={min} onChange={setMin} suffix="تومان" />}</Field>
        <Field label="شرایط من (اختیاری)">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: بدون انتظار بیش از یک ساعت" />}</Field>
        <div className="flex items-center justify-between gap-3 rounded-ui bg-surface-2 p-4"><div><div className="font-bold">پذیرش خودکار بار مناسب</div><div className="text-xs leading-6 text-ink-3">اگر صاحب بار «انتخاب خودکار» را بزند، بدون تأیید دستی بار برای شما رزرو می‌شود.</div></div><Toggle label="پذیرش خودکار" checked={auto} onChange={setAuto} /></div>
      </div>
    </Sheet>
  );
}

export function AvailLine({ a }: { a: Availability }) {
  return <>{a.from} ← {a.to.length ? a.to.join("، ") : "هر مقصد"} · تا {jShort(a.until)}، {hhmm(a.until)} · از {toman(a.minFreight)}</>;
}

export function MyAvailability({ s, pid }: { s: State; pid: string }) {
  const mine = s.availabilities.filter((a) => a.driverId === pid && a.active && a.until > Date.now());
  if (mine.length === 0) return null;
  return (
    <Card className="space-y-2 border border-ok/30 bg-ok-bg p-4">
      <div className="flex items-center gap-2 font-extrabold text-ok"><Radio className="size-5" aria-hidden />آزادی‌های فعال شما</div>
      {mine.map((a) => <div key={a.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 leading-7"><AvailLine a={a} />{a.acceptAuto && <Badge tone="ok" className="ms-2">خودکار</Badge>}</span><Button size="sm" variant="secondary" onClick={() => act((x) => cancelAvailability(x, pid, a.id))}>لغو</Button></div>)}
    </Card>
  );
}

export function TimesChip({ s, pid }: { s: State; pid: string }) {
  const t = driverTimes(s, pid);
  if (t.n === 0) return null;
  return <span className="text-xs text-ink-3">میانگین رسیدن به مبدأ {fa(Math.round(t.toPickupMin ?? 0))} دقیقه{t.legHours ? ` · مسیر بارگیری‌شده ${fa(Math.round(t.legHours * 10) / 10)} ساعت` : ""}</span>;
}
