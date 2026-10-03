"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useState } from "react";
import { fa } from "@/lib/format";
import { JALALI_MONTHS, WEEKDAYS_SHORT, fromJalali, jalaliMonthLength, jalaliParts, monthGrid } from "@/lib/jalali";
import { Sheet, cx } from "./ui";

const fmt = (ts: number, time: boolean) => {
  const p = jalaliParts(ts);
  const d = `${fa(p.jd)} ${JALALI_MONTHS[p.jm - 1]} ${fa(p.jy)}`;
  return time ? `${d}، ${String(p.h).padStart(2, "0").replace(/\d/g, (x) => fa(+x))}:${String(p.mi).padStart(2, "0").replace(/\d/g, (x) => fa(+x))}` : d;
};

/** Jalali calendar (Saturday-first). `value` is a timestamp; time part is preserved. */
export function JalaliDateTimePicker({ label, value, onChange, min, withTime = true, error }: { label: string; value: number; onChange: (ts: number) => void; min?: number; withTime?: boolean; error?: string }) {
  const [open, setOpen] = useState(false);
  const cur = jalaliParts(value);
  const [view, setView] = useState({ y: cur.jy, m: cur.jm });
  const today = jalaliParts(Date.now());
  const minP = min ? jalaliParts(min) : undefined;
  const before = (y: number, m: number, d: number) => !!minP && (y < minP.jy || (y === minP.jy && (m < minP.jm || (m === minP.jm && d < minP.jd))));
  const [h, setH] = useState(cur.h);
  const [mi, setMi] = useState(cur.mi);
  const nav = (n: number) => setView((v) => { const t = v.m - 1 + n; return { y: v.y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 + 1 }; });
  const pick = (d: number) => { onChange(fromJalali(view.y, view.m, d, h, mi)); if (!withTime) setOpen(false); };
  const setTime = (nh: number, nmi: number) => { setH(nh); setMi(nmi); onChange(fromJalali(cur.jy, cur.jm, cur.jd, nh, nmi)); };
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-ink-2">{label}</div>
      <button type="button" onClick={() => { setView({ y: cur.jy, m: cur.jm }); setH(cur.h); setMi(cur.mi); setOpen(true); }} aria-haspopup="dialog"
        className={cx("flex h-12 w-full items-center justify-between gap-2 rounded-ui border bg-white px-4 text-[15px]", error ? "border-danger" : "border-line")}>
        <span>{fmt(value, withTime)}</span><CalendarDays className="size-5 text-ink-3" aria-hidden />
      </button>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      <Sheet open={open} onClose={() => setOpen(false)} title={label}
        footer={<button onClick={() => setOpen(false)} className="h-12 w-full rounded-ui bg-brand-500 font-bold">تأیید</button>}>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => nav(-1)} aria-label="ماه قبل" className="grid size-11 place-items-center rounded-full hover:bg-surface-3"><ChevronRight className="size-5" /></button>
          <div className="font-black">{JALALI_MONTHS[view.m - 1]} {fa(view.y)}</div>
          <button type="button" onClick={() => nav(1)} aria-label="ماه بعد" className="grid size-11 place-items-center rounded-full hover:bg-surface-3"><ChevronLeft className="size-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink-3">{WEEKDAYS_SHORT.map((w) => <div key={w} className="py-1">{w}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {monthGrid(view.y, view.m).flat().map((d, i) => {
            if (!d) return <span key={i} />;
            const sel = view.y === cur.jy && view.m === cur.jm && d === cur.jd;
            const isToday = view.y === today.jy && view.m === today.jm && d === today.jd;
            const dis = before(view.y, view.m, d) || d > jalaliMonthLength(view.y, view.m);
            return (
              <button key={i} type="button" disabled={dis} onClick={() => pick(d)} aria-pressed={sel} aria-label={`${fa(d)} ${JALALI_MONTHS[view.m - 1]}`}
                className={cx("grid h-11 place-items-center rounded-full text-sm font-medium transition disabled:opacity-30", sel ? "bg-brand-500 font-black" : "hover:bg-surface-3", isToday && !sel && "ring-1 ring-accent-600")}>
                {fa(d)}
              </button>
            );
          })}
        </div>
        {withTime && (
          <div className="mt-5 flex items-center gap-3 rounded-ui bg-surface-2 p-3">
            <Clock className="size-5 text-ink-3" aria-hidden />
            <span className="text-sm font-medium">ساعت</span>
            <select aria-label="ساعت" value={h} onChange={(e) => setTime(+e.target.value, mi)} className="h-11 rounded-ui border border-line bg-white px-3">{Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0").replace(/\d/g, (x) => fa(+x))}</option>)}</select>
            <span>:</span>
            <select aria-label="دقیقه" value={mi} onChange={(e) => setTime(h, +e.target.value)} className="h-11 rounded-ui border border-line bg-white px-3">{[0, 15, 30, 45].map((i) => <option key={i} value={i}>{String(i).padStart(2, "0").replace(/\d/g, (x) => fa(+x))}</option>)}</select>
          </div>
        )}
      </Sheet>
    </div>
  );
}
export const JalaliDatePicker = (p: Omit<Parameters<typeof JalaliDateTimePicker>[0], "withTime">) => <JalaliDateTimePicker {...p} withTime={false} />;
