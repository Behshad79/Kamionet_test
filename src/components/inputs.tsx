"use client";

import { Building2, Factory, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { degrees, tempClass, tempClassLabel, tempRange, TEMP_PRESETS, type TempClass } from "@/lib/format";
import { KIND_LABEL, searchPlaces, type GazPlace } from "@/lib/places";
import { Segmented, cx } from "./ui";

/* ───────── Searchable place combobox (province / city / industrial town) ───────── */

export function PlaceCombobox({
  label, value, onSelect, placeholder = "جستجوی شهر، استان یا شهرک صنعتی…", error, allowClear,
}: {
  label: string; value?: string; onSelect: (p: GazPlace | null) => void; placeholder?: string; error?: string; allowClear?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const results = useMemo(() => searchPlaces(q), [q]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const choose = (p: GazPlace) => { onSelect(p); setQ(""); setOpen(false); };
  const Icon = (k: GazPlace["kind"]) => (k === "industrial" ? Factory : k === "capital" ? Building2 : MapPin);

  return (
    <div className="space-y-1.5" ref={box}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-2">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && results[active] ? `${id}-o${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={open ? q : value ?? ""}
          placeholder={value && !open ? undefined : placeholder}
          onFocus={() => { setOpen(true); setQ(""); setActive(0); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && open && results[active]) { e.preventDefault(); choose(results[active]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          className={cx(
            "h-12 w-full rounded-ui border bg-white ps-11 pe-11 text-[15px] transition focus:outline-none focus:ring-4",
            error ? "border-danger focus:ring-danger-bg" : "border-line focus:border-accent-600 focus:ring-accent-100",
          )}
        />
        {allowClear && value && !open && (
          <button type="button" aria-label="پاک کردن" onClick={() => onSelect(null)} className="absolute end-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full hover:bg-surface-3"><X className="size-4" /></button>
        )}
        {open && (
          <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-[900] max-h-72 overflow-auto rounded-ui bg-white py-1.5 shadow-lift">
            {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-3">موردی پیدا نشد. نام شهر یا استان را دقیق‌تر بنویسید.</li>}
            {results.map((p, i) => {
              const I = Icon(p.kind);
              return (
                <li key={p.name + p.province} id={`${id}-o${i}`} role="option" aria-selected={i === active}
                  onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                  className={cx("flex cursor-pointer items-center gap-3 px-4 py-2.5", i === active && "bg-brand-50")}>
                  <I className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="text-xs text-ink-3">{p.kind === "capital" ? "مرکز استان " : ""}{p.province}{p.kind === "industrial" ? ` · ${KIND_LABEL.industrial}` : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/* ───────── Temperature band: a true min–max range ───────── */

const LO = -30;
const HI = 20;
const pct = (v: number) => ((v - LO) / (HI - LO)) * 100;

/**
 * The accent-coloured bar is the ALLOWED band, and the sentence above it says
 * so in words. The axis is fixed left→right = colder→warmer regardless of page
 * direction, with labelled end caps, so the fill is never ambiguous in RTL.
 */
export function TempRangeSlider({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  const cls = tempClass(min, max);
  const presetKey = (Object.keys(TEMP_PRESETS) as TempClass[]).find((k) => TEMP_PRESETS[k].min === min && TEMP_PRESETS[k].max === max);
  return (
    <div className="space-y-4">
      <Segmented<string>
        value={presetKey ?? "custom"}
        onChange={(k) => { if (k !== "custom") onChange(TEMP_PRESETS[k as TempClass].min, TEMP_PRESETS[k as TempClass].max); }}
        options={[
          { value: "frozen", label: "انجمادی", sub: "−۱۸° و سردتر" },
          { value: "chilled", label: "سردخانه‌ای", sub: "۰ تا ۴°" },
          { value: "cool", label: "خنک", sub: "۸ تا ۱۵°" },
        ]}
      />
      <div className="rounded-ui bg-surface-2 p-4">
        <p className="mb-1 text-sm text-ink-3">دمای مجاز بار در تمام مسیر</p>
        <p className="mb-4 text-lg font-black" aria-live="polite">
          {tempRange(min, max)} <span className="ms-1 rounded-full bg-accent-50 px-2.5 py-0.5 align-middle text-xs font-bold text-accent-700">{tempClassLabel(min, max)}</span>
        </p>

        <div dir="ltr" className="dual-range relative h-10 select-none">
          <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-line" />
          <div className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-accent-600" style={{ left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%` }} />
          <input type="range" min={LO} max={HI} step={1} value={min} aria-label="حداقل دمای مجاز" aria-valuetext={degrees(min)}
            onChange={(e) => onChange(Math.min(+e.target.value, max - 1), max)} />
          <input type="range" min={LO} max={HI} step={1} value={max} aria-label="حداکثر دمای مجاز" aria-valuetext={degrees(max)}
            onChange={(e) => onChange(min, Math.max(+e.target.value, min + 1))} />
        </div>
        <div dir="ltr" className="mt-1 flex justify-between text-xs text-ink-3">
          <span>← سردتر · {degrees(LO)}</span>
          <span>{degrees(HI)} · گرم‌تر →</span>
        </div>
        <p className="mt-3 text-[13px] leading-6 text-ink-3">
          نوار آبی یعنی «بازه‌ی مجاز». دمایی پایین‌تر یا بالاتر از آن، هم بار را خراب می‌کند و هم هشدار می‌دهد. دسته‌ی «{TEMP_PRESETS[cls].label}» فقط از روی همین بازه تعیین می‌شود.
        </p>
      </div>
    </div>
  );
}
