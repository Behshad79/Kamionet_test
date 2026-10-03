"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_MODS, modAllowed, modHref } from "./adminNav";
import { useAdmin } from "./kit";
import { OrderDrawer } from "./modules/Orders";
import { Driver360 } from "./modules/People";
import { STATUS } from "@/lib/format";
import { useStore } from "@/lib/store";

export const openPalette = () => window.dispatchEvent(new Event("km:cmdk"));

/** Ctrl/⌘+K: jump to any module, order (by id/city), driver or shipper. */
export function CommandPalette() {
  const s = useStore();
  const { has } = useAdmin();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hit, setHit] = useState(0);
  const [order, setOrder] = useState<string | null>(null);
  const [driver, setDriver] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); } if (e.key === "Escape") setOpen(false); };
    const o = () => setOpen(true);
    window.addEventListener("keydown", k); window.addEventListener("km:cmdk", o);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("km:cmdk", o); };
  }, []);
  useEffect(() => { if (open) { setQ(""); setHit(0); setTimeout(() => input.current?.focus(), 30); } }, [open]);
  const items = useMemo(() => {
    const t = q.trim();
    const mods = ADMIN_MODS.filter((m) => modAllowed(m, has) && (!t || `${m.title} ${m.keywords ?? ""}`.includes(t))).map((m) => ({ key: `m:${m.slug}`, label: m.title, sub: m.group, run: () => router.push(modHref(m.slug)) }));
    if (!t) return mods;
    const out = [...mods];
    if (has("orders.view")) for (const o of s.orders.filter((x) => `${x.id} ${x.origin.city} ${x.dest.city}`.includes(t)).slice(0, 6)) out.push({ key: `o:${o.id}`, label: `${o.origin.city} ← ${o.dest.city}`, sub: `سفارش ${o.id} · ${STATUS[o.status].label}`, run: () => setOrder(o.id) });
    if (has("drivers.view")) for (const d of s.drivers) { const p = s.persons.find((x) => x.id === d.personId); if (p && `${p.name} ${p.phone}`.includes(t)) { out.push({ key: `d:${d.personId}`, label: p.name, sub: `راننده · ${p.phone}`, run: () => setDriver(d.personId) }); if (out.length > 16) break; } }
    if (has("shippers.view")) for (const d of s.shippers) { const p = s.persons.find((x) => x.id === d.personId); if (p && `${p.name} ${p.phone} ${d.displayName}`.includes(t)) { out.push({ key: `s:${d.personId}`, label: d.displayName || p.name, sub: `صاحب بار · ${p.phone}`, run: () => router.push(modHref("shippers")) }); if (out.length > 20) break; } }
    return out.slice(0, 20);
  }, [q, s, has, router]);
  const pick = (i: number) => { items[i]?.run(); setOpen(false); };
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/40 p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="جستجوی سریع" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-lift">
            <div className="flex items-center gap-3 border-b border-line px-4"><Search className="size-5 text-ink-3" aria-hidden /><input ref={input} role="combobox" aria-expanded aria-controls="cmdk-list" aria-label="جستجو" value={q} onChange={(e) => { setQ(e.target.value); setHit(0); }} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setHit((h) => Math.min(items.length - 1, h + 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setHit((h) => Math.max(0, h - 1)); } else if (e.key === "Enter") pick(hit); }} placeholder="بخش، سفارش، راننده یا صاحب بار…" className="h-14 flex-1 bg-transparent text-base outline-none" /><kbd className="hidden rounded-lg bg-surface-3 px-2 py-1 text-[11px] text-ink-3 sm:block">Esc</kbd></div>
            <ul id="cmdk-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">{items.length === 0 && <li className="p-6 text-center text-sm text-ink-3">نتیجه‌ای پیدا نشد.</li>}{items.map((it, i) => <li key={it.key} role="option" aria-selected={i === hit}><button onMouseEnter={() => setHit(i)} onClick={() => pick(i)} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 text-start ${i === hit ? "bg-act-soft" : ""}`}><span className="font-bold">{it.label}</span><span className="text-xs text-ink-3">{it.sub}</span></button></li>)}</ul>
          </div>
        </div>
      )}
      <OrderDrawer id={order} onClose={() => setOrder(null)} />
      <Driver360 id={driver} onClose={() => setDriver(null)} />
    </>
  );
}
