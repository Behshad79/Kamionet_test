"use client";

import { Check, Loader2, Star, X } from "lucide-react";
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");
export { cx };

/* ───────── Atoms ───────── */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, block, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: "bg-brand-500 text-ink hover:bg-brand-400 active:bg-brand-600 shadow-soft font-bold",
    accent: "bg-accent-600 text-white hover:bg-accent-700 shadow-soft font-bold",
    secondary: "bg-white text-ink border border-line hover:bg-surface-3 font-medium",
    ghost: "text-ink-2 hover:bg-surface-3 font-medium",
    danger: "bg-danger-bg text-danger hover:bg-red-200 font-bold",
  }[variant];
  const sz = { sm: "h-9 px-3 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-13 px-6 text-base" }[size];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-ui transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        v, sz, block && "w-full", className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

const fieldBase =
  "w-full rounded-ui border border-line bg-white px-4 text-[15px] text-ink placeholder:text-ink-4 transition focus:border-accent-600 focus:outline-none focus:ring-4 focus:ring-accent-100 disabled:bg-surface-3 disabled:text-ink-3";

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
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  info: "bg-accent-50 text-accent-700",
  neutral: "bg-surface-3 text-ink-2",
  brand: "bg-brand-100 text-brand-700",
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

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: "brand" | "accent" }) {
  return (
    <Card className="p-4">
      <div className="text-[13px] text-ink-3">{label}</div>
      <div className={cx("mt-1 text-2xl font-black tabular", tone === "accent" && "text-accent-600")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
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
          <button onClick={onClose} aria-label="بستن" className="grid size-9 place-items-center rounded-full hover:bg-surface-3"><X className="size-5" /></button>
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
              on ? "border-brand-500 bg-brand-50 shadow-soft" : "border-line bg-white hover:border-ink-4")}>
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
