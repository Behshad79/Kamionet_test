/** Flat, brand-coloured cover per category (no photos needed, no gradients). */
const THEME: Record<string, { bg: string; fg: string; icon: string }> = {
  "قیمت": { bg: "#FFF1C2", fg: "#7A5200", icon: "M4 18V8l8-4 8 4v10M9 18v-6h6v6" },
  "زنجیره‌ی سرد": { bg: "#DDF1FA", fg: "#0F5590", icon: "M12 3v18M5 7l14 10M19 7L5 17" },
  "راهنما": { bg: "#E6F5E9", fg: "#12703A", icon: "M4 6h16M4 12h16M4 18h10" },
  "رانندگان": { bg: "#FFE8D6", fg: "#B13A0B", icon: "M3 15h13v-6H3zM16 11h3l2 2v2h-5M7 18a1.6 1.6 0 100-.01M17 18a1.6 1.6 0 100-.01" },
  "اسناد": { bg: "#ECE9FB", fg: "#4A3AA7", icon: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
  "کسب‌وکار": { bg: "#FDE3EC", fg: "#A12358", icon: "M4 20V10l8-6 8 6v10M10 20v-6h4v6" },
};
export function BlogCover({ tag, className = "h-36" }: { tag: string; className?: string }) {
  const t = THEME[tag] ?? THEME["راهنما"];
  return (
    <div className={`relative grid place-items-center overflow-hidden rounded-ui ${className}`} style={{ background: t.bg }} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-16" fill="none" stroke={t.fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
      <span className="absolute bottom-3 start-3 rounded-full bg-white/80 px-3 py-1 text-xs font-extrabold" style={{ color: t.fg }}>{tag}</span>
    </div>
  );
}
