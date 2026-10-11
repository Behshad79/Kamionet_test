import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POSTS, postBySlug } from "@/lib/blog";

export const dynamicParams = false;
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = postBySlug((await params).slug);
  return p ? { title: p.title, description: p.desc, alternates: { canonical: `/blog/${p.slug}/` }, openGraph: { title: p.title, description: p.desc, type: "article", locale: "fa_IR" } } : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const p = postBySlug((await params).slug);
  if (!p) notFound();
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.desc, datePublished: p.date, inLanguage: "fa", author: { "@type": "Organization", name: "کامیونت" }, publisher: { "@type": "Organization", name: "کامیونت" } };
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <nav aria-label="مسیر صفحه" className="text-sm text-ink-3"><Link href="/" className="font-bold text-accent-700">کامیونت</Link> / <Link href="/blog/" className="font-bold text-accent-700">بلاگ</Link> / {p.tag}</nav>
      <article className="space-y-4">
        <h1 className="text-3xl font-black leading-tight">{p.title}</h1>
        <p className="text-sm text-ink-3"><time dateTime={p.date}>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "long" }).format(new Date(p.date))}</time> · {p.tag}</p>
        {p.body.map((b, i) => <section key={i}>{b.h && <h2 className="mb-1 mt-4 text-xl font-extrabold">{b.h}</h2>}<p className="leading-9 text-ink-2">{b.p}</p></section>)}
      </article>
      <aside className="rounded-ui bg-act-soft p-5"><p className="font-black">بار یخچالی دارید؟</p><p className="mt-1 text-sm leading-7 text-ink-2">قیمت و راننده‌ی مناسب را همین حالا ببینید.</p><Link href="/app/login/" className="mt-3 inline-flex h-12 items-center rounded-ui bg-act px-5 font-black text-white">ثبت سفارش</Link></aside>
    </main>
  );
}
