"use client";

import { Check, ChevronLeft, ChevronRight, Loader2, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ComponentProps, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");
export { cx };

/* ───────── Atoms ───────── */

type BtnStyle = {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
  block?: boolean;
};
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & BtnStyle & { loading?: boolean };

function btnClass({ variant = "primary", size = "md", block }: BtnStyle, extra?: string) {
  const v = {
    primary: "bg-brand-500 text-ink shadow-[0_1px_0_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(255_176_0/0.5)] hover:bg-brand-400 active:bg-brand-600 font-extrabold",
    accent: "bg-accent-600 text-white shadow-[0_4px_12px_-4px_rgb(20_110_180/0.5)] hover:bg-accent-700 font-extrabold",
    secondary: "bg-white text-ink shadow-soft hover:bg-surface-2 font-bold",
    ghost: "text-ink-2 hover:bg-ink/5 font-bold",
    danger: "bg-danger-bg text-danger ring-1 ring-danger/15 hover:bg-red-200 font-extrabold",
  }[variant];
  const sz = { sm: "h-11 px-4 text-sm", md: "h-12 px-5 text-[15px]", lg: "h-14 px-6 text-base" }[size];
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-ui transition duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
    v, sz, block && "w-full", extra,
  );
}

export function Button({ variant, size, loading, block, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button {...rest} disabled={disabled || loading} className={btnClass({ variant, size, block }, className)}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/** A real link that looks like a button: one interactive element, never `<a><button>`. */
export function ButtonLink({ variant, size, block, className, children, ...rest }: ComponentProps<typeof Link> & BtnStyle) {
  return (
    <Link {...rest} className={btnClass({ variant, size, block }, className)}>
      {children}
    </Link>
  );
}

const fieldBase =
  "w-full rounded-ui border border-line/80 bg-white/90 px-4 text-[15px] text-ink shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition focus:border-accent-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-100 disabled:bg-surface-3 disabled:text-ink-3";

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(fieldBase, "h-12", className)} />;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(fieldBase, "min-h-24 py-3", className)} />;
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cx(fieldBase, "h-12 appearance-none bg-[length:16px] bg-[position:left_14px_center] bg-no-repeat pl-10", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3E%3Cpath d='M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-2">{label}</label>
      {children(id)}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : hint ? <p className="text-[13px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cx(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed",
        checked ? "bg-accent-600" : "bg-line", disabled && "opacity-70",
      )}
    >
      <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow-soft transition-all", checked ? "right-0.5" : "right-[22px]")} />
    </button>
  );
}

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "brand";
const tones: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok ring-1 ring-inset ring-ok/15",
  warn: "bg-warn-bg text-warn ring-1 ring-inset ring-warn/15",
  danger: "bg-danger-bg text-danger ring-1 ring-inset ring-danger/15",
  info: "bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-600/15",
  neutral: "bg-surface-3 text-ink-2 ring-1 ring-inset ring-ink/5",
  brand: "bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-500/25",
};
export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-ui", className)} aria-hidden />;
}

/* ───────── Molecules ───────── */

export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cx("rounded-ui bg-white shadow-soft", className)}>{children}</div>;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex animate-rise flex-col items-center rounded-ui border border-dashed border-line bg-white px-6 py-12 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-brand-50 text-brand-700">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-7 text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: string; tone?: "brand" | "accent"; icon?: ReactNode }) {
  return (
    <Card className={cx("card-lift relative overflow-hidden p-4", tone === "accent" && "bg-gradient-to-br from-white to-accent-50", tone === "brand" && "bg-gradient-to-br from-white to-brand-50")}>
      <div className="flex items-start justify-between gap-2"><div className="text-[13px] font-medium text-ink-3">{label}</div>{icon && <span className={cx("grid size-9 place-items-center rounded-xl", tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-accent-50 text-accent-600")}>{icon}</span>}</div>
      <div className={cx("mt-2 text-[26px] font-black leading-none tabular tracking-tight", tone === "accent" && "text-accent-700")}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-ink-3">{sub}</div>}
    </Card>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-rise rounded-t-3xl bg-white p-5 shadow-lift sm:rounded-ui">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="بستن" className="grid size-11 place-items-center rounded-full hover:bg-surface-3"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stars({ value, onChange, size = 28 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <div className="flex gap-1" dir="ltr" role={onChange ? "radiogroup" : "img"} aria-label={`${value} از ۵`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} ستاره`}
          className="transition active:scale-90 disabled:cursor-default">
          <Star style={{ width: size, height: size }} className={n <= value ? "fill-brand-500 text-brand-500" : "text-line"} />
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; sub?: string }[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cx("rounded-ui border-2 px-3 py-3 text-center transition",
              on ? "border-act bg-act-soft shadow-soft" : "border-transparent bg-white shadow-soft hover:bg-surface-2")}>
            <div className="text-[15px] font-bold">{o.label}</div>
            {o.sub && <div className="mt-0.5 text-xs text-ink-3">{o.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="مراحل">
      {steps.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={on ? "step" : undefined}>
            <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition",
              done ? "bg-ok text-white" : on ? "bg-brand-500 text-ink" : "bg-surface-3 text-ink-3")}>
              {done ? <Check className="size-4" /> : new Intl.NumberFormat("fa-IR").format(i + 1)}
            </span>
            <span className={cx("hidden text-sm sm:block", on ? "font-bold" : "text-ink-3")}>{s}</span>
            {i < steps.length - 1 && <span className={cx("h-0.5 flex-1 rounded-full", done ? "bg-ok" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "warn" | "danger" }) {
  const c = { brand: "bg-brand-500", warn: "bg-warn", danger: "bg-danger" }[tone];
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-3">
      <div className={cx("h-full rounded-full transition-all duration-500", c)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ───────── Numeric input: Persian digits + grouping, ASCII in state ───────── */

const toAscii = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const faGroup = new Intl.NumberFormat("fa-IR");

export function NumInput({ value, onChange, suffix, allowDecimal, className, ...p }: {
  value: number | undefined; onChange: (n: number | undefined) => void; suffix?: string; allowDecimal?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const shown = value === undefined ? "" : faGroup.format(value);
  return (
    <div className="relative">
      <input
        {...p}
        inputMode={allowDecimal ? "decimal" : "numeric"}
        dir="ltr"
        value={shown}
        onChange={(e) => {
          const raw = toAscii(e.target.value).replace(/[٬,]/g, "").replace(allowDecimal ? /[^\d.]/g : /\D/g, "");
          onChange(raw === "" ? undefined : Number(raw));
        }}
        className={cx(fieldBase, "h-12 text-right tabular", suffix && "pe-20", className)}
      />
      {suffix && <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{suffix}</span>}
    </div>
  );
}

/* ───────── Horizontal scroller with edge fades and arrows ───────── */

export function ScrollRow({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft);
      setEdge({ start: pos > 4, end: pos < max - 4 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);
  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.7, behavior: "smooth" });
  };
  const fade = "pointer-events-none absolute inset-y-0 w-12 from-white to-transparent";
  return (
    <div className="relative">
      <div ref={ref} className={cx("no-scrollbar flex gap-2 overflow-x-auto px-1 py-1", className)}>{children}</div>
      {edge.start && <><span className={cx(fade, "start-0 bg-gradient-to-l rtl:bg-gradient-to-l ltr:bg-gradient-to-r")} aria-hidden />
        <button type="button" aria-label="قبلی" onClick={() => go(-1)} className="absolute start-0 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white shadow-soft"><ChevronRight className="size-4 ltr:rotate-180" /></button></>}
      {edge.end && <><span className={cx(fade, "end-0 bg-gradient-to-r rtl:bg-gradient-to-r ltr:bg-gradient-to-l")} aria-hidden />
        <button type="button" aria-label="بعدی" onClick={() => go(1)} className="absolute end-0 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white shadow-soft"><ChevronLeft className="size-4 ltr:rotate-180" /></button></>}
    </div>
  );
}

/* ───────── Sheet (bottom sheet on mobile, dialog on desktop) with focus trap ───────── */

export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !ref.current) return;
      const f = ref.current.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", h);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("button,input,select,textarea,[href]")?.focus(), 30);
    const ov = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); clearTimeout(t); document.body.style.overflow = ov; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={cx("flex max-h-[92dvh] w-full animate-rise flex-col rounded-t-[28px] bg-white shadow-lift sm:rounded-[28px]", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="بستن" className="grid size-11 place-items-center rounded-full hover:bg-surface-3"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="pb-safe border-t border-line bg-white p-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ───────── Tabs ───────── */

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={cx("no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-ink/[0.045] p-1", className)}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            className={cx("flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition duration-200", on ? "bg-white text-ink shadow-soft" : "text-ink-3 hover:text-ink")}>
            {t.label}
            {t.count !== undefined && <span className={cx("rounded-full px-2 py-0.5 text-[11px]", on ? "bg-act-soft text-act-ink" : "bg-ink/5")}>{faGroup.format(t.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Accordion({ title, children, defaultOpen }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-ui border border-line bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold [&::-webkit-details-marker]:hidden">
        {title}<ChevronLeft className="size-4 text-ink-3 transition group-open:-rotate-90" aria-hidden />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}
