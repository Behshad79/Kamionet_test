"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BarList, SERIES, ShareBar } from "@/components/admin/charts";
import { Badge, Button, Card, Input, Tabs } from "@/components/ui";
import { exportCsv, download } from "@/lib/export";
import { CHARTS, COMPONENTS, FLOWS, SCREENS, SERIES_COLORS, TOKENS, WRITING, type PortalKey } from "@/lib/handoff";
import { fa } from "@/lib/format";
import { CONTEXT, DEV, RELEASE, RESEARCH } from "@/lib/handoffMore";
import { GRAND } from "@/lib/inventory";
import { InventoryView, SectionView } from "./Views";
import { StyleGuide } from "./StyleGuide";

type Tab = "stats" | "count" | "screens" | "style" | "comps" | "flows" | "tokens" | "writing" | "context" | "research" | "dev" | "release" | "figma";
const PORTALS: PortalKey[] = ["عمومی", "صاحب بار", "راننده", "ادمین", "اسناد", "بلاگ"];

/** Designer hand-off: every screen with its states and sizes, components, charts, flows and tokens, plus Figma-ready exports. */
export default function Page() {
  const [tab, setTab] = useState<Tab>("stats");
  const [q, setQ] = useState("");
  const [portal, setPortal] = useState<PortalKey | "">("");
  const states = SCREENS.reduce((n, s) => n + s.states.length, 0);
  const byPortal = PORTALS.map((p, i) => ({ label: p, value: SCREENS.filter((s) => s.portal === p).length, color: SERIES[i % SERIES.length] }));
  const rows = useMemo(() => SCREENS.filter((s) => (!portal || s.portal === portal) && (!q || `${s.route} ${s.title} ${s.purpose} ${s.states.join(" ")} ${s.comps.join(" ")}`.includes(q))), [q, portal]);
  const figmaTokens = { color: Object.fromEntries(TOKENS.colors.map(([k, v]) => [k.split(" ")[0], { value: v, type: "color" }])), radius: { ui: { value: "18", type: "borderRadius" } }, series: Object.fromEntries(SERIES_COLORS.map((c, i) => [`s${i + 1}`, { value: c, type: "color" }])) };
  const stat = (label: string, value: string | number, sub?: string) => <Card className="p-4"><div className="text-xs font-bold text-ink-3">{label}</div><div className="mt-1 text-3xl font-black tabular">{typeof value === "number" ? fa(value) : value}</div>{sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}</Card>;
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 py-8" data-portal="admin">
      <meta name="robots" content="noindex" />
      <header><h1 className="text-3xl font-black">راهنمای تحویل به طراح UI/UX</h1><p className="mt-1 text-sm leading-7 text-ink-3">همه‌ی صفحه‌ها، حالت‌ها (خالی، بارگذاری، خطا…)، اندازه‌ها، کامپوننت‌ها، نمودارها، فلوها و توکن‌ها. از این‌جا شروع کنید، بازطراحی کنید و به Figma ببرید.</p></header>
      <Tabs value={tab} onChange={setTab} className="overflow-x-auto" tabs={[{ id: "stats", label: "مرور آماری" }, { id: "count", label: "شمارش دقیق", count: GRAND.total }, { id: "screens", label: "صفحه‌ها", count: SCREENS.length }, { id: "style", label: "استایل گاید زنده" }, { id: "comps", label: "جدول کامپوننت‌ها" }, { id: "flows", label: "فلوها", count: FLOWS.length }, { id: "writing", label: "نوشتار و میکروکپی" }, { id: "tokens", label: "توکن‌ها" }, { id: "context", label: "زمینه و قوانین" }, { id: "research", label: "پژوهش و مصاحبه" }, { id: "dev", label: "هنداف دولوپر" }, { id: "release", label: "انتشار" }, { id: "figma", label: "خروجی Figma" }]} />

      {tab === "count" && <InventoryView />}
      {tab === "style" && <StyleGuide />}
      {tab === "context" && <SectionView s={CONTEXT} />}
      {tab === "research" && <SectionView s={RESEARCH} />}
      {tab === "dev" && <SectionView s={DEV} />}
      {tab === "release" && <SectionView s={RELEASE} />}
      {tab === "stats" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{stat("صفحه و نما (شمارش دقیق)", GRAND.pages + GRAND.views, `${fa(GRAND.pages)} صفحه + ${fa(GRAND.views)} نما`)}{stat("پنجره‌ی شناور", GRAND.sheets)}{stat("تب", GRAND.tabs)}{stat("فریم پایه‌ی کل", GRAND.total, "با مرحله‌ها و اسلایدها")}{stat("حالت (state) ثبت‌شده", states)}{stat("کامپوننت", COMPONENTS.length)}{stat("نمودار / داده‌نما", CHARTS.length)}{stat("فلو", FLOWS.length)}{stat("رنگ پایه", TOKENS.colors.length)}{stat("پنل", 3, "صاحب بار · راننده · ادمین")}{stat("اندازه‌ی طراحی", "۳۷۵ / ۷۶۸ / ۱۲۸۰ / ۱۴۴۰")}</div>
          <Card className="space-y-3 p-5"><h2 className="font-extrabold">صفحه‌ها به تفکیک بخش</h2><ShareBar parts={byPortal} /><BarList rows={byPortal.map((p) => ({ label: p.label, value: p.value }))} /></Card>
          <Card className="space-y-3 p-5"><h2 className="font-extrabold">بیشترین حالت‌ها در یک صفحه</h2><BarList rows={[...SCREENS].sort((a, b) => b.states.length - a.states.length).slice(0, 8).map((s) => ({ label: s.title, value: s.states.length }))} /></Card>
          <Card className="space-y-2 p-5"><h2 className="font-extrabold">قراردادهای کلی</h2><ul className="list-disc space-y-1 ps-5 text-sm leading-7 text-ink-2"><li>همه‌ی صفحه‌ها <b>Loading</b> (اسکلت)، <b>Empty</b> (آیکن + عنوان + توضیح + CTA)، <b>Error</b> (نوار قرمز/زیر فیلد) و <b>Offline</b> دارند.</li><li>هیچ دکمه‌ی گرادیانی نداریم؛ سایه فقط soft/lift.</li><li>آیکن فقط SVG (lucide)، ایموجی ممنوع.</li><li>کارمزد کامیونت هرگز به صاحب بار نمایش داده نمی‌شود.</li><li>پلاک، تلفن و آدرس دقیق راننده/بار فقط پس از بیعانه.</li></ul></Card>
        </div>
      )}

      {tab === "screens" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden /><Input aria-label="جستجو" placeholder="جستجوی صفحه، حالت یا کامپوننت…" value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" /></div>
            <div className="flex flex-wrap gap-1.5">{(["", ...PORTALS] as const).map((p) => <button key={p} aria-pressed={portal === p} onClick={() => setPortal(p)} className={`min-h-10 rounded-full px-4 text-sm font-bold ${portal === p ? "bg-ink text-white" : "bg-surface-3 text-ink-2"}`}>{p || "همه"}</button>)}</div></div>
          <p className="text-xs text-ink-3">{fa(rows.length)} مورد</p>
          {rows.map((s) => (
            <Card key={s.route + s.title} className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black">{s.title}</h2><Badge tone="info">{s.portal}</Badge></div>
              <div dir="ltr" className="rounded-lg bg-surface-3 px-3 py-1.5 text-start font-mono text-xs">{s.route}</div>
              <p className="text-sm text-ink-2">{s.purpose}</p>
              <dl className="grid gap-3 text-sm md:grid-cols-[160px_1fr]"><dt className="font-bold text-ink-3">اندازه / چیدمان</dt><dd>{s.sizes}</dd>
                <dt className="font-bold text-ink-3">حالت‌ها</dt><dd><ul className="flex flex-wrap gap-1.5">{s.states.map((x) => <li key={x} className="rounded-full bg-surface-3 px-2.5 py-1 text-xs">{x}</li>)}</ul></dd>
                <dt className="font-bold text-ink-3">کامپوننت‌ها</dt><dd><ul className="flex flex-wrap gap-1.5">{s.comps.map((x) => <li key={x} className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-bold text-accent-700">{x}</li>)}</ul></dd>
                {s.notes && <><dt className="font-bold text-ink-3">نکته</dt><dd className="leading-7">{s.notes}</dd></>}</dl>
            </Card>
          ))}
        </div>
      )}

      {tab === "comps" && (
        <div className="space-y-5">
          <Card className="overflow-x-auto p-0"><table className="w-full min-w-[820px] text-sm"><thead><tr className="bg-surface-2 text-xs text-ink-3">{["کامپوننت", "فایل", "واریانت", "اندازه", "حالت‌ها"].map((h) => <th key={h} className="p-3 text-start">{h}</th>)}</tr></thead><tbody className="divide-y divide-line/70">{COMPONENTS.map((c) => <tr key={c.name}><td className="p-3 font-bold">{c.name}</td><td dir="ltr" className="p-3 text-start font-mono text-xs">{c.file}</td><td className="p-3">{c.variants}</td><td className="p-3">{c.sizes}</td><td className="p-3">{c.states}</td></tr>)}</tbody></table></Card>
          <Card className="space-y-3 p-5"><h2 className="font-extrabold">نمودارها و داده‌نماها</h2>{CHARTS.map((c) => <div key={c.name} className="rounded-ui bg-surface-2 p-3 text-sm"><b>{c.name}</b><span className="text-ink-3"> · {c.where}</span><p className="mt-1 leading-7">{c.spec}</p></div>)}<div className="flex gap-2">{SERIES_COLORS.map((c) => <span key={c} className="grid h-10 w-16 place-items-center rounded-lg text-[10px] font-bold text-white" style={{ background: c }} dir="ltr">{c}</span>)}</div></Card>
        </div>
      )}

      {tab === "flows" && FLOWS.map((f) => <Card key={f.name} className="space-y-3 p-5"><h2 className="font-extrabold">{f.name}</h2><ol className="flex flex-wrap items-center gap-2">{f.steps.map((s, i) => <li key={s} className="flex items-center gap-2"><span className="rounded-full bg-act-soft px-3 py-1.5 text-sm"><b className="tabular">{fa(i + 1)}.</b> {s}</span>{i < f.steps.length - 1 && <span aria-hidden className="text-ink-4">←</span>}</li>)}</ol></Card>)}

      {tab === "tokens" && (
        <div className="space-y-5">
          <Card className="space-y-3 p-5"><h2 className="font-extrabold">رنگ‌ها</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{TOKENS.colors.map(([n, c]) => <div key={n} className="overflow-hidden rounded-ui shadow-soft"><div className="h-14" style={{ background: c }} /><div className="p-2 text-xs"><div className="font-bold">{n}</div><div dir="ltr" className="text-start font-mono text-ink-3">{c}</div></div></div>)}</div></Card>
          <Card className="p-5"><h2 className="mb-3 font-extrabold">مقیاس‌ها و قواعد</h2><dl className="grid gap-2 text-sm md:grid-cols-[180px_1fr]">{TOKENS.scale.map(([k, v]) => <div key={k} className="contents"><dt className="font-bold text-ink-3">{k}</dt><dd>{v}</dd></div>)}</dl></Card>
        </div>
      )}

      {tab === "writing" && (
        <div className="space-y-5">
          <Card className="space-y-2 p-5"><h2 className="font-extrabold">لحن و اصول</h2><dl className="grid gap-2 text-sm md:grid-cols-[130px_1fr]">{WRITING.voice.map(([k, v]) => <div key={k} className="contents"><dt className="font-bold text-ink-3">{k}</dt><dd className="leading-7">{v}</dd></div>)}</dl></Card>
          <Card className="overflow-x-auto p-0"><table className="w-full min-w-[640px] text-sm"><caption className="p-4 text-start font-extrabold">واژه‌نامه (بگو / نگو)</caption><thead><tr className="bg-surface-2 text-xs text-ink-3"><th className="p-3 text-start">بگو</th><th className="p-3 text-start">نگو</th><th className="p-3 text-start">توضیح</th></tr></thead><tbody className="divide-y divide-line/70">{WRITING.glossary.map(([a, b, c]) => <tr key={a}><td className="p-3 font-bold text-ok">{a}</td><td className="p-3 text-danger line-through">{b}</td><td className="p-3 text-ink-3">{c}</td></tr>)}</tbody></table></Card>
          <Card className="space-y-2 p-5"><h2 className="font-extrabold">فرمول‌ها</h2>{WRITING.formulas.map(([k, v]) => <div key={k} className="rounded-ui bg-surface-2 p-3 text-sm leading-7"><b>{k}:</b> {v}</div>)}</Card>
          <Card className="overflow-x-auto p-0"><table className="w-full min-w-[680px] text-sm"><caption className="p-4 text-start font-extrabold">نمونه‌ی قبل / بعد</caption><thead><tr className="bg-surface-2 text-xs text-ink-3"><th className="p-3 text-start">موقعیت</th><th className="p-3 text-start">قبل</th><th className="p-3 text-start">بعد</th></tr></thead><tbody className="divide-y divide-line/70">{WRITING.examples.map(([a, b, c]) => <tr key={a}><td className="p-3 font-bold">{a}</td><td className="p-3 text-ink-3">{b}</td><td className="p-3 leading-7">{c}</td></tr>)}</tbody></table></Card>
          <Card className="overflow-x-auto p-0"><table className="w-full min-w-[640px] text-sm"><caption className="p-4 text-start font-extrabold">قالب اعلان‌ها (پوش و پیامک)</caption><thead><tr className="bg-surface-2 text-xs text-ink-3"><th className="p-3 text-start">رویداد</th><th className="p-3 text-start">گیرنده</th><th className="p-3 text-start">متن</th></tr></thead><tbody className="divide-y divide-line/70">{WRITING.notifications.map(([a, b, c]) => <tr key={a}><td className="p-3 font-bold">{a}</td><td className="p-3">{b}</td><td className="p-3 leading-7">{c}</td></tr>)}</tbody></table></Card>
        </div>
      )}

      {tab === "figma" && (
        <Card className="space-y-4 p-5">
          <h2 className="font-extrabold">خروجی برای Figma</h2>
          <p className="text-sm leading-7 text-ink-3">توکن‌ها را در افزونه‌ی Tokens Studio وارد کنید، فهرست صفحه‌ها را به‌عنوان چک‌لیست فریم‌ها به Google Sheets/Notion ببرید و برای هر ردیف یک فریم بسازید (هر حالت = یک واریانت).</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => download("kamionet-tokens.json", "application/json", JSON.stringify(figmaTokens, null, 2))}><Download className="size-4" aria-hidden />توکن‌ها (Tokens Studio JSON)</Button>
            <Button variant="secondary" onClick={() => exportCsv("kamionet-screens", ["بخش", "مسیر", "عنوان", "هدف", "اندازه", "حالت‌ها", "کامپوننت‌ها"], SCREENS.map((s) => [s.portal, s.route, s.title, s.purpose, s.sizes, s.states.join(" | "), s.comps.join(" | ")]))}><Download className="size-4" aria-hidden />فهرست صفحه‌ها (CSV)</Button>
            <Button variant="secondary" onClick={() => exportCsv("kamionet-components", ["کامپوننت", "فایل", "واریانت", "اندازه", "حالت‌ها"], COMPONENTS.map((c) => [c.name, c.file, c.variants, c.sizes, c.states]))}><Download className="size-4" aria-hidden />فهرست کامپوننت‌ها (CSV)</Button>
            <Button variant="secondary" onClick={() => download("kamionet-handoff.json", "application/json", JSON.stringify({ screens: SCREENS, components: COMPONENTS, charts: CHARTS, flows: FLOWS, tokens: TOKENS }, null, 2))}><Download className="size-4" aria-hidden />همه‌چیز (JSON)</Button>
          </div>
        </Card>
      )}
    </main>
  );
}
