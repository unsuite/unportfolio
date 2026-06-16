import { Decimal } from "decimal.js";

/**
 * Bond math. Convention: bond holdings are in lots of 100 face value
 * (units = faceValue / 100), so the quoted %-of-face price is the unit price.
 */

export interface BondTerms {
  /** ISO maturity date */
  maturity: string;
  /** annual coupon rate, e.g. 0.0333 for 3.33% */
  couponRate: number;
  /** coupons per year: 1, 2, 4, 12 */
  frequency: number;
  /** tax rate on gains/coupons, e.g. 0.125 or 0.26 */
  taxRate: number;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * Number of coupon payments remaining strictly after `asOf` up to and
 * including maturity (Excel COUPNUM(settlement, maturity, freq) semantics).
 * Coupon dates are generated backwards from maturity in steps of 12/freq months.
 */
export function remainingCoupons(asOf: string, maturity: string, frequency: number): number {
  const settle = new Date(asOf + "T00:00:00Z");
  const mat = new Date(maturity + "T00:00:00Z");
  if (settle >= mat) return 0;
  const step = -12 / frequency;
  let count = 0;
  let d = mat;
  while (d > settle) {
    count++;
    d = addMonths(mat, step * count);
  }
  return count;
}

export interface BondProjection {
  remainingCoupons: number;
  /** gross value of remaining coupons, in cash */
  remainingCouponValue: Decimal;
  /** redemption + buyCost + remaining coupons (buyCost is negative) */
  grossRemainingGain: Decimal;
  /** gross gain net of tax at the instrument rate */
  netRemainingGain: Decimal;
  /** net gain minus the (negative) buy cost → net cash value if held to maturity */
  netValueAtMaturity: Decimal;
}

/**
 * Project a bond position held to maturity.
 * @param units lots of 100 face value (face = units × 100)
 * @param buyCost total cash spent on purchase, NEGATIVE (sheet "prezzo di carico")
 */
export function projectToMaturity(
  asOf: string,
  units: Decimal,
  buyCost: Decimal,
  terms: BondTerms,
): BondProjection {
  const n = remainingCoupons(asOf, terms.maturity, terms.frequency);
  const face = units.mul(100);
  const couponValue = face.mul(terms.couponRate).div(terms.frequency).mul(n);
  const redemption = face; // bonds redeem at 100
  const gross = redemption.add(buyCost).add(couponValue);
  const net = gross.mul(new Decimal(1).minus(terms.taxRate));
  return {
    remainingCoupons: n,
    remainingCouponValue: couponValue,
    grossRemainingGain: gross,
    netRemainingGain: net,
    netValueAtMaturity: net.minus(buyCost),
  };
}
