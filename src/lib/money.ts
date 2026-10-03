/**
 * The one place money is converted and formatted.
 * Storage: integer Rial. Display: Toman (Rial / 10), Persian digits.
 */
const nf = new Intl.NumberFormat("fa-IR");
const nf1 = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

export const fa = (n: number) => nf.format(Math.round(n));
export const fa1 = (n: number) => nf1.format(n);

/** Toman typed by a user → Rial stored. */
export const R = (toman: number) => Math.round(toman * 10);
/** Rial stored → Toman number. */
export const T = (rial: number) => rial / 10;

export const fmtToman = (rial: number) => `${nf.format(Math.round(rial / 10))} تومان`;

/** "۱۴ میلیون تومان" / "۵ میلیارد تومان": explicit words, never a bare "م". */
export function fmtTomanWords(rial: number) {
  const t = rial / 10;
  if (Math.abs(t) >= 1e9) return `${nf1.format(t / 1e9)} میلیارد تومان`;
  if (Math.abs(t) >= 1e6) return `${nf1.format(t / 1e6)} میلیون تومان`;
  return `${nf.format(Math.round(t))} تومان`;
}

/** Screen-reader friendly spoken amount. */
export const spokenToman = (rial: number) => fmtTomanWords(rial);

const AR = "٠١٢٣٤٥٦٧٨٩";
const FA = "۰۱۲۳۴۵۶۷۸۹";
/** Accept Persian/Arabic digits and separators, return plain ASCII. */
export function normalizeDigits(s: string) {
  return s
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
    .replace(/[٬،,]/g, "")
    .replace(/٫/g, ".");
}

/** Digits only → number | undefined. */
export function parseNum(s: string): number | undefined {
  const v = normalizeDigits(s).replace(/[^\d.]/g, "");
  return v === "" ? undefined : Number(v);
}
