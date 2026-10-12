import type { Metadata } from "next";
import Link from "next/link";
import { BlogIndex } from "./BlogIndex";

export const metadata: Metadata = { title: "بلاگ حمل بار یخچالی", description: "راهنماها و مقاله‌های حمل بار یخچال‌دار، زنجیره‌ی سرد، هزینه و اسناد حمل در ایران.", alternates: { canonical: "/blog/" } };

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 py-8">
      <nav aria-label="مسیر صفحه" className="text-sm text-ink-3"><Link href="/" className="font-bold text-accent-700">کامیونت</Link> / بلاگ</nav>
      <BlogIndex />
    </main>
  );
}
