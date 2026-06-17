import { Decimal } from "decimal.js";
import type { CommodityDirective, Directive, IsoDate } from "../beancount/ast";
import type { InstrumentPosition } from "../beancount/booking";
import { type BondProjection, projectToMaturity } from "../math/bond";
import { type TwrrResult, twrr } from "../math/twrr";
import { xirr } from "../math/xirr";
import { type PriceTable, priceAt } from "./prices";

/** Instrument metadata pulled from `commodity` directives. */
export interface CommodityInfo {
  commodity: string;
  name?: string;
  isin?: string;
  ticker?: string;
  assetClass: string; // BOND | ETF | STOCK | ...
  taxRate: number;
  maturity?: IsoDate;
  couponRate?: number;
  couponFrequency?: number;
  priceSource?: string;
}

export function readCommodityInfo(directives: Directive[]): Map<string, CommodityInfo> {
  const map = new Map<string, CommodityInfo>();
  for (const d of directives) {
    if (d.kind !== "commodity") continue;
    map.set(d.currency, commodityInfoFrom(d));
  }
  return map;
}

function commodityInfoFrom(d: CommodityDirective): CommodityInfo {
  const meta = d.meta;
  const info: CommodityInfo = {
    commodity: d.currency,
    assetClass: meta["class"] ?? "ETF",
    taxRate: meta["tax-rate"] !== undefined ? Number(meta["tax-rate"]) : 0.26,
  };
  if (meta["name"]) info.name = meta["name"];
  if (meta["isin"]) info.isin = meta["isin"];
  if (meta["ticker"]) info.ticker = meta["ticker"];
  if (meta["maturity"]) info.maturity = meta["maturity"];
  if (meta["coupon-rate"] !== undefined) info.couponRate = Number(meta["coupon-rate"]);
  if (meta["coupon-freq"] !== undefined) info.couponFrequency = Number(meta["coupon-freq"]);
  if (meta["price-source"]) info.priceSource = meta["price-source"];
  return info;
}

export interface AssetRow {
  commodity: string;
  /** segmento di deposito della posizione (`Assets:Broker:<deposito>:…`) */
  deposito: string;
  name: string;
  isin?: string;
  /** ticker di sola visualizzazione (metadato commodity); il commodity è l'ISIN */
  ticker?: string;
  assetClass: string;
  units: Decimal;
  /** unit price used for valuation (live quote or last sampled) */
  price?: Decimal;
  priceDate?: IsoDate;
  /** units × price */
  value?: Decimal;
  /** open-lot cost basis (positive) */
  costBasis: Decimal;
  /** all-time cash spent on buys (negative, sheet "prezzo di carico") */
  buyCost: Decimal;
  fees: Decimal;
  income: Decimal;
  withholding: Decimal;
  realizedGain: Decimal;
  /** value − costBasis */
  unrealizedGain?: Decimal;
  /** aliquota applicata al capital gain (12.5% titoli di stato, 26% default) */
  taxRate: number;
  /** tax due on unrealized gain if sold now (negative when gain > 0) */
  taxOnGain?: Decimal;
  /** value + taxOnGain */
  netValue?: Decimal;
  /** unrealized + realized + income + withholding + fees */
  totalNetGain?: Decimal;
  /** unrealizedGain / costBasis */
  yieldPct?: Decimal;
  /** totalNetGain / |buyCost| */
  yieldNetPct?: Decimal;
  /** annualized money-weighted return over the full cash-flow history (MWRR) */
  xirrAnnual?: number;
  /** date of the first cash flow — the start of the MWRR measurement */
  firstFlowDate?: IsoDate;
  /** date of the last cash flow — per le posizioni chiuse, la chiusura */
  lastFlowDate?: IsoDate;
  /** time-weighted return (price-only), boundaries at buys/sells */
  twrr?: TwrrResult;
  /** bond only */
  bond?: BondProjection & { sellNowVsMaturity: Decimal };
}

const ZERO = new Decimal(0);

export interface DeriveAssetsInput {
  positions: Map<string, InstrumentPosition>;
  commodities: Map<string, CommodityInfo>;
  prices: PriceTable;
  /** live quotes override sampled prices */
  liveQuotes?: Map<string, Decimal>;
  asOf: IsoDate;
}

export function deriveAssets(input: DeriveAssetsInput): AssetRow[] {
  const rows: AssetRow[] = [];
  for (const pos of input.positions.values()) {
    const commodity = pos.commodity;
    const info = input.commodities.get(commodity);
    const live = input.liveQuotes?.get(commodity);
    // valutazione as-of: ultimo prezzo campionato ≤ asOf (non l'ultimo in
    // assoluto), così value/gain seguono la data scelta. La quota live, se
    // presente, ha la precedenza (vista corrente).
    const sampled = priceAt(input.prices, commodity, input.asOf);
    const price = live ?? sampled?.price;

    const row: AssetRow = {
      commodity,
      deposito: pos.deposito,
      name: info?.name ?? commodity,
      assetClass: info?.assetClass ?? "ETF",
      taxRate: info?.taxRate ?? 0.26,
      units: pos.units,
      costBasis: pos.costBasis,
      buyCost: pos.buyCost,
      fees: pos.fees,
      income: pos.income,
      withholding: pos.withholding,
      realizedGain: pos.realizedGain,
    };
    if (info?.isin) row.isin = info.isin;
    if (info?.ticker) row.ticker = info.ticker;

    const closed = pos.units.isZero();
    // fine delle metriche di rendimento: oggi se la posizione è aperta,
    // l'ultimo evento-quota (la chiusura) se è chiusa.
    const lastEvent = pos.unitEvents[pos.unitEvents.length - 1];
    const endDate = closed && lastEvent ? lastEvent.date : input.asOf;

    if (price !== undefined) {
      row.price = price;
      if (live === undefined && sampled) row.priceDate = sampled.date;
      else row.priceDate = input.asOf;
      const value = pos.units.mul(price);
      row.value = value;
      const unrealized = value.minus(pos.costBasis);
      row.unrealizedGain = unrealized;
      const taxRate = info?.taxRate ?? 0.26;
      const tax = unrealized.gt(0) ? unrealized.mul(taxRate).neg() : ZERO;
      row.taxOnGain = tax;
      row.netValue = value.add(tax);
      row.totalNetGain = unrealized
        .add(pos.realizedGain)
        .add(pos.income)
        .add(pos.withholding)
        .add(pos.fees)
        .add(tax);
      if (pos.costBasis.gt(0)) row.yieldPct = unrealized.div(pos.costBasis);
      if (pos.buyCost.lt(0)) row.yieldNetPct = row.totalNetGain.div(pos.buyCost.abs());

      if (
        info?.assetClass === "BOND" &&
        info.maturity &&
        info.couponRate !== undefined &&
        pos.units.gt(0)
      ) {
        const proj = projectToMaturity(input.asOf, pos.units, pos.buyCost, {
          maturity: info.maturity,
          couponRate: info.couponRate,
          frequency: info.couponFrequency ?? 1,
          taxRate: info.taxRate,
        });
        row.bond = {
          ...proj,
          // negative → meglio tenere fino a maturazione
          sellNowVsMaturity: row.netValue.minus(proj.netValueAtMaturity),
        };
      }
    }

    // posizione chiusa senza prezzo corrente: il gain è tutto realizzato
    // (valore e costo residuo sono 0), quindi è comunque calcolabile.
    if (closed && price === undefined) {
      row.totalNetGain = pos.realizedGain.add(pos.income).add(pos.withholding).add(pos.fees);
      if (pos.buyCost.lt(0)) row.yieldNetPct = row.totalNetGain.div(pos.buyCost.abs());
    }

    // MWRR / XIRR: flussi realizzati + (solo se aperta e valorizzabile) la
    // liquidazione a oggi. Per le chiuse è il rendimento di ciclo vita
    // (nessun valore finale): non serve il prezzo corrente.
    if (pos.cashFlows.length > 0) {
      const flows = pos.cashFlows.map((f) => ({
        date: f.date,
        amount: f.amount.toNumber(),
      }));
      if (!closed && row.value !== undefined && !row.value.isZero())
        flows.push({ date: input.asOf, amount: row.value.toNumber() });
      const r = xirr(flows);
      if (r !== undefined) row.xirrAnnual = r;
      row.firstFlowDate = pos.cashFlows[0]!.date;
      row.lastFlowDate = pos.cashFlows[pos.cashFlows.length - 1]!.date;
    }

    // TWRR: aperte fino a oggi (quota live = prezzo a oggi); chiuse fino alla
    // data di chiusura (twrr interrompe la misura quando le quote → 0, e così
    // l'annualizzazione usa la finestra di detenzione reale).
    const t = twrr(
      pos.unitEvents,
      (date) =>
        date === input.asOf && live !== undefined
          ? live
          : priceAt(input.prices, commodity, date)?.price,
      endDate,
    );
    if (t !== undefined) row.twrr = t;

    rows.push(row);
  }
  rows.sort(
    (a, b) => a.commodity.localeCompare(b.commodity) || a.deposito.localeCompare(b.deposito),
  );
  return rows;
}
