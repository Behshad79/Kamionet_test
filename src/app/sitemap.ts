import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/blog";

export const dynamic = "force-static";
const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "https://behshad79.github.io") + (process.env.NEXT_PUBLIC_BASE_PATH || "/Kamionet_test");

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${BASE}/`, priority: 1 }, { url: `${BASE}/blog/`, priority: 0.8 }, ...POSTS.map((p) => ({ url: `${BASE}/blog/${p.slug}/`, lastModified: p.date, priority: 0.6 }))];
}
