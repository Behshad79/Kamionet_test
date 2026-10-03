"use client";

import { Check, Search, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Card, Field, Input, NumInput, Select, Sheet, Tabs, Textarea, Toggle } from "../../ui";
import { toast } from "../../Toaster";
import { DataTable, type Col } from "../DataTable";
import { Kpi, KV, PageHead, Panel, Pill, StatusPill, useAdmin } from "../kit";
import { RISK_STATUS } from "@/lib/labels";
import { BarList } from "../charts";
import { ALL_PERMS, CEILINGS, decideApproval, guard, PERM_LABELS, ROLE_LABELS, ROLE_PERMS, setConfigValue, washDecision } from "@/lib/engine/admin";
import { audit, DAY, HOUR, nameOf, notify, now, person, uid } from "@/lib/engine/core";
import { assignTicket, CATEGORIES, CHANNELS, MACROS, moderateReview, publishRule, replyTicket, setTicketStatus } from "@/lib/engine/trust";
import { currentRule } from "@/lib/engine/trust";
import { CONFIG_DEFS, cfgGroups, cv, type CfgDef } from "@/lib/config";
import { fa, jDateTime, relative, toman } from "@/lib/format";
import { R } from "@/lib/money";
import { startViewAs, storageFailed, useStore } from "@/lib/store";
import type { AdminRole, Review, RiskFlag, Ticket, Wash } from "@/lib/types";

const nm = (s: ReturnType<typeof useStore>, id?: string) => nameOf(s, id);

/* ───────────────────────── support center ───────────────────────── */

const TK_TONE = { OPEN: "danger", PENDING: "info", ESCALATED: "warn", RESOLVED: "ok", CLOSED: "neutral" } as const;
const TK_LABEL = { OPEN: "باز", PENDING: "در انتظار کاربر", ESCALATED: "ارجاع‌شده", RESOLVED: "حل‌شده", CLOSED: "بسته" } as const;

export function SupportModule() {
  const s = useStore();
  const { admin, has, run } = useAdmin();
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState("");
  const mine = (["trip", "account", "finance"] as const).filter((c) => has(`support.${c}`));
  const rows = s.tickets.filter((t) => mine.includes(t.channel));
  const t = rows.find((x) => x.id === sel);
  const overdue = rows.filter((x) => ["OPEN", "ESCALATED"].includes(x.status) && x.slaDueAt < now(s));
  const cols: Col<Ticket>[] = [
    { id: "sla", label: "SLA", cell: (x) => ["RESOLVED", "CLOSED"].includes(x.status) ? "—" : <Pill tone={x.slaDueAt < now(s) ? "danger" : "ok"}>{x.slaDueAt < now(s) ? "گذشته" : relative(x.slaDueAt, now(s))}</Pill>, value: (x) => x.slaDueAt },
    { id: "ch", label: "کانال", cell: (x) => CHANNELS[x.channel].label, value: (x) => x.channel },
    { id: "sub", label: "موضوع", cell: (x) => <span className="font-bold">{x.subject}</span>, value: (x) => x.subject },
    { id: "who", label: "کاربر", cell: (x) => `${nm(s, x.personId)} · ${x.portal === "driver" ? "راننده" : "صاحب بار"}`, value: (x) => nm(s, x.personId) },
    { id: "as", label: "مسئول", cell: (x) => (x.assignee ? nm(s, x.assignee) || x.assignee : "—"), value: (x) => x.assignee },
    { id: "pri", label: "اولویت", cell: (x) => (x.priority === "high" ? <Pill tone="danger">بالا</Pill> : x.priority === "low" ? "کم" : "عادی"), value: (x) => x.priority },
    { id: "st", label: "وضعیت", cell: (x) => <Pill tone={TK_TONE[x.status]}>{TK_LABEL[x.status]}</Pill>, value: (x) => x.status },
    { id: "csat", label: "رضایت", cell: (x) => (x.csat ? `${fa(x.csat)}★` : "—"), value: (x) => x.csat, hidden: true },
  ];
  const csat = rows.filter((x) => x.csat);
  return (
    <div>
      <PageHead title="مرکز پشتیبانی" sub="صف تیکت‌ها بر اساس دسترسی نقش شما؛ SLA و پاسخ‌های آماده" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Kpi label="باز" value={fa(rows.filter((x) => x.status === "OPEN").length)} /><Kpi label="گذشته از SLA" value={fa(overdue.length)} tone={overdue.length ? "danger" : "ok"} /><Kpi label="ارجاع‌شده" value={fa(rows.filter((x) => x.status === "ESCALATED").length)} /><Kpi label="رضایت (CSAT)" value={csat.length ? `${fa(Math.round((csat.reduce((n, x) => n + (x.csat ?? 0), 0) / csat.length) * 10) / 10)}★` : "—"} /></div>
      <DataTable id="tickets" rows={rows} rowKey={(x) => x.id} cols={cols} search={(x) => `${x.subject} ${nm(s, x.personId)}`} onRow={(x) => setSel(x.id)}
        filters={[{ id: "ch", label: "کانال", options: mine.map((c) => ({ id: c, label: CHANNELS[c].label })), test: (x, v) => x.channel === v }, { id: "st", label: "وضعیت", options: Object.entries(TK_LABEL).map(([id, label]) => ({ id, label })), test: (x, v) => x.status === v }]} />
      {t && (
        <Sheet open onClose={() => setSel(null)} title={t.subject} wide footer={t.status !== "CLOSED" && (
          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1">{MACROS[t.channel].map((m) => <button key={m.id} onClick={() => setText(m.text)} className="min-h-9 shrink-0 whitespace-nowrap rounded-full bg-surface-3 px-3 text-xs font-bold hover:bg-act-soft">{m.title}</button>)}</div>
            <Textarea aria-label="پاسخ" placeholder="پاسخ به کاربر…" value={text} onChange={(e) => setText(e.target.value)} />
            <Button block onClick={() => { const r = run((x) => replyTicket(x, t.id, "agent", text, admin.name)); if (r.ok) setText(""); }}><Send className="size-4" aria-hidden />ارسال پاسخ</Button>
          </div>)}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><Pill tone={TK_TONE[t.status]}>{TK_LABEL[t.status]}</Pill><Pill>{t.category}</Pill>{t.orderId && <Pill tone="info">{t.orderId}</Pill>}</div>
            <dl className="divide-y divide-line/70 rounded-2xl bg-white px-4 shadow-soft"><KV k="کاربر" v={nm(s, t.personId)} /><KV k="تلفن" v={<span dir="ltr">{person(s, t.personId)?.phone}</span>} /><KV k="ثبت" v={jDateTime(t.at)} /><KV k="مهلت پاسخ" v={jDateTime(t.slaDueAt)} />{t.context && Object.entries(t.context).map(([k, v]) => <KV key={k} k={k} v={v} />)}</dl>
            <ul className="space-y-2">{t.messages.map((m, i) => <li key={i} className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-7 ${m.from === "agent" ? "ms-auto bg-accent-50" : m.from === "system" ? "mx-auto bg-surface-3 text-xs text-ink-3" : "bg-white shadow-soft"}`}>{m.text}<div className="mt-1 text-[11px] text-ink-3">{m.by ?? (m.from === "user" ? "کاربر" : "سیستم")} · {jDateTime(m.at)}</div></li>)}</ul>
            <div className="flex flex-wrap gap-2">
              {t.status !== "RESOLVED" && <Button size="sm" variant="secondary" onClick={() => run((x, a) => { const g = guard(x, a, `support.${t.channel}`); if (g.ok) setTicketStatus(x, g.actor, t.id, "RESOLVED"); return g; }, "حل‌شده")}>علامت‌گذاری حل‌شده</Button>}
              {t.status !== "ESCALATED" && <Button size="sm" variant="secondary" onClick={() => run((x, a) => { const g = guard(x, a, `support.${t.channel}`); if (g.ok) setTicketStatus(x, g.actor, t.id, "ESCALATED"); return g; }, "ارجاع شد")}>ارجاع به ارشد</Button>}
              {t.assignee !== admin.id && <Button size="sm" variant="secondary" onClick={() => run((x, a) => { const g = guard(x, a, `support.${t.channel}`); if (g.ok) assignTicket(x, g.actor, t.id, admin.id); return g; }, "به شما اختصاص یافت")}>اختصاص به من</Button>}
              <Button size="sm" variant="ghost" onClick={() => { startViewAs(admin.id, t.portal, t.personId); window.location.href = t.portal === "driver" ? "/driver/" : "/app/"; }}>مشاهده به‌جای کاربر</Button>
            </div>
          </div>
        </Sheet>
      )}
      <span className="sr-only">{Object.keys(CATEGORIES).length}</span>
    </div>
  );
}

/* ───────────────────────── pricing & config ───────────────────────── */

const fmtCfg = (d: CfgDef, v: unknown) => d.kind === "pct" ? `${fa(Math.round((v as number) * 1000) / 10)}٪` : d.kind === "rial" ? toman(v as number) : d.kind === "bool" ? (v ? "فعال" : "غیرفعال") : d.kind === "enum" ? d.options?.find((o) => o.id === v)?.label ?? String(v) : d.kind === "min" ? `${fa(v as number)} دقیقه` : d.kind === "hour" ? `${fa(v as number)} ساعت` : d.kind === "day" ? `${fa(v as number)} روز` : fa(v as number);

export function ConfigModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const groups = cfgGroups();
  const [g, setG] = useState(groups[0]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<CfgDef | null>(null);
  const [val, setVal] = useState<string>("");
  const [when, setWhen] = useState<"now" | "tomorrow">("now");
  const defs = CONFIG_DEFS.filter((d) => (q ? d.label.includes(q) || d.key.includes(q) : d.group === g));
  const toVal = (d: CfgDef) => d.kind === "pct" ? Number(val) / 100 : d.kind === "rial" ? R(Number(val)) : d.kind === "bool" ? val === "true" : d.kind === "enum" ? val : Number(val);
  const toInput = (d: CfgDef, v: unknown) => d.kind === "pct" ? String(Math.round((v as number) * 1000) / 10) : d.kind === "rial" ? String((v as number) / 10) : String(v);
  return (
    <div>
      <PageHead title="قیمت‌گذاری و تنظیمات" sub="همه‌ی اعداد کسب‌وکار اینجا قابل تغییرند؛ هر تغییر ممیزی می‌شود و می‌تواند برای فردا زمان‌بندی شود" />
      <div className="mb-4 flex flex-wrap items-center gap-3"><div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden /><Input aria-label="جستجوی پارامتر" placeholder="جستجوی پارامتر…" value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" /></div></div>
      {!q && <Tabs value={g} onChange={setG} tabs={groups.map((x) => ({ id: x, label: x }))} className="mb-4" />}
      <Card className="divide-y divide-line/70">{defs.map((d) => { const cur = cv(s, d.key); const changed = cur !== d.default; return (
        <div key={d.key} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><div className="font-bold">{d.label}{changed && <Badge tone="warn" className="ms-2">تغییر‌یافته</Badge>}</div><div className="text-xs text-ink-3">{d.key}{d.help ? ` · ${d.help}` : ""} · پیش‌فرض {fmtCfg(d, d.default)}</div></div>
          <div className="flex items-center gap-3"><b className="tabular text-lg">{fmtCfg(d, cur)}</b>{has("pricing") || has("finance.config") ? <Button size="sm" variant="secondary" onClick={() => { setEdit(d); setVal(toInput(d, cur)); setWhen("now"); }}>ویرایش</Button> : null}</div></div>); })}</Card>
      {s.config.scheduled.length > 0 && <Panel title="تغییرهای زمان‌بندی‌شده" className="mt-5"><ul className="divide-y divide-line/70 text-sm">{s.config.scheduled.map((c) => <li key={c.id} className="flex justify-between gap-3 py-2"><span>{CONFIG_DEFS.find((d) => d.key === c.key)?.label}: {String(c.from)} ← {String(c.to)}</span><span className="text-ink-3">اعمال {jDateTime(c.effectiveAt)}</span></li>)}</ul></Panel>}
      <Panel title="تاریخچه‌ی تغییرها" className="mt-5">{s.config.history.length === 0 ? <p className="text-sm text-ink-3">تغییری ثبت نشده است.</p> : <ul className="divide-y divide-line/70 text-sm">{s.config.history.slice(0, 25).map((c) => <li key={c.id} className="flex flex-wrap justify-between gap-3 py-2"><span><b>{CONFIG_DEFS.find((d) => d.key === c.key)?.label ?? c.key}</b>: {String(c.from)} ← {String(c.to)}</span><span className="text-ink-3">{c.by} · {jDateTime(c.at)}</span></li>)}</ul>}</Panel>
      {edit && (
        <Sheet open onClose={() => setEdit(null)} title={edit.label} footer={<Button block onClick={() => { const r = run((x, a) => setConfigValue(x, a, edit.key, toVal(edit), when === "tomorrow" ? now(x) + DAY : undefined), when === "tomorrow" ? "برای فردا زمان‌بندی شد" : "اعمال شد"); if (r.ok) setEdit(null); }}>ذخیره</Button>}>
          <div className="space-y-4"><p className="text-xs text-ink-3">{edit.key} · مقدار فعلی {fmtCfg(edit, cv(s, edit.key))}</p>
            {edit.kind === "bool" ? <Toggle label={edit.label} checked={val === "true"} onChange={(v) => setVal(String(v))} /> : edit.kind === "enum" ? <Select aria-label={edit.label} value={val} onChange={(e) => setVal(e.target.value)}>{edit.options!.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select> : <Field label={edit.kind === "pct" ? "مقدار (درصد)" : edit.kind === "rial" ? "مقدار (تومان)" : "مقدار"}>{(id) => <NumInput id={id} allowDecimal value={Number(val)} onChange={(v) => setVal(String(v ?? 0))} />}</Field>}
            <Field label="زمان اعمال">{(id) => <Select id={id} value={when} onChange={(e) => setWhen(e.target.value as "now" | "tomorrow")}><option value="now">همین حالا</option><option value="tomorrow">از فردا (زمان‌بندی)</option></Select>}</Field></div>
        </Sheet>
      )}
    </div>
  );
}

/* ───────────────────────── team / RBAC / approvals / audit ───────────────────────── */

export function TeamModule() {
  const s = useStore();
  const roles = Object.keys(ROLE_LABELS) as AdminRole[];
  const perms = ALL_PERMS;
  return (
    <div>
      <PageHead title="تیم و دسترسی‌ها" sub="ماتریس نقش‌ها؛ هر نقش فقط همان بخش‌هایی را می‌بیند که لازم دارد" />
      <Card className="mb-5 divide-y divide-line/70">{s.admins.map((a) => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><div className="font-bold">{a.name}</div><div className="text-xs text-ink-3" dir="ltr">{a.phone}</div></div><div className="flex items-center gap-2"><Pill tone="info">{ROLE_LABELS[a.role]}</Pill><Pill tone={a.twoFA ? "ok" : "warn"}>{a.twoFA ? "۲FA فعال" : "بدون ۲FA"}</Pill><Pill tone={a.active ? "ok" : "danger"}>{a.active ? "فعال" : "غیرفعال"}</Pill></div></div>)}</Card>
      <Panel title="ماتریس دسترسی"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr><th scope="col" className="py-2 text-start text-xs text-ink-3">دسترسی</th>{roles.map((r) => <th scope="col" key={r} className="px-2 text-center text-xs text-ink-3">{ROLE_LABELS[r]}</th>)}</tr></thead><tbody className="divide-y divide-line/70">{perms.map((p) => <tr key={p}><th scope="row" className="py-2 text-start font-medium">{PERM_LABELS[p]}</th>{roles.map((r) => <td key={r} className="text-center">{ROLE_PERMS[r].includes(p) ? <Check className="mx-auto size-4 text-ok" aria-label="دارد" /> : <span className="text-ink-3" aria-label="ندارد">—</span>}</td>)}</tr>)}</tbody></table></div></Panel>
      <Panel title="سقف تأیید مستقیم (بالاتر از آن تأیید نفر دوم لازم است)" className="mt-5"><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead><tr className="text-xs text-ink-3"><th className="py-2 text-start">نقش</th><th>بازپرداخت</th><th>تعدیل</th><th>برداشت</th></tr></thead><tbody className="divide-y divide-line/70">{roles.filter((r) => CEILINGS[r].refund + CEILINGS[r].adjust + CEILINGS[r].payout > 0).map((r) => <tr key={r}><td className="py-2 font-bold">{ROLE_LABELS[r]}</td>{(["refund", "adjust", "payout"] as const).map((k) => <td key={k} className="tabular text-center">{CEILINGS[r][k] === Infinity ? "نامحدود" : toman(CEILINGS[r][k])}</td>)}</tr>)}</tbody></table></div></Panel>
    </div>
  );
}

export function ApprovalsModule() {
  const s = useStore();
  const { admin, run } = useAdmin();
  const [reason, setReason] = useState("");
  const pend = s.approvals.filter((a) => a.status === "PENDING");
  return (
    <div>
      <PageHead title="تأییدهای دو نفره" sub="اقدام‌های حساس مالی و انضباطی پیش از اجرا باید نفر دوم تأیید کند" />
      <Panel title={`در انتظار (${fa(pend.length)})`} className="mb-5">{pend.length === 0 && <p className="text-sm text-ink-3">موردی در انتظار نیست.</p>}<ul className="divide-y divide-line/70">{pend.map((a) => { const mineReq = a.requestedBy === admin.id || a.requestedBy === admin.name; const allowed = a.needs.includes(admin.role) && !mineReq; return <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-bold">{a.title}</div><div className="text-xs text-ink-3">{jDateTime(a.at)} · درخواست از {s.admins.find((x) => x.id === a.requestedBy)?.name ?? a.requestedBy} · نیازمند {a.needs.map((r) => ROLE_LABELS[r]).join(" / ")}</div></div><div className="flex items-center gap-2">{allowed ? <><Button size="sm" variant="secondary" onClick={() => run((x, ad) => decideApproval(x, ad, a.id, false, reason || "رد شد"), "رد شد")}><X className="size-4" aria-hidden />رد</Button><Button size="sm" onClick={() => run((x, ad) => decideApproval(x, ad, a.id, true), "تأیید و اجرا شد")}><Check className="size-4" aria-hidden />تأیید</Button></> : <Pill tone="warn">{mineReq ? "درخواست خودتان است" : "نقش شما مجاز نیست"}</Pill>}</div></li>; })}</ul>{pend.length > 0 && <div className="mt-3 max-w-md"><Input aria-label="دلیل رد (اختیاری)" placeholder="دلیل رد (اختیاری)" value={reason} onChange={(e) => setReason(e.target.value)} /></div>}</Panel>
      <Panel title="تاریخچه"><ul className="divide-y divide-line/70 text-sm">{s.approvals.filter((a) => a.status !== "PENDING").slice(0, 30).map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{a.title}</span><span className="flex items-center gap-2"><Pill tone={a.status === "APPROVED" ? "ok" : "danger"}>{a.status === "APPROVED" ? "تأیید" : "رد"}</Pill><span className="text-xs text-ink-3">{a.decidedAt ? jDateTime(a.decidedAt) : ""}</span></span></li>)}</ul></Panel>
    </div>
  );
}

export function AuditModule() {
  const s = useStore();
  const cols: Col<(typeof s.audit)[number]>[] = [
    { id: "at", label: "زمان", cell: (a) => jDateTime(a.at), value: (a) => a.at },
    { id: "who", label: "عامل", cell: (a) => a.actorLabel, value: (a) => a.actorLabel },
    { id: "act", label: "اقدام", cell: (a) => <span className="tabular text-xs">{a.action}</span>, value: (a) => a.action },
    { id: "d", label: "جزئیات", cell: (a) => a.detail, value: (a) => a.detail },
    { id: "t", label: "هدف", cell: (a) => <span className="tabular text-xs">{a.target ?? "—"}</span>, value: (a) => a.target },
    { id: "ip", label: "IP", cell: (a) => <span dir="ltr" className="text-xs">{a.ip ?? "—"}</span>, value: (a) => a.ip, hidden: true },
  ];
  return (<div><PageHead title="گزارش ممیزی" sub="هر اقدام ادمین و سیستم؛ غیرقابل ویرایش" /><DataTable id="audit" rows={s.audit} rowKey={(a) => a.id} cols={cols} search={(a) => `${a.actorLabel} ${a.action} ${a.detail} ${a.target ?? ""}`} filters={[{ id: "ty", label: "نوع عامل", options: [{ id: "admin", label: "ادمین" }, { id: "system", label: "سیستم" }, { id: "person", label: "کاربر" }], test: (a, v) => a.actorType === v }]} /></div>);
}

/* ───────────────────────── rules CMS ───────────────────────── */

export function RulesModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const [aud, setAud] = useState<"driver" | "shipper">("driver");
  const cur = currentRule(s, aud);
  const [draft, setDraft] = useState<string>("");
  const [loaded, setLoaded] = useState("");
  if (cur && loaded !== `${aud}:${cur.version}`) { setLoaded(`${aud}:${cur.version}`); setDraft(cur.sections.map((x) => `# ${x.title}\n${x.items.map((i) => `- ${i}`).join("\n")}`).join("\n\n")); }
  const parse = () => draft.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => { const [h, ...rest] = b.split("\n"); return { title: h.replace(/^#\s*/, ""), items: rest.map((l) => l.replace(/^-\s*/, "")).filter(Boolean) }; });
  return (
    <div>
      <PageHead title="قوانین و سیاست‌ها" sub="انتشار نسخه‌ی جدید، پذیرش مجدد را برای همه‌ی کاربران فعال می‌کند" />
      <Tabs value={aud} onChange={setAud} tabs={[{ id: "driver", label: "رانندگان" }, { id: "shipper", label: "صاحبان بار" }]} className="mb-4" />
      <div className="grid gap-5 lg:grid-cols-3"><Panel title={`ویرایش · نسخه‌ی فعلی ${fa(cur?.version ?? 0)}`} className="lg:col-span-2"><p className="mb-2 text-xs text-ink-3">هر بخش با «# عنوان» شروع می‌شود و موارد با «- ». بخش‌ها با یک خط خالی جدا می‌شوند.</p><Textarea aria-label="متن قوانین" rows={16} value={draft} onChange={(e) => setDraft(e.target.value)} className="font-mono text-sm" />{has("rules") && <Button className="mt-3" onClick={() => { const sections = parse(); if (!sections.length) return toast("متن خالی است.", "err"); run((x, a) => { const g = guard(x, a, "rules"); return g.ok ? publishRule(x, g.actor, aud, { sections, keyPoints: currentRule(x, aud)?.keyPoints ?? [] }) : g; }, "نسخه‌ی جدید منتشر شد"); }}>انتشار نسخه‌ی جدید</Button>}</Panel>
        <Panel title="پذیرش"><div className="text-sm"><div className="mb-2">{fa(s.acceptances.filter((x) => x.audience === aud && x.version === cur?.version).length)} نفر نسخه‌ی فعلی را پذیرفته‌اند</div><ul className="divide-y divide-line/70 text-xs text-ink-3">{s.rules.filter((r) => r.audience === aud).map((r) => <li key={r.id} className="py-2">نسخه‌ی {fa(r.version)} · {jDateTime(r.publishedAt)}</li>)}</ul></div></Panel></div>
    </div>
  );
}

/* ───────────────────────── reviews / washes / risk ───────────────────────── */

export function ReviewsModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const cols: Col<Review>[] = [
    { id: "at", label: "زمان", cell: (r) => jDateTime(r.at), value: (r) => r.at },
    { id: "f", label: "از", cell: (r) => nm(s, r.fromId), value: (r) => nm(s, r.fromId) },
    { id: "t", label: "به", cell: (r) => nm(s, r.toId), value: (r) => nm(s, r.toId) },
    { id: "o", label: "امتیاز", cell: (r) => `${fa(r.overall)}★`, value: (r) => r.overall, num: true },
    { id: "c", label: "متن", cell: (r) => <span className="line-clamp-2 max-w-md">{r.comment || "—"}</span>, value: (r) => r.comment },
    { id: "m", label: "وضعیت", cell: (r) => <Pill tone={r.moderation === "reported" ? "warn" : r.moderation === "hidden" ? "danger" : "ok"}>{{ ok: "منتشر", reported: "گزارش‌شده", hidden: "پنهان" }[r.moderation]}</Pill>, value: (r) => r.moderation },
    { id: "a", label: "", cell: (r) => has("reviews") ? <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); run((x, a) => { const g = guard(x, a, "reviews"); return g.ok ? moderateReview(x, g.actor, r.id, r.moderation === "hidden" ? "ok" : "hidden") : g; }); }}>{r.moderation === "hidden" ? "نمایش" : "پنهان‌کردن"}</Button> : null },
  ];
  return (<div><PageHead title="نظرات و امتیازها" sub="نظرهای گزارش‌شده اول نمایش داده می‌شوند" /><DataTable id="reviews" rows={[...s.reviews].sort((a, b) => Number(b.moderation === "reported") - Number(a.moderation === "reported"))} rowKey={(r) => r.id} cols={cols} search={(r) => `${nm(s, r.fromId)} ${nm(s, r.toId)} ${r.comment}`} filters={[{ id: "m", label: "وضعیت", options: [{ id: "reported", label: "گزارش‌شده" }, { id: "hidden", label: "پنهان" }, { id: "ok", label: "منتشر" }], test: (r, v) => r.moderation === v }]} /></div>);
}

export function WashesModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const [sel, setSel] = useState<Wash | null>(null);
  const q = s.washes.filter((w) => w.status === "PENDING");
  return (
    <div>
      <PageHead title="برنامه‌ی نظافت" sub="تأیید عکس قبل/بعد شست‌وشو و اعطای نشان «تمیز تأییدشده»" />
      <Panel title={`در انتظار (${fa(q.length)})`}>{q.length === 0 && <p className="text-sm text-ink-3">موردی نیست.</p>}<ul className="divide-y divide-line/70">{q.map((w) => <li key={w.id} className="flex items-center justify-between gap-3 py-3"><div><div className="font-bold">{nm(s, w.driverId)}</div><div className="text-xs text-ink-3">{jDateTime(w.at)} · {s.washPartners.find((p) => p.id === w.partnerId)?.name ?? "شست‌وشوی شخصی"}</div></div><Button size="sm" onClick={() => setSel(w)}>بررسی</Button></li>)}</ul></Panel>
      <Panel title="شریک‌های شست‌وشو" className="mt-5"><ul className="divide-y divide-line/70 text-sm">{s.washPartners.map((p) => <li key={p.id} className="flex justify-between py-2"><span>{p.name} · {p.city}</span><span className="text-ink-3">{fa(p.creditPct)}٪ اعتبار</span></li>)}</ul></Panel>
      {sel && <Sheet open onClose={() => setSel(null)} title={`شست‌وشوی ${nm(s, sel.driverId)}`} footer={has("cleanliness") ? <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => { run((x, a) => washDecision(x, a, sel.id, false), "رد شد"); setSel(null); }}>رد</Button><Button onClick={() => { run((x, a) => washDecision(x, a, sel.id, true), "تأیید شد"); setSel(null); }}>تأیید</Button></div> : null}><div className="grid grid-cols-2 gap-3 text-center text-xs">{[sel.before, sel.after].map((src, i) => <figure key={i}>{src ? <img src={src} alt={i ? "بعد از شست‌وشو" : "قبل از شست‌وشو"} className="aspect-square w-full rounded-2xl object-cover" /> : <div className="grid aspect-square place-items-center rounded-2xl bg-surface-3 text-ink-3">بدون تصویر</div>}<figcaption className="mt-1">{i ? "بعد" : "قبل"}</figcaption></figure>)}</div></Sheet>}
    </div>
  );
}

export function RiskModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const set = (f: RiskFlag, st: RiskFlag["status"]) => run((x, a) => { const g = guard(x, a, "risk"); if (!g.ok) return g; const r = x.risk.find((y) => y.id === f.id); if (r) r.status = st; audit(x, g.actor, "risk.decide", `${st}`, f.id); return { ok: true as const }; });
  const cols: Col<RiskFlag>[] = [
    { id: "at", label: "زمان", cell: (f) => jDateTime(f.at), value: (f) => f.at },
    { id: "k", label: "نوع", cell: (f) => f.kind, value: (f) => f.kind },
    { id: "p", label: "کاربر", cell: (f) => nm(s, f.personId), value: (f) => nm(s, f.personId) },
    { id: "sv", label: "شدت", cell: (f) => <Pill tone={f.severity === "high" ? "danger" : f.severity === "medium" ? "warn" : "neutral"}>{{ high: "بالا", medium: "متوسط", low: "کم" }[f.severity]}</Pill>, value: (f) => f.severity },
    { id: "d", label: "شرح", cell: (f) => f.detail, value: (f) => f.detail },
    { id: "st", label: "وضعیت", cell: (f) => <StatusPill map={RISK_STATUS} v={f.status} />, value: (f) => RISK_STATUS[f.status][0] },
    { id: "a", label: "", cell: (f) => has("risk") && ["OPEN", "REVIEW"].includes(f.status) ? <span className="flex gap-1"><Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); set(f, "CLEARED"); }}>رفع</Button><Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); set(f, "CONFIRMED"); }}>تأیید تقلب</Button></span> : null },
  ];
  return (<div><PageHead title="تقلب و ریسک" sub="پرچم‌های خودکار: همسان‌بودن شبا، رفتار برداشت، تکرار لغو و…" /><DataTable id="risk" rows={s.risk} rowKey={(f) => f.id} cols={cols} search={(f) => `${f.kind} ${nm(s, f.personId)} ${f.detail}`} filters={[{ id: "st", label: "وضعیت", options: Object.entries(RISK_STATUS).map(([id, [label]]) => ({ id, label })), test: (f, v) => f.status === v }]} /></div>);
}

/* ───────────────────────── broadcasts + SMS log ───────────────────────── */

export function BroadcastsModule() {
  const s = useStore();
  const { run } = useAdmin();
  const [aud, setAud] = useState<"drivers" | "shippers" | "pro">("drivers");
  const [text, setText] = useState("");
  const [sms, setSms] = useState(true);
  const targets = useMemo(() => aud === "shippers" ? s.shippers.map((x) => x.personId) : aud === "pro" ? s.drivers.filter((d) => d.pro.status === "pro").map((d) => d.personId) : s.drivers.map((d) => d.personId), [s, aud]);
  const smsCols: Col<(typeof s.sms)[number]>[] = [
    { id: "at", label: "زمان", cell: (m) => jDateTime(m.at), value: (m) => m.at },
    { id: "to", label: "گیرنده", cell: (m) => <span dir="ltr">{m.to}</span>, value: (m) => m.to },
    { id: "n", label: "نام", cell: (m) => nm(s, m.personId), value: (m) => nm(s, m.personId) },
    { id: "k", label: "نوع", cell: (m) => m.kind, value: (m) => m.kind },
    { id: "t", label: "متن", cell: (m) => <span className="line-clamp-1 max-w-lg">{m.text}</span>, value: (m) => m.text },
  ];
  return (
    <div>
      <PageHead title="اعلان‌ها و پیامک" sub="ارسال گروهی (اعلان درون‌برنامه + پیامک) و گزارش پیامک‌های ارسالی" />
      <Panel title="ارسال گروهی" className="mb-5"><div className="grid gap-3 md:grid-cols-3"><Field label="مخاطب">{(id) => <Select id={id} value={aud} onChange={(e) => setAud(e.target.value as typeof aud)}><option value="drivers">همه‌ی رانندگان</option><option value="pro">رانندگان پرو</option><option value="shippers">صاحبان بار</option></Select>}</Field><div className="md:col-span-2"><Field label={`متن پیام (${fa(targets.length)} گیرنده)`}>{(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} />}</Field></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><Toggle label="ارسال پیامک هم‌زمان" checked={sms} onChange={setSms} /><Button onClick={() => { if (!text.trim()) return toast("متن پیام را بنویسید.", "err"); run((x) => { for (const id of targets) { notify(x, id, aud === "shippers" ? "shipper" : "driver", "broadcast", text, aud === "shippers" ? "/app/notifications/" : "/driver/notifications/"); if (sms) { const ph = person(x, id)?.phone; if (ph) x.sms.unshift({ id: uid(x, "sms"), at: now(x), personId: id, to: ph, kind: "broadcast", text: `کامیونت: ${text}` }); } } return { ok: true as const }; }, `برای ${fa(targets.length)} نفر ارسال شد`); setText(""); }}><Send className="size-4" aria-hidden />ارسال</Button></div></Panel>
      <DataTable id="sms" rows={s.sms} rowKey={(m) => m.id} cols={smsCols} search={(m) => `${m.to} ${m.text} ${nm(s, m.personId)}`} />
    </div>
  );
}

/* ───────────────────────── master data / integrations / system health ───────────────────────── */

export function MasterModule() {
  const s = useStore();
  const { run, has } = useAdmin();
  const [ed, setEd] = useState<string | null>(null);
  const [v, setV] = useState({ min: 0, max: 0 });
  return (
    <div>
      <PageHead title="داده‌های پایه" sub="نرخ‌نامه‌ی مرجع مسیرها (راهنمای قیمت)، بیمه‌گرها و شرکای شست‌وشو" />
      <Panel title="نرخ‌نامه‌ی مسیرها"><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead><tr className="text-xs text-ink-3"><th className="py-2 text-start">مسیر</th><th className="text-end">حداقل</th><th className="text-end">حداکثر</th><th /></tr></thead><tbody className="divide-y divide-line/70">{s.rates.map((r) => <tr key={r.id}><td className="py-2 font-bold">{r.from} ← {r.to}</td><td className="tabular text-end">{toman(r.min)}</td><td className="tabular text-end">{toman(r.max)}</td><td className="text-end">{has("master") && <Button size="sm" variant="secondary" onClick={() => { setEd(r.id); setV({ min: r.min / 10, max: r.max / 10 }); }}>ویرایش</Button>}</td></tr>)}</tbody></table></div></Panel>
      <Panel title="بیمه‌گرها" className="mt-5"><ul className="flex flex-wrap gap-2 text-sm">{s.insurers.map((i) => <li key={i.id} className="rounded-full bg-surface-3 px-3 py-1 font-bold">{i.name}</li>)}</ul></Panel>
      {ed && <Sheet open onClose={() => setEd(null)} title="ویرایش نرخ" footer={<Button block onClick={() => { if (v.max < v.min) return toast("حداکثر باید بیشتر از حداقل باشد.", "err"); run((x, a) => { const g = guard(x, a, "master"); if (!g.ok) return g; const r = x.rates.find((y) => y.id === ed); if (r) { r.min = R(v.min); r.max = R(v.max); } audit(x, g.actor, "rates.edit", ed, ed); return { ok: true as const }; }, "ذخیره شد"); setEd(null); }}>ذخیره</Button>}><div className="space-y-3"><Field label="حداقل (تومان)">{(id) => <NumInput id={id} value={v.min} onChange={(n) => setV({ ...v, min: n ?? 0 })} allowDecimal={false} />}</Field><Field label="حداکثر (تومان)">{(id) => <NumInput id={id} value={v.max} onChange={(n) => setV({ ...v, max: n ?? 0 })} allowDecimal={false} />}</Field></div></Sheet>}
    </div>
  );
}

const INTEGRATIONS = [
  { n: "درگاه پرداخت", d: "پرداخت کارتی، شاپرک — شبیه‌ساز", ok: true },
  { n: "پیامک", d: "ارسال کد ورود و اعلان‌ها — شبیه‌ساز (گزارش در «اعلان‌ها و پیامک»)", ok: true },
  { n: "استعلام احراز هویت (شاهکار / سجام)", d: "تطبیق کد ملی با سیم‌کارت — در حالت تست همیشه موفق", ok: true },
  { n: "استعلام شبا", d: "تطبیق نام صاحب حساب — در حالت تست قابل کنترل", ok: true },
  { n: "بیمه‌گرها (API)", d: "صدور بیمه‌نامه و خسارت — خروجی دستی", ok: false },
  { n: "نقشه و مسیریابی", d: "کاشی‌های OpenStreetMap — نیازمند اینترنت", ok: true },
  { n: "اپ‌های موبایل (Push)", d: "اعلان مرورگر از طریق Service Worker", ok: true },
  { n: "ردیاب دمای خودرو (IoT)", d: "ثبت‌کننده‌ی دما — داده‌ی شبیه‌سازی‌شده", ok: false },
];

export function SystemModule() {
  const s = useStore();
  const rows = [["سفارش‌ها", s.orders.length], ["اشخاص", s.persons.length], ["ثبت‌های دفتر کل", s.ledger.length], ["پرداخت‌ها", s.payments.length], ["اعلان‌ها", s.notifications.length], ["پیامک‌ها", s.sms.length], ["ممیزی", s.audit.length]] as const;
  const approx = Math.round(JSON.stringify({ o: s.orders.length, l: s.ledger.length }).length);
  void approx; void HOUR;
  return (
    <div>
      <PageHead title="سلامت سیستم و یکپارچه‌سازی‌ها" sub="این نمونه‌ی نمایشی است؛ همه‌ی سرویس‌های بیرونی شبیه‌سازی شده‌اند" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Kpi label="ذخیره‌سازی" value={storageFailed() ? "ناموفق" : "سالم"} tone={storageFailed() ? "danger" : "ok"} sub="IndexedDB (مرورگر)" /><Kpi label="نسخه‌ی داده" value={fa(s.version)} /><Kpi label="حالت" value="نمایشی" sub="داده‌ی ساختگی" /><Kpi label="ساعت سیستم" value={jDateTime(now(s))} /></div>
      <div className="grid gap-5 lg:grid-cols-2"><Panel title="حجم داده"><BarList rows={rows.map(([label, value]) => ({ label, value }))} /></Panel>
        <Panel title="یکپارچه‌سازی‌ها"><ul className="divide-y divide-line/70 text-sm">{INTEGRATIONS.map((i) => <li key={i.n} className="flex items-start justify-between gap-3 py-2.5"><div><div className="font-bold">{i.n}</div><div className="text-xs text-ink-3">{i.d}</div></div><Pill tone={i.ok ? "ok" : "neutral"}>{i.ok ? "شبیه‌ساز فعال" : "خروجی دستی"}</Pill></li>)}</ul></Panel></div>
    </div>
  );
}
