import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "@/lib/blog";

export const metadata: Metadata = { title: "بلاگ حمل بار یخچالی", description: "راهنماها و مقاله‌های حمل بار یخچال‌دار، زنجیره‌ی سرد، هزینه و اسناد حمل در ایران.", alternates: { canonical: "/blog/" } };

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 py-10">
      <nav aria-label="مسیر صفحه" className="text-sm text-ink-3"><Link href="/" className="font-bold text-accent-700">کامیونت</Link> / بلاگ</nav>
      <h1 className="text-3xl font-black">بلاگ کامیونت</h1>
      <p className="leading-8 text-ink-3">مقاله‌های کاربردی برای صاحبان بار و رانندگان یخچال‌دار.</p>
      <ul className="space-y-4">{POSTS.map((p) => <li key={p.slug}><Link href={`/blog/${p.slug}/`} className="block rounded-ui bg-white p-5 shadow-soft transition hover:shadow-lift"><span className="text-xs font-bold text-accent-700">{p.tag}</span><h2 className="mt-1 text-lg font-black">{p.title}</h2><p className="mt-1 text-sm leading-7 text-ink-3">{p.desc}</p></Link></li>)}</ul>
    </main>
  );
}
