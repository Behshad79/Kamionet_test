"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Card, Input } from "@/components/ui";
import { fa } from "@/lib/format";
import { AGENCY, AGENCY_GROUP, GRAND, INVENTORY, SEC_LABEL, TOTALS, type Kind, type Sec } from "@/lib/inventory";
import type { Section } from "@/lib/handoffMore";

const KIND_L: Record<Kind, string> = { page: "صفحه", view: "نما/حالت", tab: "تب", sheet: "پنجره‌ی شناور", step: "مرحله", slide: "اسلاید", section: "بخش (غیرشمارشی)" };

/** Generic renderer for long-form sections (context, research, developer, release). */
export function SectionView({ s }: { s: Section }) {
  return (
    <div className="space-y-5">
      <Card className="space-y-1 bg-act-soft p-5"><h2 className="text-xl font-black">{s.title}</h2><p className="text-sm leading-7 text-ink-2">{s.intro}</p></Card>
      {s.blocks.map((b) => (
        <Card key={b.h} className="space-y-3 p-5">
          <h3 className="text-lg font-black">{b.h}</h3>
          {b.note && <p className="rounded-ui bg-warn-bg p-3 text-sm font-bold leading-7 text-warn">{b.note}</p>}
          {b.items && <ul className="list-disc space-y-1.5 ps-5 text-sm leading-8 text-ink-2">{b.items.map((i) => <li key={i}>{i}</li>)}</ul>}
          {b.table && <div className="overflow-x-auto rounded-ui border border-line"><table className="w-full min-w-[640px] text-sm"><thead><tr className="bg-surface-2 text-xs text-ink-3">{b.table.head.map((h) => <th key={h} className="p-3 text-start font-bold">{h}</th>)}</tr></thead><tbody className="divide-y divide-line/70">{b.table.rows.map((r, i) => <tr key={i} className="align-top">{r.map((c, j) => <td key={j} className={`p-3 leading-7 ${j === 0 ? "font-bold" : "text-ink-2"}`}>{c}</td>)}</tr>)}</tbody></table></div>}
        </Card>
      ))}
    </div>
  );
}

/** The exact count of everything that needs design, per group, with a side-by-side against the agency's figures. */
export function InventoryView() {
  const [q, setQ] = useState("");
  const [sec, setSec] = useState<Sec | "">("");
  const [kind, setKind] = useState<Kind | "">("");
  const rows = useMemo(() => INVENTORY.filter((i) => (!sec || i.sec === sec) && (!kind || i.kind === kind) && (!q || `${i.name} ${i.route ?? ""} ${i.parent ?? ""}`.includes(q))), [q, sec, kind]);
  const pv = (sec: Sec) => { const r = TOTALS.find((x) => x.sec === sec)!; return r.pages + r.views; };
  const cmp: [string, string, number, number, number, number, number, number][] = [
    ["۱. پنل صاحب بار", "S", AGENCY.S.pagesViews, pv("S"), AGENCY.S.tabs, TOTALS[0].tabs, AGENCY.S.sheets, TOTALS[0].sheets],
    ["۲. اپلیکیشن راننده", "D", AGENCY.D.pagesViews, pv("D"), AGENCY.D.tabs, TOTALS[2].tabs, AGENCY.D.sheets, TOTALS[2].sheets],
    ["۳. مدیریت سفارش‌های مشتری", "O", AGENCY.O.pagesViews, pv("O") + TOTALS[1].steps, AGENCY.O.tabs, TOTALS[1].tabs, AGENCY.O.sheets, TOTALS[1].sheets],
    ["۴. پنل مدیریت کل", "A", AGENCY.A.pagesViews, pv("A"), AGENCY.A.tabs, TOTALS[3].tabs, 0, TOTALS[3].sheets],
  ];
  return (
    <div className="space-y-5">
      <Card className="space-y-2 bg-act-soft p-5"><h2 className="text-xl font-black">شمارش دقیق: هر چه باید طراحی شود</h2><p className="text-sm leading-7 text-ink-2">این فهرست از روی کد استخراج شده و هر ردیف یک خروجی طراحی است. تعریف‌ها: <b>صفحه</b> = مسیر یا ماژول ادمین · <b>نما/حالت</b> = چیدمان کاملاً متفاوت درون یک صفحه (مثلاً وضعیت‌های سفارش) · <b>تب</b> · <b>پنجره‌ی شناور</b> = Sheet/کشو/دیالوگ · <b>مرحله</b> = گام ویزارد/KYC · <b>اسلاید</b> = آموزش اولیه.</p></Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Card className="p-4"><div className="text-xs font-bold text-ink-3">صفحه‌ی مستقل</div><div className="mt-1 text-3xl font-black tabular">{fa(GRAND.pages)}</div></Card><Card className="p-4"><div className="text-xs font-bold text-ink-3">نما و حالت</div><div className="mt-1 text-3xl font-black tabular">{fa(GRAND.views)}</div></Card><Card className="p-4"><div className="text-xs font-bold text-ink-3">تب</div><div className="mt-1 text-3xl font-black tabular">{fa(GRAND.tabs)}</div></Card><Card className="p-4"><div className="text-xs font-bold text-ink-3">پنجره‌ی شناور</div><div className="mt-1 text-3xl font-black tabular">{fa(GRAND.sheets)}</div></Card><Card className="p-4"><div className="text-xs font-bold text-ink-3">مراحل (ویزارد + KYC)</div><div className="mt-1 text-3xl font-black tabular">{fa(GRAND.steps)}</div></Card><Card className="p-4"><div className="text-xs font-bold text-ink-3">اسلاید آموزش</div><div className="mt-1 text-3xl font-black tabular">{fa(GRAND.slides)}</div></Card><Card className="p-4 md:col-span-2"><div className="text-xs font-bold text-ink-3">جمع کل فریم‌های پایه (بدون ترکیب breakpoint)</div><div className="mt-1 text-3xl font-black tabular">{fa(GRAND.total)}</div></Card></div>
      <Card className="overflow-x-auto p-0"><table className="w-full min-w-[720px] text-sm"><caption className="p-4 text-start font-extrabold">به تفکیک بخش</caption><thead><tr className="bg-surface-2 text-xs text-ink-3">{["بخش", "صفحه", "نما/حالت", "تب", "پنجره", "مرحله", "اسلاید", "جمع"].map((h) => <th key={h} className="p-3 text-start">{h}</th>)}</tr></thead><tbody className="divide-y divide-line/70">{TOTALS.map((r) => <tr key={r.sec}><td className="p-3 font-bold">{SEC_LABEL[r.sec]}</td>{[r.pages, r.views, r.tabs, r.sheets, r.steps, r.slides, r.total].map((n, i) => <td key={i} className={`tabular p-3 ${i === 6 ? "font-black" : ""}`}>{fa(n)}</td>)}</tr>)}<tr className="bg-surface-2 font-black"><td className="p-3">جمع</td>{[GRAND.pages, GRAND.views, GRAND.tabs, GRAND.sheets, GRAND.steps, GRAND.slides, GRAND.total].map((n, i) => <td key={i} className="tabular p-3">{fa(n)}</td>)}</tr></tbody></table></Card>

      <Card className="space-y-3 p-5"><h3 className="text-lg font-black">مقایسه با گزارش آژانس طراحی (۹۴ صفحه و نما، ۵۴ تب، ۹ پنجره، ۷ مرحله KYC، ۴ اسلاید)</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="text-xs text-ink-3"><th className="p-2 text-start">گروه آژانس</th><th className="p-2">صفحه+نما (آژانس)</th><th className="p-2">صفحه+نما (کد)</th><th className="p-2">تب (آژانس / کد)</th><th className="p-2">پنجره (آژانس / کد)</th></tr></thead><tbody className="divide-y divide-line/70">{cmp.map((c) => <tr key={c[0]}><td className="p-2 font-bold">{c[0]}</td><td className="tabular p-2 text-center">{fa(c[2])}</td><td className="tabular p-2 text-center font-black">{fa(c[3])}</td><td className="tabular p-2 text-center">{fa(c[4])} / {fa(c[5])}</td><td className="tabular p-2 text-center">{fa(c[6])} / {fa(c[7])}</td></tr>)}<tr className="bg-surface-2 font-black"><td className="p-2">جمع (کد: با موارد مشترک {fa(pv("P"))} تایی لندینگ/ورود/رهگیری/اسناد)</td><td className="tabular p-2 text-center">{fa(AGENCY.total.pagesViews)}</td><td className="tabular p-2 text-center">{fa(GRAND.pages + GRAND.views + GRAND.steps + GRAND.slides - 4 - 7)}</td><td className="tabular p-2 text-center">{fa(AGENCY.total.tabs)} / {fa(GRAND.tabs)}</td><td className="tabular p-2 text-center">{fa(AGENCY.total.sheets)} / {fa(GRAND.sheets)}</td></tr></tbody></table></div>
        <ul className="list-disc space-y-1.5 ps-5 text-sm leading-8 text-ink-2"><li><b>تب‌ها و اسلایدها تقریباً یکی است</b> (۵۴ در برابر {fa(GRAND.tabs)}؛ ۴ اسلاید) و مراحل KYC هم ۷ تاست؛ پس بخش عمده‌ی گزارش آژانس با کد می‌خواند.</li><li><b>پنجره‌های شناور کم‌شمار گزارش شده‌اند:</b> آژانس ۹ تا آورده ولی {fa(GRAND.sheets)} پنجره‌ی متمایز در محصول هست (پرداخت، لغو، انعام، برداشت، شبا، تسویه، مغایرت، SOS، ویرایش خودرو، تمدید مدرک، کشوهای ۳۶۰ ادمین و …).</li><li><b>مراحل ویزارد ثبت سفارش (۵ مرحله) در گزارش آژانس جداگانه نیامده</b> و باید به محدوده افزوده شود.</li><li><b>پنل مدیریت:</b> آژانس ۵۳ «صفحه و نما» شمرده؛ ما {fa(TOTALS[3].pages)} ماژول + {fa(TOTALS[3].views)} نما + {fa(TOTALS[3].sheets)} کشو داریم ({fa(TOTALS[3].pages + TOTALS[3].views + TOTALS[3].sheets)}). به‌احتمال زیاد آژانس کشوهای ۳۶۰ و پنجره‌ها را جزو «صفحه» شمرده است.</li><li><b>نام بخش‌ها:</b> «اطلاعات شرکت/تنظیمات» در پنل صاحب بار = تب‌ها و Sheetهای پروفایل؛ «خزانه‌داری» = برداشت‌ها و مغایرت‌گیری؛ «بازاریابی» = کد تخفیف و مشوق؛ «تخصیص راننده» = رانندگان آزاد و پیشنهادها.</li><li><b>جمع واقعی:</b> {fa(GRAND.pages + GRAND.views)} صفحه و نما + {fa(GRAND.tabs)} تب + {fa(GRAND.sheets)} پنجره + {fa(GRAND.steps)} مرحله + {fa(GRAND.slides)} اسلاید = {fa(GRAND.total)} فریم پایه، و هر کدام در حداقل دو عرض (۳۷۵ و ۱۲۸۰؛ ادمین ۱۴۴۰) و با حالت‌های خالی/بارگذاری/خطا. برای برآورد زمان و هزینه از این عدد استفاده کنید نه ۹۴.</li></ul></Card>

      <Card className="space-y-3 p-5"><h3 className="text-lg font-black">فهرست کامل ({fa(rows.length)} ردیف)</h3>
        <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden /><Input aria-label="جستجو در فهرست" placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} className="ps-9" /></div>
          <select aria-label="بخش" value={sec} onChange={(e) => setSec(e.target.value as Sec | "")} className="h-12 rounded-ui border border-line bg-white px-3 text-sm"><option value="">همه‌ی بخش‌ها</option>{(Object.keys(SEC_LABEL) as Sec[]).map((k) => <option key={k} value={k}>{SEC_LABEL[k]}</option>)}</select>
          <select aria-label="نوع" value={kind} onChange={(e) => setKind(e.target.value as Kind | "")} className="h-12 rounded-ui border border-line bg-white px-3 text-sm"><option value="">همه‌ی انواع</option>{(Object.keys(KIND_L) as Kind[]).map((k) => <option key={k} value={k}>{KIND_L[k]}</option>)}</select></div>
        <div className="overflow-x-auto rounded-ui border border-line"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-surface-2 text-xs text-ink-3">{["#", "بخش آژانس", "نوع", "نام", "والد", "مسیر"].map((h) => <th key={h} className="p-3 text-start">{h}</th>)}</tr></thead><tbody className="divide-y divide-line/70">{rows.map((r, i) => <tr key={i}><td className="tabular p-3 text-ink-4">{fa(i + 1)}</td><td className="p-3 text-xs">{AGENCY_GROUP[r.sec]}</td><td className="p-3"><Badge tone={r.kind === "page" ? "info" : r.kind === "sheet" ? "brand" : r.kind === "tab" ? "ok" : "neutral"}>{KIND_L[r.kind]}</Badge></td><td className="p-3 font-bold">{r.name}</td><td className="p-3 text-ink-3">{r.parent ?? "—"}</td><td dir="ltr" className="p-3 text-start font-mono text-xs text-ink-3">{r.route ?? ""}</td></tr>)}</tbody></table></div>
      </Card>
    </div>
  );
}
