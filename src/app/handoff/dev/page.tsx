"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { ADMIN_MODS } from "@/components/admin/adminNav";
import { CONFIG_DEFS } from "@/lib/config";
import { CEILINGS, PERM_LABELS, ROLE_LABELS, ROLE_PERMS } from "@/lib/engine/admin";
import { exportCsv } from "@/lib/export";
import { fa } from "@/lib/format";
import { DEV_EXTRA } from "@/lib/handoffDev";
import { DEV, RELEASE, type Section } from "@/lib/handoffMore";
import { INVENTORY } from "@/lib/inventory";
import { SectionView } from "../Views";

type Tab = "arch" | "gen" | "extra" | "release";
const TABS: { id: Tab; label: string }[] = [{ id: "arch", label: "معماری و مدل داده" }, { id: "gen", label: "جداول خودکار از کد" }, { id: "extra", label: "ماشین حالت، دفتر کل، امنیت، یکپارچگی" }, { id: "release", label: "انتشار: وب، بازار، اپ‌استور" }];
const EXTRA: Section = { id: "extra", title: "قراردادها و پیشنهادهای پیاده‌سازی", intro: "آنچه برای ساخت بک‌اند واقعی و حفظ رفتار فعلی لازم است. بخش‌هایی که «پیشنهاد» نوشته شده تصمیم نهایی نیستند.", blocks: DEV_EXTRA };

/** Developer hand-off on its own page. Tables marked "auto" are generated from the live code so they cannot drift. */
export default function Page() {
  const [tab, setTab] = useState<Tab>("arch");
  const [q, setQ] = useState("");
  const cfg = useMemo(() => CONFIG_DEFS.filter((c) => !q || `${c.key} ${c.label} ${c.group}`.includes(q)), [q]);
  const roles = Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[];
  const stat = (l: string, v: number) => <Card className="p-4"><div className="text-xs font-bold text-ink-3">{l}</div><div className="mt-1 text-3xl font-black tabular">{fa(v)}</div></Card>;
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 py-8" data-portal="admin">
      <meta name="robots" content="noindex" />
      <header className="space-y-1"><a href="../" className="text-sm font-bold text-accent-700">← راهنمای طراح</a><h1 className="text-3xl font-black">هنداف توسعه‌دهنده</h1><p className="text-sm leading-7 text-ink-3">معماری، مدل داده، قراردادها، جدول‌های خودکار از روی کد، امنیت، یکپارچگی‌ها و مسیر انتشار. آنچه «خودکار» است از همین کد ساخته می‌شود و هرگز با پروژه ناهمگام نمی‌ماند.</p></header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{stat("پارامتر قابل‌ویرایش", CONFIG_DEFS.length)}{stat("ماژول مدیریت", ADMIN_MODS.length)}{stat("نقش مدیریتی", roles.length)}{stat("مجوز", Object.keys(PERM_LABELS).length)}{stat("ردیف فهرست طراحی", INVENTORY.length)}</div>
      <nav aria-label="بخش‌ها" className="flex flex-wrap gap-1.5 rounded-ui bg-ink/[0.045] p-1.5">{TABS.map((x) => <button key={x.id} aria-current={tab === x.id ? "page" : undefined} onClick={() => setTab(x.id)} className={`flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${tab === x.id ? "bg-white text-ink shadow-soft" : "text-ink-3 hover:text-ink"}`}>{x.label}</button>)}</nav>

      {tab === "arch" && <SectionView s={DEV} />}
      {tab === "extra" && <SectionView s={EXTRA} />}
      {tab === "release" && <SectionView s={RELEASE} />}
      {tab === "gen" && (
        <div className="space-y-5">
          <Card className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black">پارامترهای قابل‌ویرایش ({fa(cfg.length)})</h2>
              <Button variant="secondary" onClick={() => exportCsv("kamionet-config", ["کلید", "گروه", "برچسب", "نوع", "پیش‌فرض", "راهنما"], CONFIG_DEFS.map((c) => [c.key, c.group, c.label, c.kind, String(c.default), c.help ?? ""]))}><Download className="size-4" aria-hidden />CSV</Button></div>
            <Input aria-label="جستجوی پارامتر" placeholder="جستجوی کلید یا برچسب…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="overflow-x-auto rounded-ui border border-line"><table className="w-full min-w-[820px] text-sm"><thead><tr className="bg-surface-2 text-xs text-ink-3">{["کلید", "گروه", "برچسب", "نوع", "پیش‌فرض"].map((h) => <th key={h} className="p-3 text-start font-bold">{h}</th>)}</tr></thead><tbody>{cfg.map((c) => <tr key={c.key} className="border-t border-line align-top"><td dir="ltr" className="p-3 text-start font-mono text-xs">{c.key}</td><td className="p-3">{c.group}</td><td className="p-3 leading-7">{c.label}{c.help && <div className="text-xs text-ink-3">{c.help}</div>}</td><td className="p-3 font-mono text-xs">{c.kind}</td><td className="p-3 tabular">{String(c.default)}</td></tr>)}</tbody></table></div>
          </Card>
          <Card className="space-y-3 p-5"><h2 className="text-lg font-black">ماژول‌های کنسول مدیریت (مسیر و مجوز)</h2>
            <div className="overflow-x-auto rounded-ui border border-line"><table className="w-full min-w-[640px] text-sm"><thead><tr className="bg-surface-2 text-xs text-ink-3">{["مسیر", "عنوان", "گروه", "مجوز لازم"].map((h) => <th key={h} className="p-3 text-start font-bold">{h}</th>)}</tr></thead><tbody>{ADMIN_MODS.map((m) => <tr key={m.slug} className="border-t border-line"><td dir="ltr" className="p-3 text-start font-mono text-xs">/admin/{m.slug}</td><td className="p-3">{m.title}</td><td className="p-3">{m.group}</td><td dir="ltr" className="p-3 text-start font-mono text-xs">{[m.perm].flat().join(" | ")}</td></tr>)}</tbody></table></div></Card>
          <Card className="space-y-3 p-5"><h2 className="text-lg font-black">نقش‌ها، مجوزها و سقف تأیید</h2>
            <div className="overflow-x-auto rounded-ui border border-line"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-surface-2 text-xs text-ink-3">{["نقش", "تعداد مجوز", "سقف بازپرداخت", "سقف تعدیل", "سقف برداشت (ریال)"].map((h) => <th key={h} className="p-3 text-start font-bold">{h}</th>)}</tr></thead><tbody>{roles.map((r) => <tr key={r} className="border-t border-line"><td className="p-3 font-bold">{ROLE_LABELS[r]} <span dir="ltr" className="font-mono text-xs text-ink-3">{r}</span></td><td className="p-3 tabular">{fa(ROLE_PERMS[r].length)}</td><td className="p-3 tabular">{fa(CEILINGS[r].refund)}</td><td className="p-3 tabular">{fa(CEILINGS[r].adjust)}</td><td className="p-3 tabular">{fa(CEILINGS[r].payout)}</td></tr>)}</tbody></table></div>
            <details className="rounded-ui border border-line p-3"><summary className="cursor-pointer text-sm font-bold">ماتریس کامل مجوز × نقش</summary>
              <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[860px] text-xs"><thead><tr className="text-ink-3"><th className="p-2 text-start">مجوز</th>{roles.map((r) => <th key={r} className="p-2">{r}</th>)}</tr></thead><tbody>{Object.keys(PERM_LABELS).map((p) => <tr key={p} className="border-t border-line"><td className="p-2"><span dir="ltr" className="font-mono">{p}</span> · {PERM_LABELS[p]}</td>{roles.map((r) => <td key={r} className="p-2 text-center">{ROLE_PERMS[r].includes(p) ? "✔" : "—"}</td>)}</tr>)}</tbody></table></div></details></Card>
        </div>
      )}
    </main>
  );
}
