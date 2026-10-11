import type { MetadataRoute } from "next";

export const dynamic = "force-static";
const BASE = (process.env.NEXT_PUBLIC_SITE_URL || "https://behshad79.github.io") + (process.env.NEXT_PUBLIC_BASE_PATH || "/Kamionet_test");

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: ["/", "/blog/"], disallow: ["/app/", "/driver/", "/admin/", "/track/", "/waybill/", "/certificate/", "/handoff/"] }], sitemap: `${BASE}/sitemap.xml` };
}
