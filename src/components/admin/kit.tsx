"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { can as roleCan, PERM_LABELS, ROLE_LABELS } from "@/lib/engine/admin";
import type { Result } from "@/lib/engine/core";
import { usePortal } from "@/lib/hooks";
import { act } from "@/lib/store";
import { toast } from "../Toaster";
import { Card, cx } from "../ui";

/** Current admin + permission helpers. `run` calls an engine action as this admin and surfaces permission/validation errors clearly. */
export function useAdmin() {
  const p = usePortal("admin");
  const admin = p.admin!;
  const has = (perm: string) => roleCan(admin?.role, perm);
  function run<T extends object>(fn: (s: Parameters<Parameters<typeof act>[0]>[0], adminId: string) => Result<T>, okMsg?: string): Result<T> {
    const r = act((s) => fn(s, admin.id));
    if (!r.ok) toast(r.error, "err");
    else if (okMsg) toast(okMsg);
    return r;
  }
  return { ...p, admin, has, run, roleLabel: ROLE_LABELS[admin?.role] };
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-black tracking-tight">{title}</h1>{sub && <p className="mt-0.5 text-sm text-ink-3">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, sub, tone, spark }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "warn" | "danger"; spark?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2"><div className="text-xs font-bold text-ink-3">{label}</div>{spark}</div>
      <div className={cx("mt-1.5 text-[26px] font-black leading-none tabular tracking-tight", tone === "ok" && "text-ok", tone === "warn" && "text-warn", tone === "danger" && "text-danger")}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-ink-3">{sub}</div>}
    </Card>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cx("p-5", className)}>
      {(title || action) && <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-extrabold">{title}</h2>{action}</div>}
      {children}
    </Card>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  if (v === undefined || v === null || v === "") return null;
  return <div className="flex items-start justify-between gap-4 py-2 text-sm"><dt className="shrink-0 text-ink-3">{k}</dt><dd className="text-end font-bold">{v}</dd></div>;
}

/** Shows a clear explanation instead of the module when the role lacks the permission. */
export function Denied({ perm }: { perm: string }) {
  const { roleLabel } = useAdmin();
  return (
    <Card className="mx-auto mt-10 max-w-lg space-y-3 p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-warn-bg text-warn"><Lock className="size-7" aria-hidden /></span>
      <h1 className="text-xl font-black">دسترسی ندارید</h1>
      <p className="text-sm leading-7 text-ink-3">نقش شما («{roleLabel}») به بخش «{PERM_LABELS[perm] ?? perm}» دسترسی ندارد. اگر به آن نیاز دارید از مدیر ارشد بخواهید نقش شما را تغییر دهد.</p>
    </Card>
  );
}

export const Pill = ({ tone = "neutral", children }: { tone?: "ok" | "warn" | "danger" | "info" | "neutral"; children: ReactNode }) => {
  const c = { ok: "bg-ok-bg text-ok", warn: "bg-warn-bg text-warn", danger: "bg-danger-bg text-danger", info: "bg-accent-50 text-accent-700", neutral: "bg-surface-3 text-ink-2" }[tone];
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", c)}>{children}</span>;
};
