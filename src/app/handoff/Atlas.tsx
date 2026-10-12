"use client";

import { ArrowLeft, ArrowRight, ExternalLink, Info, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Card, Input, Sheet } from "@/components/ui";
import { ADMIN_PAGES } from "@/lib/atlas/pagesAdmin";
import { DRIVER_PAGES } from "@/lib/atlas/pagesDriver";
import { PUBLIC_PAGES } from "@/lib/atlas/pagesPublic";
import { SHIPPER_PAGES } from "@/lib/atlas/pagesShipper";
import { STATE_HINTS } from "@/lib/atlas/states";
import type { PageHint, StateHint } from "@/lib/atlas/types";
import { openLive, resolve } from "@/lib/atlas/live";
import { fa } from "@/lib/format";
import { INVENTORY, SEC_LABEL, type Item, type Kind, type Sec } from "@/lib/inventory";
import { useStore } from "@/lib/store";

const KIND_L: Record<Kind, string> = { page: "صفحه", view: "نما/حالت", tab: "تب", sheet: "پنجره", step: "مرحله", slide: "اسلاید", section: "بخش" };
export const ALL_PAGE_HINTS: Record<string, PageHint> = { ...PUBLIC_PAGES, ...SHIPPER_PAGES, ...DRIVER_PAGES, ...ADMIN_PAGES };
const norm = (r?: string) => (r ? (r === "/" ? "/" : r.replace(/\/$/, "")) : "");
const pageHint = (it: Item): PageHint | undefined => ALL_PAGE_HINTS[it.route ?? ""] ?? ALL_PAGE_HINTS[norm(it.route)] ?? ALL_PAGE_HINTS[`${norm(it.route)}/`];
const stateHint = (it: Item): StateHint | undefined => STATE_HINTS[it.name];

/** Hint for any inventory row: its own, or (for tabs/sheets/views without one) the host page's. */
export const hintOf = (it: Item) => ({ page: it.kind === "page" ? pageHint(it) : undefined, state: stateHint(it), host: it.kind !== "page" ? pageHint(it) : undefined });

function List({ title, items, tone }: { title: string; items: string[]; tone?: "ask" }) {
  if (!items.length) return null;
  return (
    <section className="space-y-1.5">
      <h4 className="text-sm font-black">{title}</h4>
      <ul className={`list-disc space-y-1 ps-5 text-sm leading-7 ${tone === "ask" ? "text-ink" : "text-ink-2"}`}>{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </section>
  );
}

function HintBody({ it }: { it: Item }) {
  const { page, state, host } = hintOf(it);
  const p = page ?? host;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2"><Badge tone="info">{SEC_LABEL[it.sec]}</Badge><Badge>{KIND_L[it.kind]}</Badge>{it.route && <span dir="ltr" className="rounded-lg bg-surface-3 px-2 py-1 font-mono text-xs">{it.route}</span>}</div>
      {state && (
        <div className="space-y-2 rounded-ui bg-act-soft p-4 text-sm leading-7">
          <p><b>چه زمانی کاربر اینجاست؟</b> {state.when}</p>
          <p><b>چرا اینطور؟</b> {state.why}</p>
          {state.reach && <ol className="list-decimal space-y-0.5 ps-5 text-ink-2">{state.reach.map((x) => <li key={x}>{x}</li>)}</ol>}
        </div>
      )}
      {state?.ask && <List title="سؤال برای مصاحبه با این حالت" items={state.ask} tone="ask" />}
      {p && (
        <>
          {host && <p className="rounded-ui bg-surface-2 p-3 text-xs font-bold text-ink-3">این مورد بخشی از صفحه‌ی میزبان است؛ راهنمای کامل آن صفحه:</p>}
          <dl className="space-y-3 text-sm leading-7">
            <div><dt className="font-black">چه کسی؟</dt><dd className="text-ink-2">{p.who}</dd></div>
            <div><dt className="font-black">در چه شرایطی به این صفحه می‌رسد؟</dt><dd className="text-ink-2">{p.when}</dd></div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-ui bg-surface-2 p-3"><dt className="mb-1 flex items-center gap-1 font-black"><ArrowRight className="size-4" aria-hidden />صفحه‌ی قبل</dt><dd><ul className="list-disc ps-5 text-ink-2">{p.before.map((x) => <li key={x}>{x}</li>)}</ul></dd></div>
              <div className="rounded-ui bg-surface-2 p-3"><dt className="mb-1 flex items-center gap-1 font-black"><ArrowLeft className="size-4" aria-hidden />صفحه‌ی بعد</dt><dd><ul className="list-disc ps-5 text-ink-2">{p.after.map((x) => <li key={x}>{x}</li>)}</ul></dd></div>
            </div>
            <div><dt className="font-black">چرا جریان اینطور است؟</dt><dd className="text-ink-2">{p.why}</dd></div>
          </dl>
          <section className="space-y-1.5"><h4 className="text-sm font-black">بخش‌های صفحه و دلیل هرکدام</h4>
            <div className="overflow-x-auto rounded-ui border border-line"><table className="w-full min-w-[480px] text-sm"><tbody>{p.parts.map(([a, b]) => <tr key={a} className="border-t border-line first:border-0"><th className="w-1/3 p-2.5 text-start align-top font-bold">{a}</th><td className="p-2.5 leading-7 text-ink-2">{b}</td></tr>)}</tbody></table></div></section>
          <List title="کار طراح" items={p.todo} />
          <List title="سؤال برای مصاحبه (از راننده/صاحب بار/اپراتور بپرسید)" items={p.ask} tone="ask" />
          <List title="رقبا و مرجع‌ها برای بررسی" items={p.bench} />
        </>
      )}
      {!p && !state && <p className="text-sm text-ink-3">برای این مورد توضیح اختصاصی ثبت نشده؛ به صفحه‌ی میزبان نگاه کنید.</p>}
    </div>
  );
}

/** Every inventory item with a "open in the real app" button and a hint panel. */
export function Atlas() {
  const s = useStore();
  const [q, setQ] = useState("");
  const [sec, setSec] = useState<Sec | "">("");
  const [kind, setKind] = useState<Kind | "">("");
  const [open, setOpen] = useState<Item | null>(null);
  const [msg, setMsg] = useState<{ k: string; t: string } | null>(null);
  const rows = useMemo(() => INVENTORY.filter((i) => (!sec || i.sec === sec) && (!kind || i.kind === kind) && (!q || `${i.name} ${i.route ?? ""} ${i.parent ?? ""}`.includes(q))), [q, sec, kind]);
  const go = (it: Item) => {
    const r = resolve(it, s);
    if (!r.ok) return setMsg({ k: it.name, t: r.why });
    const e = openLive(r);
    setMsg({ k: it.name, t: e ?? [r.as ? `نقش ورود: ${r.as}` : r.phone ? `ورود با شماره‌ی دمو ${r.phone}` : "بدون ورود", r.reach].filter(Boolean).join(" · ") });
  };
  const withHint = INVENTORY.filter((i) => { const h = hintOf(i); return h.page || h.state; }).length;
  return (
    <div className="space-y-4">
      <Card className="space-y-2 bg-act-soft p-5">
        <h2 className="text-xl font-black">اطلس زنده: هر صفحه و هر حالت، داخل خود کامیونت</h2>
        <p className="text-sm leading-7 text-ink-2">برای هر ردیف، «باز کردن در کامیونت» با شخصیت دمو مناسب وارد می‌شود و دقیقاً همان صفحه یا حالت را در تب جدید باز می‌کند (حالت‌های وابسته به سفارش از سفارش واقعی هم‌وضعیت در داده‌ی دمو ساخته می‌شوند). دکمه‌ی <Info className="inline size-4" aria-hidden /> راهنمای طراح را نشان می‌دهد: چه کسی، در چه شرایطی، قبل/بعد، دلیل جریان، کار طراح و سؤال‌های مصاحبه. {fa(withHint)} از {fa(INVENTORY.length)} ردیف راهنمای اختصاصی دارند و بقیه به راهنمای صفحه‌ی میزبان ارجاع می‌دهند.</p>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden /><Input aria-label="جستجو در اطلس" placeholder="جستجوی صفحه، حالت یا مسیر…" value={q} onChange={(e) => setQ(e.target.value)} className="ps-10" /></div>
        <select aria-label="بخش" value={sec} onChange={(e) => setSec(e.target.value as Sec | "")} className="h-12 rounded-ui border border-line bg-white px-3 text-sm"><option value="">همه‌ی بخش‌ها</option>{(Object.keys(SEC_LABEL) as Sec[]).map((k) => <option key={k} value={k}>{SEC_LABEL[k]}</option>)}</select>
        <select aria-label="نوع" value={kind} onChange={(e) => setKind(e.target.value as Kind | "")} className="h-12 rounded-ui border border-line bg-white px-3 text-sm"><option value="">همه‌ی انواع</option>{(Object.keys(KIND_L) as Kind[]).map((k) => <option key={k} value={k}>{KIND_L[k]}</option>)}</select>
      </div>
      <p className="text-xs text-ink-3" role="status">{fa(rows.length)} مورد{msg && <> · <b className="text-ink-2">{msg.k}:</b> {msg.t}</>}</p>
      <ul className="space-y-2">
        {rows.map((it, i) => (
          <li key={`${it.name}-${i}`} className="flex flex-wrap items-center gap-2 rounded-ui border border-line bg-white p-3" data-atlas-row>
            <Badge tone={it.kind === "page" ? "brand" : it.kind === "view" ? "info" : "neutral"}>{KIND_L[it.kind]}</Badge>
            <div className="min-w-0 flex-1"><div className="text-sm font-bold leading-6">{it.name}</div><div className="text-xs text-ink-3">{SEC_LABEL[it.sec]}{it.parent ? ` · ${it.parent}` : ""}{it.route ? <span dir="ltr" className="ms-2 font-mono">{it.route}</span> : null}</div></div>
            <button type="button" aria-label={`راهنمای طراح: ${it.name}`} onClick={() => setOpen(it)} className="flex size-11 items-center justify-center rounded-full border border-line text-accent-700 hover:bg-accent-50"><Info className="size-5" aria-hidden /></button>
            {it.kind !== "section" && <button type="button" onClick={() => go(it)} className="flex h-11 items-center gap-1.5 rounded-ui bg-ink px-4 text-sm font-extrabold text-white"><ExternalLink className="size-4" aria-hidden />باز کردن در کامیونت</button>}
          </li>
        ))}
      </ul>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ""} wide>{open && <HintBody it={open} />}</Sheet>
    </div>
  );
}
