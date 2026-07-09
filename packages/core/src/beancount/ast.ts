import type { Decimal } from "decimal.js";

/** ISO date string YYYY-MM-DD (beancount's only date format). */
export type IsoDate = string;

export interface Amount {
  number: Decimal;
  currency: string;
}

/** Cost spec between braces: {115.32 EUR} or {115.32 EUR, 2024-01-02} or {}. */
export interface CostSpec {
  number?: Decimal;
  currency?: string;
  date?: IsoDate;
  label?: string;
}

export interface PostingPrice {
  kind: "unit" | "total"; // @ vs @@
  amount: Amount;
}

/** Metadata values are kept as raw strings; quoted strings are unquoted. */
export type Meta = Record<string, string>;

export interface Posting {
  flag?: string;
  account: string;
  amount?: Amount;
  cost?: CostSpec;
  price?: PostingPrice;
  meta: Meta;
}

export interface TransactionDirective {
  kind: "transaction";
  date: IsoDate;
  flag: string; // "*", "!", "txn"→"*"
  payee?: string;
  narration: string;
  tags: string[];
  links: string[];
  meta: Meta;
  postings: Posting[];
  /** Original source text (with trailing newline). Present when parsed; cleared on edit. */
  src?: string;
}

export interface OpenDirective {
  kind: "open";
  date: IsoDate;
  account: string;
  currencies: string[];
  booking?: string;
  meta: Meta;
  src?: string;
}

export interface CloseDirective {
  kind: "close";
  date: IsoDate;
  account: string;
  meta: Meta;
  src?: string;
}

export interface CommodityDirective {
  kind: "commodity";
  date: IsoDate;
  currency: string;
  meta: Meta;
  src?: string;
}

export interface PriceDirective {
  kind: "price";
  date: IsoDate;
  currency: string;
  amount: Amount;
  meta: Meta;
  src?: string;
}

export interface BalanceDirective {
  kind: "balance";
  date: IsoDate;
  account: string;
  amount: Amount;
  meta: Meta;
  src?: string;
}

export interface OptionDirective {
  kind: "option";
  name: string;
  value: string;
  src?: string;
}

export interface IncludeDirective {
  kind: "include";
  path: string;
  src?: string;
}

/** Anything we don't model: comments, blank lines, unknown directives. Preserved verbatim. */
export interface RawBlock {
  kind: "raw";
  src: string;
}

export type Directive =
  | TransactionDirective
  | OpenDirective
  | CloseDirective
  | CommodityDirective
  | PriceDirective
  | BalanceDirective
  | OptionDirective
  | IncludeDirective
  | RawBlock;

export interface LedgerFile {
  directives: Directive[];
}

export type DatedDirective = Extract<Directive, { date: IsoDate }>;

export function isDated(d: Directive): d is DatedDirective {
  return "date" in d;
}
