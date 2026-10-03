"use client";

import { AlertTriangle, Handshake, Map, Shield, Thermometer, Truck, FileText, CheckCircle2, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { acceptRules, currentRule, needsAcceptance } from "@/lib/engine/trust";
import { fa, jDateTime } from "@/lib/format";
import { act, useStore } from "@/lib/store";
import { Accordion, Button, Card, Sheet } from "./ui";
import { toast } from "./Toaster";

const ICONS: Record<string, LucideIcon> = { shield: Shield, truck: Truck, thermometer: Thermometer, map: Map, handshake: Handshake, alert: AlertTriangle, file: FileText };

/** Key-points card + full text; used on profile screens and the forced re-acceptance gate. */
export function RuleCard({ audience }: { audience: "driver" | "shipper" }) {
  const s = useStore();
  const r = currentRule(s, audience);
  if (!r) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><h3 className="font-extrabold">{audience === "driver" ? "قوانین و مقررات رانندگان" : "قوانین و مقررات صاحبان بار"}</h3><span className="text-xs text-ink-3">نسخه‌ی {fa(r.version)} · {jDateTime(r.publishedAt)}</span></div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {r.keyPoints.map((k) => { const I = ICONS[k.icon] ?? FileText; return <li key={k.text} className="flex gap-3 rounded-ui bg-surface-2 p-3 text-sm leading-7"><I className="mt-1 size-5 shrink-0 text-act-ink" aria-hidden />{k.text}</li>; })}
      </ul>
      <Accordion title="متن کامل قوانین">
        <div className="space-y-4">{r.sections.map((sec) => <section key={sec.title}><h4 className="font-bold">{sec.title}</h4><ul className="mt-1 list-disc space-y-1 ps-5 text-sm leading-7 text-ink-2">{sec.items.map((i) => <li key={i}>{i}</li>)}</ul></section>)}</div>
      </Accordion>
    </div>
  );
}

export function RulesStatus({ personId, audience }: { personId: string; audience: "driver" | "shipper" }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const pending = needsAcceptance(s, personId, audience);
  const acc = s.acceptances.find((a) => a.personId === personId && a.audience === audience);
  return (
    <Card className="space-y-3 p-5">
      <RuleCard audience={audience} />
      {pending ? <Button onClick={() => setOpen(true)}>مطالعه و پذیرش نسخه‌ی جدید</Button> : <p className="flex items-center gap-2 text-sm text-ok"><CheckCircle2 className="size-4" aria-hidden />پذیرفته‌شده در {acc ? jDateTime(acc.at) : "—"} (نسخه‌ی {fa(acc?.version ?? 0)})</p>}
      <AcceptSheet open={open} onClose={() => setOpen(false)} personId={personId} audience={audience} />
    </Card>
  );
}

export function AcceptSheet({ open, onClose, personId, audience }: { open: boolean; onClose: () => void; personId: string; audience: "driver" | "shipper" }) {
  const [ok, setOk] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="پذیرش قوانین" wide footer={
      <div className="space-y-3">
        <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5" checked={ok} onChange={(e) => setOk(e.target.checked)} />قوانین را خوانده‌ام و می‌پذیرم.</label>
        <Button block disabled={!ok} onClick={() => { const r = act((st) => acceptRules(st, personId, audience, "web")); if (r.ok) { toast("قوانین پذیرفته شد."); onClose(); } else toast(r.error, "err"); }}>پذیرش</Button>
      </div>}>
      <RuleCard audience={audience} />
    </Sheet>
  );
}
