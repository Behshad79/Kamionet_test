"use client";

import { MessageSquareWarning } from "lucide-react";
import { Card } from "../ui";
import { DOC_LABELS } from "@/lib/engine/admin";
import { jDateTime } from "@/lib/format";
import type { DocKey, DriverProfile } from "@/lib/types";

/** Messages the review team left on specific documents. Shown in the KYC wizard and on the documents tab so the driver knows exactly what to fix. */
export function DocMessages({ d }: { d: DriverProfile }) {
  const items = (Object.keys(d.docs) as DocKey[]).flatMap((k) => (d.docs[k]?.notes ?? []).map((n) => ({ k, ...n }))).sort((a, b) => b.at - a.at);
  if (items.length === 0) return null;
  return (
    <Card className="space-y-3 border-2 border-warn/40 bg-warn-bg p-4">
      <h2 className="flex items-center gap-2 font-extrabold text-warn"><MessageSquareWarning className="size-5" aria-hidden />پیام تیم بررسی مدارک</h2>
      <ul className="space-y-2">{items.map((n) => <li key={`${n.k}${n.at}`} className="rounded-ui bg-white p-3 text-sm leading-7"><div className="font-bold">{DOC_LABELS[n.k]}</div><p className="text-ink-2">{n.text}</p><div className="text-xs text-ink-4">{n.by} · {jDateTime(n.at)}</div></li>)}</ul>
    </Card>
  );
}
