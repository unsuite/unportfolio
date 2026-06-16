export interface CashFlow {
  /** ISO date YYYY-MM-DD */
  date: string;
  amount: number;
}

const MS_PER_YEAR = 365 * 24 * 3600 * 1000;

function npv(rate: number, flows: CashFlow[], t0: number): number {
  let sum = 0;
  for (const f of flows) {
    const years = (Date.parse(f.date) - t0) / MS_PER_YEAR;
    sum += f.amount / (1 + rate) ** years;
  }
  return sum;
}

/**
 * Internal rate of return for irregular cash flows (Excel XIRR semantics,
 * ACT/365). Newton's method with bisection fallback. Returns undefined when
 * no sign change exists or no root is found in (-0.9999, 10).
 */
export function xirr(flows: CashFlow[]): number | undefined {
  if (flows.length < 2) return undefined;
  const hasPos = flows.some((f) => f.amount > 0);
  const hasNeg = flows.some((f) => f.amount < 0);
  if (!hasPos || !hasNeg) return undefined;
  const t0 = Math.min(...flows.map((f) => Date.parse(f.date)));

  // Newton
  let rate = 0.1;
  for (let iter = 0; iter < 50; iter++) {
    const f = npv(rate, flows, t0);
    const h = 1e-6;
    const df = (npv(rate + h, flows, t0) - f) / h;
    if (df === 0) break;
    const next = rate - f / df;
    if (!isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < 1e-9) return next;
    rate = next;
  }

  // Bisection fallback over (-0.9999, 10)
  let lo = -0.9999;
  let hi = 10;
  let flo = npv(lo, flows, t0);
  const fhi = npv(hi, flows, t0);
  if (flo * fhi > 0) return undefined;
  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid, flows, t0);
    if (Math.abs(fmid) < 1e-10 || hi - lo < 1e-10) return mid;
    if (flo * fmid < 0) {
      hi = mid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}
