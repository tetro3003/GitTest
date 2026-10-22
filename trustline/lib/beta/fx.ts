/**
 * Approximate conversion to USD so income from different currencies can be added up.
 * Override any rate with FX_<CODE>_USD, e.g. FX_GEL_USD=0.37.
 */
const DEFAULT_USD_RATES: Record<string, number> = { USD: 1, USDT: 1, USDC: 1, EUR: 1.1, GBP: 1.3, GEL: 0.37, CHF: 1.15, CAD: 0.73, AUD: 0.66, PLN: 0.26, TRY: 0.025, UAH: 0.024 };

export function usdRate(currency: string): number | null {
  const code = currency.toUpperCase();
  const env = typeof process !== "undefined" ? process.env[`FX_${code}_USD`] : undefined;
  if (env && Number(env) > 0) return Number(env);
  return DEFAULT_USD_RATES[code] ?? null;
}

export function toUsd(amount: number, currency: string): number | null {
  const r = usdRate(currency);
  return r == null ? null : Math.round(amount * r * 100) / 100;
}
