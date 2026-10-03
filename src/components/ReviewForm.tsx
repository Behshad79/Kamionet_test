"use client";

import { useState } from "react";
import { reviewCriteria, submitReview } from "@/lib/engine/trust";
import { act } from "@/lib/store";
import { Button, Stars, Textarea } from "./ui";
import { toast } from "./Toaster";

/** Blind two-way review: criteria stars + comment. The other side's review stays hidden until both are in (or 7 days). */
export function ReviewForm({ personId, orderId, role }: { personId: string; orderId: string; role: "shipper" | "driver" }) {
  const crit = reviewCriteria(role);
  const [v, setV] = useState<Record<string, number>>({});
  const [c, setC] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = crit.every((x) => v[x.id] >= 1);
  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-ink-3">نظر شما هم‌زمان با نظر طرف مقابل آشکار می‌شود؛ پس بدون نگرانی صادقانه بنویسید.</p>
      {crit.map((x) => (
        <div key={x.id} className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{x.label}</span><Stars value={v[x.id] ?? 0} size={26} onChange={(n) => setV({ ...v, [x.id]: n })} /></div>
      ))}
      <Textarea aria-label="توضیحات" placeholder="توضیحات (اختیاری)" value={c} onChange={(e) => setC(e.target.value)} />
      <Button block disabled={!ready} loading={busy} onClick={async () => {
        setBusy(true);
        await new Promise((r) => setTimeout(r, 300));
        const r = act((s) => submitReview(s, personId, orderId, { criteria: v, comment: c }));
        setBusy(false);
        toast(r.ok ? "نظر شما ثبت شد." : r.error, r.ok ? "ok" : "err");
      }}>ثبت نظر</Button>
    </div>
  );
}
