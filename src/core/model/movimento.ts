import type { Decimal } from "decimal.js";
import type { IsoDate } from "../beancount/ast";

/** A broker movement in the shape of the spreadsheet "Movimenti" table. */
export interface RawMovimento {
  broker: string;
  dataOperazione: IsoDate;
  dataValuta: IsoDate;
  tipo: string;
  ticker?: string;
  isin?: string;
  protocollo?: string;
  descrizione?: string;
  quantita: Decimal;
  importoEuro: Decimal;
  divisa: string;
  riferimentoOrdine?: string;
}

export type AssetClass = "BOND" | "ETF" | "STOCK";

/** Instrument registry entry (spreadsheet "Assets" table). */
export interface InstrumentInfo {
  ticker: string;
  isin: string;
  name?: string;
  assetClass: AssetClass;
  /** 0.125 govt bonds, 0.26 default */
  taxRate: number;
  currency: string;
  /** bond only */
  maturity?: IsoDate;
  /** bond only: ANNUAL coupon rate */
  couponRate?: number;
  /** bond only: coupons per year */
  couponFrequency?: number;
  /** e.g. "borsa-italiana:XS1503043694.MOT" or "yahoo:VWCE.MI" */
  priceSource?: string;
}
