"use client";

import Link from "next/link";
import { useState } from "react";
import { BlogCover } from "@/components/BlogCover";
import { POSTS, readMin, TAGS } from "@/lib/blog";
import { fa } from "@/lib/format";

const fmt = (d: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(new Date(d));

export function BlogIndex() {
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const rows = POSTS.filter((p) => (!tag || p.tag === tag) && (!q || `${p.title} ${p.desc}`.includes(q)));
  const [hero, ...rest] = rows;
  return (
    <div className="space-y-8">
      <header className="space-y-3 rounded-[28px] bg-brand-50 p-6 md:p-10"><p className="text-sm font-extrabold text-brand-700">بلاگ کامیونت</p><h1 className="max-w-2xl text-3xl font-black leading-tight md:text-4xl">هر آنچه درباره‌ی حمل بار یخچالی باید بدانید</h1><p className="max-w-2xl leading-8 text-ink-2">راهنمای قیمت، زنجیره‌ی سرد، اسناد حمل و درآمد رانندگان؛ ساده و کاربردی.</p>
        <div className="flex flex-wrap items-center gap-2 pt-2"><input aria-label="جستجو در مقاله‌ها" placeholder="جستجو در مقاله‌ها…" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 min-w-56 flex-1 rounded-ui border border-line bg-white px-4 text-[15px] focus:border-accent-600 focus:outline-none focus:ring-4 focus:ring-accent-600/15" /></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="دسته‌بندی">{["", ...TAGS].map((t) => <button key={t} aria-pressed={tag === t} onClick={() => setTag(t)} className={`min-h-11 rounded-full px-4 text-sm font-bold ${tag === t ? "bg-ink text-white" : "bg-white text-ink-2 shadow-soft"}`}>{t || "همه"}</button>)}</div></header>
      {rows.length === 0 && <p className="py-10 text-center text-ink-3">مقاله‌ای پیدا نشد.</p>}
      {hero && <Link href={`/blog/${hero.slug}/`} className="grid gap-5 rounded-[28px] bg-white p-4 shadow-soft transition hover:shadow-lift md:grid-cols-2 md:p-6"><BlogCover tag={hero.tag} className="h-56 md:h-full" /><div className="flex flex-col justify-center gap-3"><span className="text-xs font-extrabold text-accent-700">مقاله‌ی ویژه</span><h2 className="text-2xl font-black leading-snug">{hero.title}</h2><p className="leading-8 text-ink-2">{hero.desc}</p><p className="text-xs text-ink-3">{fmt(hero.date)} · {fa(readMin(hero))} دقیقه مطالعه</p></div></Link>}
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{rest.map((p) => <li key={p.slug}><Link href={`/blog/${p.slug}/`} className="flex h-full flex-col gap-3 rounded-[24px] bg-white p-4 shadow-soft transition hover:shadow-lift"><BlogCover tag={p.tag} /><h2 className="text-lg font-black leading-snug">{p.title}</h2><p className="line-clamp-3 text-sm leading-7 text-ink-3">{p.desc}</p><p className="mt-auto text-xs text-ink-3">{fmt(p.date)} · {fa(readMin(p))} دقیقه</p></Link></li>)}</ul>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-ink p-6 text-white md:p-8"><div><h2 className="text-xl font-black">بار یخچالی دارید؟</h2><p className="mt-1 text-sm text-white/70">قیمت و راننده‌ی مناسب را همین حالا ببینید.</p></div><Link href="/app/login/" className="inline-flex h-12 items-center rounded-ui bg-brand-500 px-6 font-black text-ink">ثبت سفارش</Link></section>
    </div>
  );
}
