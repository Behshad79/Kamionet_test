/** Deterministic PRNG (mulberry32) so seeded demo data is identical on every machine. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const chance = (p: number) => next() < p;
  const weighted = <T,>(xs: readonly T[], w: (x: T) => number): T => {
    const total = xs.reduce((n, x) => n + w(x), 0);
    let r = next() * total;
    for (const x of xs) { r -= w(x); if (r <= 0) return x; }
    return xs[xs.length - 1];
  };
  const shuffle = <T,>(xs: readonly T[]): T[] => {
    const a2 = [...xs];
    for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; }
    return a2;
  };
  return { next, int, pick, chance, weighted, shuffle };
}
export type Rng = ReturnType<typeof rng>;
