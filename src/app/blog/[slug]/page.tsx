import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogCover } from "@/components/BlogCover";
import { POSTS, postBySlug, readMin } from "@/lib/blog";

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
    <main className="mx-auto max-w-5xl space-y-8 p-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <nav aria-label="مسیر صفحه" className="text-sm text-ink-3"><Link href="/" className="font-bold text-accent-700">کامیونت</Link> / <Link href="/blog/" className="font-bold text-accent-700">بلاگ</Link> / {p.tag}</nav>
      <BlogCover tag={p.tag} className="h-48 md:h-64" />
      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <article className="max-w-3xl space-y-4">
          <h1 className="text-3xl font-black leading-tight md:text-4xl">{p.title}</h1>
          <p className="text-sm text-ink-3"><time dateTime={p.date}>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "long" }).format(new Date(p.date))}</time> · {new Intl.NumberFormat("fa-IR").format(readMin(p))} دقیقه مطالعه · {p.tag}</p>
          <p className="rounded-ui bg-surface-2 p-4 text-lg leading-9 text-ink-2">{p.desc}</p>
          {p.body.map((b, i) => <section key={i} id={`s${i}`}>{b.h && <h2 className="mb-2 mt-6 text-2xl font-extrabold">{b.h}</h2>}<p className="text-[17px] leading-10 text-ink-2">{b.p}</p></section>)}
        </article>
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <nav aria-label="فهرست مطالب" className="rounded-ui bg-white p-4 shadow-soft"><p className="mb-2 font-extrabold">در این مقاله</p><ul className="space-y-1 text-sm">{p.body.filter((b) => b.h).map((b) => <li key={b.h}><a className="block min-h-9 py-1 text-ink-3 hover:text-ink" href={`#s${p.body.indexOf(b)}`}>{b.h}</a></li>)}</ul></nav>
          <div className="rounded-ui bg-white p-4 shadow-soft"><p className="mb-2 font-extrabold">مقاله‌های بیشتر</p><ul className="space-y-2 text-sm">{POSTS.filter((x) => x.slug !== p.slug).slice(0, 3).map((x) => <li key={x.slug}><Link className="block font-bold text-accent-700 hover:underline" href={`/blog/${x.slug}/`}>{x.title}</Link></li>)}</ul></div>
        </aside>
      </div>
      <aside className="rounded-ui bg-act-soft p-5"><p className="font-black">بار یخچالی دارید؟</p><p className="mt-1 text-sm leading-7 text-ink-2">قیمت و راننده‌ی مناسب را همین حالا ببینید.</p><Link href="/app/login/" className="mt-3 inline-flex h-12 items-center rounded-ui bg-act px-5 font-black text-white">ثبت سفارش</Link></aside>
    </main>
  );
}
