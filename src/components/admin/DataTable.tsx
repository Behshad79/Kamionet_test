"use client";

import { ArrowDownUp, Bookmark, ChevronLeft, ChevronRight, Columns3, Download, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fa } from "@/lib/format";
import { exportCsv, exportXls, type Cell } from "@/lib/export";
import { Button, EmptyState, cx } from "../ui";

export interface Col<T> {
  id: string;
  label: string;
  cell: (r: T) => ReactNode;
  /** Plain value for sorting and export. */
  value?: (r: T) => Cell;
  className?: string;
  /** Hidden by default (shown through the column chooser). */
  hidden?: boolean;
  num?: boolean;
}
export interface Filter<T> { id: string; label: string; options: { id: string; label: string }[]; test: (r: T, v: string) => boolean }
export interface Bulk { label: string; run: (ids: string[]) => void; danger?: boolean }
interface View { name: string; q: string; filters: Record<string, string>; sort: string; dir: 1 | -1; cols: string[] }

/**
 * Dense admin table: search, filters, sort, column chooser, bulk actions, saved views (per browser), CSV/Excel export and paging.
 * Wide tables scroll horizontally inside their card, so the same component works on a phone.
 */
export function DataTable<T>({ id, rows, cols, rowKey, search, filters = [], bulk = [], onRow, empty, pageSize = 25, toolbar }: {
  id: string; rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; search?: (r: T) => string; filters?: Filter<T>[]; bulk?: Bulk[];
  onRow?: (r: T) => void; empty?: ReactNode; pageSize?: number; toolbar?: ReactNode;
}) {
  const storeKey = `kamionet:views:${id}`;
  const [q, setQ] = useState("");
  const [fv, setFv] = useState<Record<string, string>>({});
  const [sort, setSort] = useState("");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [visible, setVisible] = useState<string[]>(() => cols.filter((c) => !c.hidden).map((c) => c.id));
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [chooser, setChooser] = useState(false);
  const [views, setViews] = useState<View[]>([]);
  useEffect(() => { try { setViews(JSON.parse(localStorage.getItem(storeKey) ?? "[]")); } catch { /* ignore */ } }, [storeKey]);
  const persistViews = (v: View[]) => { setViews(v); try { localStorage.setItem(storeKey, JSON.stringify(v)); } catch { /* ignore */ } };

  const shown = cols.filter((c) => visible.includes(c.id));
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => (!needle || (search?.(r) ?? "").toLowerCase().includes(needle)) && filters.every((f) => !fv[f.id] || f.test(r, fv[f.id])));
    const sc = cols.find((c) => c.id === sort);
    if (sc?.value) out = [...out].sort((a, b) => { const x = sc.value!(a) ?? ""; const y = sc.value!(b) ?? ""; return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fa")) * dir; });
    return out;
  }, [rows, q, fv, sort, dir, cols, filters, search]);
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const pageRows = list.slice(cur * pageSize, cur * pageSize + pageSize);
  const allOn = pageRows.length > 0 && pageRows.every((r) => sel.has(rowKey(r)));
  const flt = Object.values(fv).filter(Boolean).length + (q ? 1 : 0);

  const doExport = (kind: "csv" | "xls") => {
    const ex = shown.filter((c) => c.value);
    const data = list.map((r) => ex.map((c) => c.value!(r)));
    (kind === "csv" ? exportCsv : exportXls)(`${id}-${new Date().toISOString().slice(0, 10)}`, ex.map((c) => c.label), data);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {search && <div className="relative min-w-52 flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden /><input aria-label="جستجو در جدول" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="جستجو…" className="h-10 w-full rounded-xl border border-line/80 bg-white ps-9 pe-3 text-sm focus:border-accent-600 focus:outline-none focus:ring-4 focus:ring-accent-100" /></div>}
        {filters.map((f) => (
          <select key={f.id} aria-label={f.label} value={fv[f.id] ?? ""} onChange={(e) => { setFv({ ...fv, [f.id]: e.target.value }); setPage(0); }} className={cx("h-10 rounded-xl border bg-white px-3 text-sm", fv[f.id] ? "border-accent-600 bg-accent-50 font-bold" : "border-line/80")}>
            <option value="">{f.label}: همه</option>{f.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        ))}
        {flt > 0 && <button onClick={() => { setQ(""); setFv({}); }} className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-accent-600"><X className="size-4" aria-hidden />پاک‌کردن فیلتر</button>}
        <div className="ms-auto flex items-center gap-1.5">
          {toolbar}
          <div className="relative">
            <Button size="sm" variant="secondary" className="h-10!" onClick={() => setChooser(!chooser)} aria-expanded={chooser}><Columns3 className="size-4" aria-hidden />ستون‌ها</Button>
            {chooser && <div className="absolute end-0 top-11 z-30 w-52 space-y-1 rounded-2xl bg-white p-2 shadow-lift ring-1 ring-ink/5">{cols.map((c) => <label key={c.id} className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm hover:bg-surface-2"><input type="checkbox" checked={visible.includes(c.id)} onChange={() => setVisible(visible.includes(c.id) ? visible.filter((x) => x !== c.id) : [...visible, c.id])} />{c.label}</label>)}</div>}
          </div>
          <details className="relative"><summary className="inline-flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold shadow-soft [&::-webkit-details-marker]:hidden"><Bookmark className="size-4" aria-hidden />نمایه‌ها{views.length ? ` (${fa(views.length)})` : ""}</summary>
            <div className="absolute end-0 top-11 z-30 w-60 space-y-1 rounded-2xl bg-white p-2 shadow-lift ring-1 ring-ink/5">
              {views.map((v, i) => <div key={i} className="flex items-center justify-between gap-1"><button className="min-h-9 flex-1 rounded-lg px-2 text-start text-sm hover:bg-surface-2" onClick={() => { setQ(v.q); setFv(v.filters); setSort(v.sort); setDir(v.dir); setVisible(v.cols); }}>{v.name}</button><button aria-label="حذف نمایه" className="grid size-8 place-items-center rounded-full hover:bg-surface-3" onClick={() => persistViews(views.filter((_, j) => j !== i))}><X className="size-3.5" /></button></div>)}
              <button className="h-9 w-full rounded-lg bg-surface-2 text-sm font-bold" onClick={() => { const name = window.prompt("نام نمایه:"); if (name) persistViews([...views, { name, q, filters: fv, sort, dir, cols: visible }]); }}>ذخیره‌ی وضعیت فعلی</button>
            </div></details>
          <details className="relative"><summary className="inline-flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold shadow-soft [&::-webkit-details-marker]:hidden"><Download className="size-4" aria-hidden />خروجی</summary>
            <div className="absolute end-0 top-11 z-30 w-44 space-y-1 rounded-2xl bg-white p-2 shadow-lift ring-1 ring-ink/5"><button className="h-9 w-full rounded-lg px-2 text-start text-sm hover:bg-surface-2" onClick={() => doExport("csv")}>CSV</button><button className="h-9 w-full rounded-lg px-2 text-start text-sm hover:bg-surface-2" onClick={() => doExport("xls")}>Excel (.xls)</button></div></details>
        </div>
      </div>

      {sel.size > 0 && bulk.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-ink px-4 py-2 text-sm text-white" role="region" aria-label="اقدام گروهی"><span className="font-bold">{fa(sel.size)} مورد انتخاب شده</span>{bulk.map((b) => <button key={b.label} onClick={() => { b.run([...sel]); setSel(new Set()); }} className={cx("h-9 rounded-full px-4 font-bold", b.danger ? "bg-danger text-white" : "bg-white/15 hover:bg-white/25")}>{b.label}</button>)}<button className="ms-auto text-white/70" onClick={() => setSel(new Set())}>لغو انتخاب</button></div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="sticky top-0 bg-surface-2 text-ink-3">
              <tr>
                {bulk.length > 0 && <th className="w-10 p-3"><input type="checkbox" aria-label="انتخاب همه‌ی ردیف‌های این صفحه" checked={allOn} onChange={() => setSel((p) => { const n = new Set(p); pageRows.forEach((r) => (allOn ? n.delete(rowKey(r)) : n.add(rowKey(r)))); return n; })} /></th>}
                {shown.map((c) => (
                  <th key={c.id} scope="col" className={cx("whitespace-nowrap p-3 text-start text-xs font-bold", c.className)} aria-sort={sort === c.id ? (dir === 1 ? "ascending" : "descending") : undefined}>
                    {c.value ? <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => { if (sort === c.id) setDir(dir === 1 ? -1 : 1); else { setSort(c.id); setDir(-1); } }}>{c.label}<ArrowDownUp className={cx("size-3", sort === c.id ? "text-accent-600" : "opacity-40")} aria-hidden /></button> : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => {
                const k = rowKey(r);
                return (
                  <tr key={k} tabIndex={onRow ? 0 : undefined} onClick={() => onRow?.(r)} onKeyDown={(e) => { if (onRow && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onRow(r); } }} className={cx("border-t border-line/70 transition", onRow && "cursor-pointer hover:bg-act-soft/60 focus-visible:bg-act-soft", sel.has(k) && "bg-act-soft/50")}>
                    {bulk.length > 0 && <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="انتخاب ردیف" checked={sel.has(k)} onChange={() => setSel((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; })} /></td>}
                    {shown.map((c) => <td key={c.id} className={cx("p-3", c.num && "tabular", c.className)}>{c.cell(r)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <div className="p-4">{empty ?? <EmptyState icon={<Search className="size-8" />} title="نتیجه‌ای پیدا نشد" body="فیلترها یا عبارت جستجو را تغییر دهید." action={flt ? <Button onClick={() => { setQ(""); setFv({}); }}>پاک‌کردن فیلتر</Button> : undefined} />}</div>}
        <div className="flex items-center justify-between gap-3 border-t border-line/70 px-3 py-2 text-xs text-ink-3"><span>{fa(list.length)} ردیف{list.length !== rows.length ? ` از ${fa(rows.length)}` : ""}</span>
          <div className="flex items-center gap-1"><button aria-label="صفحه‌ی قبل" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="grid size-8 place-items-center rounded-full hover:bg-surface-3 disabled:opacity-30"><ChevronRight className="size-4" /></button><span className="tabular">{fa(cur + 1)} / {fa(pages)}</span><button aria-label="صفحه‌ی بعد" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="grid size-8 place-items-center rounded-full hover:bg-surface-3 disabled:opacity-30"><ChevronLeft className="size-4" /></button></div></div>
      </div>
    </div>
  );
}
