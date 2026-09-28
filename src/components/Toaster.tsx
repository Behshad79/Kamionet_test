"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useSyncExternalStore } from "react";

type T = { id: number; text: string; tone: "ok" | "err" | "info" };
let toasts: T[] = [];
const subs = new Set<() => void>();
const set = (t: T[]) => {
  toasts = t;
  subs.forEach((s) => s());
};

export function toast(text: string, tone: T["tone"] = "ok") {
  const id = Date.now() + Math.random();
  set([...toasts, { id, text, tone }]);
  setTimeout(() => set(toasts.filter((x) => x.id !== id)), 3800);
}

export function Toaster() {
  const list = useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), () => toasts, () => []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[2000] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite" aria-atomic="true">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto flex max-w-md animate-rise items-center gap-2.5 rounded-ui bg-ink px-4 py-3 text-sm font-medium text-white shadow-lift">
          {t.tone === "ok" ? <CheckCircle2 className="size-5 shrink-0 text-emerald-400" /> : t.tone === "err" ? <XCircle className="size-5 shrink-0 text-red-400" /> : <Info className="size-5 shrink-0 text-accent-500" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
