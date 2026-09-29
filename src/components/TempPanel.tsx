"use client";

import { AlertTriangle, CheckCircle2, Phone, Table2, Thermometer } from "lucide-react";
import { useMemo, useState } from "react";
import { degrees, fa, hhmm, tempClassLabel, tempRange } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { excursions, readings, stats, type Reading, type TelemetryOrder } from "@/lib/telemetry";
import { Badge, Card, cx } from "./ui";

const fmtSec = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const W = 640;
const H = 250;
const PAD = { l: 46, r: 14, t: 14, b: 30 };

function niceTicks(lo: number, hi: number) {
  const span = hi - lo;
  const step = [1, 2, 5, 10, 20].find((s) => span / s <= 6) ?? 20;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

export function LiveTempBadge({ o }: { o: TelemetryOrder }) {
  const now = useNow(2000);
  const rs = readings(o, now);
  const last = rs[rs.length - 1];
  if (!last) return null;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", last.out ? "bg-danger-bg text-danger" : "bg-ok-bg text-ok")}>
      {last.out ? <AlertTriangle className="size-3.5" aria-hidden /> : <Thermometer className="size-3.5" aria-hidden />}
      دمای بار {degrees(last.c)}{last.out ? " · خارج از بازه" : ""}
    </span>
  );
}

/**
 * Cold-chain integrity for one trip: current reading, allowed band, full history
 * and every excursion. State is never colour-only: each excursion also carries an
 * icon, a label and a row in the log.
 */
export function TempPanel({ o, contact }: { o: TelemetryOrder & { status: string }; contact?: { name: string; phone: string } }) {
  const now = useNow(1000);
  const rs = useMemo(() => readings(o, now), [o, now]);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const last = rs[rs.length - 1];
  const ex = useMemo(() => excursions(rs), [rs]);
  const st = stats(rs);
  const live = o.status === "IN_TRANSIT";
  const ongoing = ex.find((e) => e.ongoing);

  const t0 = o.startedAt ?? now;
  const t1 = o.deliveredAt ?? t0 + 150_000;
  const cs = rs.map((r) => r.c);
  const lo = Math.min(o.tempMin, ...cs) - 1.5;
  const hi = Math.max(o.tempMax, ...cs) + 1.5;
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (c: number) => PAD.t + (1 - (c - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = niceTicks(lo, hi);

  const segs = useMemo(() => {
    const list: { d: string; out: boolean }[] = [];
    for (let i = 1; i < rs.length; i++) {
      const a = rs[i - 1];
      const b = rs[i];
      list.push({ d: `M${x(a.at)},${y(a.c)} L${x(b.at)},${y(b.c)}`, out: a.out || b.out });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rs, lo, hi]);

  const pick = (clientX: number, rect: DOMRect) => {
    if (!rs.length) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 0; i < rs.length; i++) if (Math.abs(x(rs[i].at) - px) < Math.abs(x(rs[best].at) - px)) best = i;
    setHover(best);
  };

  const h: Reading | undefined = hover !== null ? rs[Math.min(hover, rs.length - 1)] : undefined;
  const summary = last
    ? `نمودار دمای بار. آخرین دما ${degrees(last.c)}، بازه‌ی مجاز ${tempRange(o.tempMin, o.tempMax)}. ${ex.length ? `${fa(ex.length)} مورد خارج از بازه ثبت شده است.` : "هیچ تخطی‌ای ثبت نشده است."}`
    : "هنوز داده‌ای ثبت نشده است.";

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black"><Thermometer className="size-5 text-accent-600" aria-hidden />دمای بار در مسیر</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">بازه‌ی مجاز: {tempClassLabel(o.tempMin, o.tempMax)} · {tempRange(o.tempMin, o.tempMax)}</p>
        </div>
        {last && (
          <div className="text-end">
            <div className={cx("text-3xl font-black tabular", last.out && "text-danger")}>{degrees(last.c)}</div>
            <div className="mt-1 flex justify-end">
              {last.out
                ? <Badge tone="danger"><AlertTriangle className="size-3.5" aria-hidden />خارج از بازه‌ی مجاز</Badge>
                : <Badge tone="ok"><CheckCircle2 className="size-3.5" aria-hidden />در بازه‌ی مجاز</Badge>}
            </div>
          </div>
        )}
      </div>

      {ongoing && live && (
        <div role="alert" className="flex animate-rise flex-wrap items-center gap-3 rounded-ui bg-danger-bg p-4 text-sm leading-7 text-danger">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 font-medium">
            دمای بار {ongoing.dir === "high" ? "بالاتر" : "پایین‌تر"} از بازه‌ی مجاز است (اوج {degrees(ongoing.peak)}). ادامه‌ی این وضعیت می‌تواند به بار آسیب بزند.
          </p>
          {contact && <a href={`tel:${contact.phone}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 font-bold"><Phone className="size-4" aria-hidden />تماس با {contact.name}</a>}
        </div>
      )}

      {!table ? (
        <div
          className="relative touch-pan-y select-none"
          dir="ltr"
          tabIndex={0}
          role="group"
          aria-label={summary}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (!rs.length) return;
            if (e.key === "ArrowLeft") { e.preventDefault(); setHover((v) => Math.max(0, (v ?? rs.length) - 1)); }
            if (e.key === "ArrowRight") { e.preventDefault(); setHover((v) => Math.min(rs.length - 1, (v ?? -1) + 1)); }
            if (e.key === "Escape") setHover(null);
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={summary}>
            {/* grid + y axis: recessive */}
            {ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
                <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--color-ink-3)" className="tabular">{degrees(v).replace(/[⁦⁩]/g, "")}</text>
              </g>
            ))}
            {/* allowed band */}
            <rect x={PAD.l} y={y(o.tempMax)} width={W - PAD.l - PAD.r} height={y(o.tempMin) - y(o.tempMax)} fill="var(--color-accent-600)" opacity={0.12} />
            <line x1={PAD.l} x2={W - PAD.r} y1={y(o.tempMax)} y2={y(o.tempMax)} stroke="var(--color-accent-600)" strokeWidth={1} strokeDasharray="4 4" />
            <line x1={PAD.l} x2={W - PAD.r} y1={y(o.tempMin)} y2={y(o.tempMin)} stroke="var(--color-accent-600)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={W - PAD.r - 6} y={y(o.tempMax) + 15} textAnchor="end" fontSize={12} fill="var(--color-ink-2)">بازه‌ی مجاز</text>
            {/* x axis */}
            <text x={PAD.l} y={H - 8} fontSize={12} fill="var(--color-ink-3)" textAnchor="start">شروع · {hhmm(t0)}</text>
            <text x={W - PAD.r} y={H - 8} fontSize={12} fill="var(--color-ink-3)" textAnchor="end">{o.deliveredAt ? `تحویل · ${hhmm(t1)}` : "مقصد"}</text>
            {/* line: 2px, out-of-range segments in the status colour */}
            {segs.map((s, i) => <path key={i} d={s.d} stroke={s.out ? "var(--color-danger)" : "var(--color-accent-600)"} strokeWidth={2} fill="none" strokeLinecap="round" />)}
            {/* excursion peaks, labelled in ink (text never wears the series colour) */}
            {ex.map((e, i) => {
              const r = rs.find((q) => q.c === e.peak && q.out);
              if (!r) return null;
              return (
                <g key={i}>
                  <circle cx={x(r.at)} cy={y(r.c)} r={5} fill="var(--color-danger)" stroke="#fff" strokeWidth={2} />
                  <text x={x(r.at)} y={y(r.c) - 11} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--color-ink)">اوج {degrees(e.peak).replace(/[⁦⁩]/g, "")}</text>
                </g>
              );
            })}
            {last && !h && <circle cx={x(last.at)} cy={y(last.c)} r={5} fill={last.out ? "var(--color-danger)" : "var(--color-accent-600)"} stroke="#fff" strokeWidth={2} />}
            {h && (
              <g>
                <line x1={x(h.at)} x2={x(h.at)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-ink-3)" strokeWidth={1} />
                <circle cx={x(h.at)} cy={y(h.c)} r={6} fill={h.out ? "var(--color-danger)" : "var(--color-accent-600)"} stroke="#fff" strokeWidth={2} />
              </g>
            )}
          </svg>
          {h && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-ui bg-ink px-3 py-2 text-xs text-white shadow-lift"
              dir="rtl"
              style={{ left: `${(x(h.at) / W) * 100}%`, top: 0, transform: `translateX(${x(h.at) / W > 0.75 ? "-100%" : x(h.at) / W < 0.25 ? "0%" : "-50%"})` }}
            >
              <div className="font-bold tabular">{degrees(h.c)}</div>
              <div className="text-white/70">{fmtSec.format(h.at)}</div>
              <div className={h.out ? "font-bold text-red-300" : "text-emerald-300"}>{h.out ? (h.dir === "high" ? "بالاتر از بازه" : "پایین‌تر از بازه") : "در بازه"}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-72 overflow-auto rounded-ui border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">ثبت‌های دمای بار</caption>
            <thead className="sticky top-0 bg-surface-2 text-ink-3"><tr><th className="p-2.5 text-start font-medium">زمان</th><th className="p-2.5 text-start font-medium">دما</th><th className="p-2.5 text-start font-medium">وضعیت</th></tr></thead>
            <tbody className="divide-y divide-line">
              {[...rs].reverse().map((r) => (
                <tr key={r.at}><td className="p-2.5 tabular">{fmtSec.format(r.at)}</td><td className="p-2.5 font-bold tabular">{degrees(r.c)}</td><td className="p-2.5">{r.out ? <span className="font-bold text-danger">{r.dir === "high" ? "بالاتر از بازه" : "پایین‌تر از بازه"}</span> : "در بازه"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
        <span>{live ? "به‌روزرسانی هر چند ثانیه" : "ثبت کامل مسیر"} · داده‌ی شبیه‌سازی‌شده‌ی سنسور (نسخه‌ی نمایشی)</span>
        <button type="button" onClick={() => setTable((t) => !t)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-bold text-accent-600 hover:bg-accent-50" aria-pressed={table}>
          <Table2 className="size-4" aria-hidden />{table ? "نمایش نمودار" : "نمایش جدول"}
        </button>
      </div>

      {st && (
        <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4 text-center text-sm">
          <div><dt className="text-ink-3">کمترین</dt><dd className="font-black tabular">{degrees(st.min)}</dd></div>
          <div><dt className="text-ink-3">میانگین</dt><dd className="font-black tabular">{degrees(Math.round(st.avg * 10) / 10)}</dd></div>
          <div><dt className="text-ink-3">بیشترین</dt><dd className="font-black tabular">{degrees(st.max)}</dd></div>
        </dl>
      )}

      <div className="space-y-2 border-t border-line pt-4">
        <h3 className="text-sm font-bold">گزارش تخطی‌ها</h3>
        {ex.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-ok"><CheckCircle2 className="size-4" aria-hidden />تا این لحظه دما همیشه در بازه‌ی مجاز بوده است.</p>
        ) : (
          <ul className="space-y-2">
            {ex.map((e, i) => (
              <li key={i} className="flex items-start gap-3 rounded-ui bg-danger-bg p-3 text-sm leading-6 text-danger">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <b>{e.dir === "high" ? "افزایش دما" : "کاهش دما"}</b> تا {degrees(e.peak)} · از {fmtSec.format(e.from)}{e.ongoing ? " تا اکنون (ادامه دارد)" : ` تا ${fmtSec.format(e.to)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
