/** Small numeric helpers used by the scoring engine. */

export const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: readonly number[]) => (xs.length ? sum(xs) / xs.length : 0);
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round = (x: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

export function median(xs: readonly number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Weighted median: the value where cumulative weight first reaches half. */
export function weightedMedian(values: readonly number[], weights: readonly number[]): number {
  if (!values.length) return 0;
  const pairs = values.map((v, i) => ({ v, w: weights[i] ?? 1 })).sort((a, b) => a.v - b.v);
  const half = sum(pairs.map((p) => p.w)) / 2;
  let acc = 0;
  for (let i = 0; i < pairs.length; i++) {
    acc += pairs[i].w;
    if (acc > half + 1e-9) return pairs[i].v;
    if (Math.abs(acc - half) < 1e-9) return i + 1 < pairs.length ? (pairs[i].v + pairs[i + 1].v) / 2 : pairs[i].v;
  }
  return pairs[pairs.length - 1].v;
}

export function stdDev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

/** Weighted least squares slope of y over x = 0..n-1, plus intercept. */
export function linearFit(ys: readonly number[], weights?: readonly number[]): { slope: number; intercept: number } {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const w = weights ?? ys.map(() => 1);
  const sw = sum(w);
  const mx = sum(ys.map((_, i) => w[i] * i)) / sw;
  const my = sum(ys.map((y, i) => w[i] * y)) / sw;
  let num = 0;
  let den = 0;
  ys.forEach((y, i) => {
    num += w[i] * (i - mx) * (y - my);
    den += w[i] * (i - mx) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

/** Linear interpolation of points between two anchors, clamped. */
export function scale(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y1;
  const t = clamp((x - x0) / (x1 - x0), 0, 1);
  return y0 + t * (y1 - y0);
}
