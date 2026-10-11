import type { Order } from "./types";

/** A tiny SVG stand-in for a scanned, stamped official slip (demo only). */
export function officialPlaceholder(o: Order, no: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600" direction="rtl"><rect width="900" height="600" fill="#fff" stroke="#111" stroke-width="3"/><text x="450" y="60" font-size="30" font-family="sans-serif" text-anchor="middle" font-weight="700">نسخه‌ی مخصوص پرداخت کرایه حمل (نمونه)</text><text x="860" y="130" font-size="22" font-family="sans-serif" text-anchor="end">شماره حواله: ${no}</text><text x="860" y="180" font-size="22" font-family="sans-serif" text-anchor="end">مسیر: ${o.origin.city} ← ${o.dest.city}</text><text x="860" y="230" font-size="22" font-family="sans-serif" text-anchor="end">سفارش: ${o.id}</text><text x="860" y="280" font-size="22" font-family="sans-serif" text-anchor="end">کرایه: ${Math.round(o.freight / 10).toLocaleString("en")} تومان</text><circle cx="200" cy="450" r="80" fill="none" stroke="#146EB4" stroke-width="5"/><text x="200" y="455" font-size="22" font-family="sans-serif" text-anchor="middle" fill="#146EB4" font-weight="700">مهر کامیونت</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
