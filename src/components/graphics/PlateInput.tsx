"use client";

import { useRef } from "react";
import { normalizeDigits, faRaw } from "@/lib/money";
import { PLATE_LETTERS } from "@/lib/vehicles";
import type { Plate, PlateVariant } from "@/lib/types";
import { cx } from "../ui";

const BG: Record<PlateVariant, string> = { private: "#FFFFFF", public: "#F8C928", commercial: "#F3A04C" };
export const PLATE_VARIANT_LABEL: Record<PlateVariant, string> = { private: "سفید", public: "زرد", commercial: "نارنجی" };

const onlyDigits = (v: string, n: number) => normalizeDigits(v).replace(/\D/g, "").slice(0, n);

/** Iranian-style plate: blue strip, 2 digits, letter, 3 digits, «ایران» + 2-digit province code. See DECISIONS.md #12 (series per vehicle class is unverified). */
export function PlateView({ plate, className }: { plate: Plate; className?: string }) {
  return (
    <div dir="ltr" className={cx("inline-flex h-12 items-stretch overflow-hidden rounded-lg border-2 border-ink shadow-soft", className)} style={{ background: BG[plate.variant] }} role="img" aria-label={`پلاک ${faRaw(plate.two)} ${plate.letter} ${faRaw(plate.three)} ایران ${faRaw(plate.prov)}`}>
      <Strip />
      <div className="flex items-center gap-1.5 px-2 text-xl font-black tabular text-ink"><span>{faRaw(plate.two)}</span><span className="text-base">{plate.letter}</span><span>{faRaw(plate.three)}</span></div>
      <div className="flex flex-col items-center justify-center border-s-2 border-ink px-2 leading-none"><span className="text-[9px] font-bold">ایران</span><span className="text-lg font-black tabular">{faRaw(plate.prov)}</span></div>
    </div>
  );
}

function Strip() {
  return (
    <div className="flex w-7 shrink-0 flex-col items-center justify-between bg-[#1E4DB7] py-1 text-white" aria-hidden>
      <span className="flex w-4 flex-col overflow-hidden rounded-[2px]"><i className="h-1 bg-[#239F40]" /><i className="h-1 bg-white" /><i className="h-1 bg-[#DA0000]" /></span>
      <span className="text-[6px] font-bold leading-none">I.R.</span><span className="text-[6px] font-bold leading-none">IRAN</span>
    </div>
  );
}

export function PlateInput({ value, onChange, error, label = "پلاک خودرو" }: { value: Plate | null; onChange: (p: Plate) => void; error?: string; label?: string }) {
  const p: Plate = value ?? { two: "", letter: "", three: "", prov: "", variant: "public" };
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLSelectElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const set = (patch: Partial<Plate>) => onChange({ ...p, ...patch });
  const field = "bg-transparent text-center font-black tabular text-ink outline-none placeholder:text-ink/30 focus-visible:ring-2 focus-visible:ring-accent-600 rounded";
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1.5 text-sm font-medium text-ink-2">{label}</legend>
      <div dir="ltr" className={cx("inline-flex h-16 items-stretch overflow-hidden rounded-xl border-[3px] shadow-soft", error ? "border-danger" : "border-ink")} style={{ background: BG[p.variant] }}>
        <Strip />
        <div className="flex items-center gap-2 px-3">
          <input ref={refs[0] as React.RefObject<HTMLInputElement>} aria-label="دو رقم اول پلاک" inputMode="numeric" autoComplete="off" placeholder="۱۲" className={cx(field, "w-11 text-2xl")} value={faRaw(p.two)} onChange={(e) => { const v = onlyDigits(e.target.value, 2); set({ two: v }); if (v.length === 2) refs[1].current?.focus(); }} />
          <select ref={refs[1] as React.RefObject<HTMLSelectElement>} aria-label="حرف پلاک" className={cx(field, "h-11 w-14 appearance-none text-xl")} value={p.letter} onChange={(e) => { set({ letter: e.target.value }); refs[2].current?.focus(); }}>
            <option value="">—</option>
            {PLATE_LETTERS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <input ref={refs[2] as React.RefObject<HTMLInputElement>} aria-label="سه رقم پلاک" inputMode="numeric" autoComplete="off" placeholder="۳۴۵" className={cx(field, "w-16 text-2xl")} value={faRaw(p.three)} onChange={(e) => { const v = onlyDigits(e.target.value, 3); set({ three: v }); if (v.length === 3) refs[3].current?.focus(); }} />
        </div>
        <div className="flex flex-col items-center justify-center border-s-[3px] border-ink px-2">
          <span className="text-[10px] font-bold leading-none">ایران</span>
          <input ref={refs[3] as React.RefObject<HTMLInputElement>} aria-label="کد استان پلاک" inputMode="numeric" autoComplete="off" placeholder="۶۸" className={cx(field, "mt-0.5 w-10 text-xl")} value={faRaw(p.prov)} onChange={(e) => set({ prov: onlyDigits(e.target.value, 2) })} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="رنگ پلاک">
        <span className="text-sm text-ink-3">رنگ پلاک مطابق کارت خودرو:</span>
        {(Object.keys(BG) as PlateVariant[]).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={p.variant === v} onClick={() => set({ variant: v })} className={cx("flex h-11 items-center gap-2 rounded-full border-2 px-3 text-sm font-medium", p.variant === v ? "border-act bg-act-soft" : "border-line")}>
            <span className="size-4 rounded-full border border-ink/40" style={{ background: BG[v] }} aria-hidden />{PLATE_VARIANT_LABEL[v]}
          </button>
        ))}
      </div>
      <p className="text-xs leading-6 text-ink-3">رنگ و حروف مجاز پلاک بار‌بری باید با کارت خودرو یکی باشد؛ این نمایش نمونه است و تأیید نهایی با بازبین مدارک است.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
