import type { TransactionDirective } from "@unportfolio/core/beancount/ast";
import { type BookingResult, book } from "@unportfolio/core/beancount/booking";
import {
  type AssetRow,
  type CommodityInfo,
  deriveAssets,
  readCommodityInfo,
} from "@unportfolio/core/derive/assets";
import { derivePatrimonio, type PatrimonioStatement } from "@unportfolio/core/derive/patrimonio";
import { buildPriceTable, type PriceTable } from "@unportfolio/core/derive/prices";
import { useMemo, useSyncExternalStore } from "react";
import { type AppState, allDirectives, getState, subscribe } from "./store";

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, getState);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface Derived {
  booked: BookingResult;
  prices: PriceTable;
  commodities: Map<string, CommodityInfo>;
  assets: AssetRow[];
  patrimonio: PatrimonioStatement;
  transactions: TransactionDirective[];
  asOf: string;
}

export function useDerived(): Derived {
  const s = useApp();
  return useMemo(() => {
    const directives = allDirectives(s);
    const booked = book(directives);
    const prices = buildPriceTable(directives);
    const commodities = readCommodityInfo(directives);
    const asOf = todayIso();
    const assets = deriveAssets({
      positions: booked.positions,
      commodities,
      prices,
      liveQuotes: s.quotes,
      asOf,
    });
    const patrimonio = derivePatrimonio({
      accounts: s.accounts,
      snapshots: s.snapshots,
      directives,
      prices,
      liveQuotes: s.quotes,
      asOf,
    });
    const transactions = directives.filter(
      (d): d is TransactionDirective => d.kind === "transaction",
    );
    return {
      booked,
      prices,
      commodities,
      assets,
      patrimonio,
      transactions,
      asOf,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.version]);
}

const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});
const pct = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const num = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4 });

export function fmtEur(v: { toNumber(): number } | number | undefined): string {
  if (v === undefined) return "—";
  return eur.format(typeof v === "number" ? v : v.toNumber());
}

export function fmtPct(v: { toNumber(): number } | number | undefined): string {
  if (v === undefined) return "—";
  return pct.format(typeof v === "number" ? v : v.toNumber());
}

export function fmtNum(v: { toNumber(): number } | number | undefined): string {
  if (v === undefined) return "—";
  return num.format(typeof v === "number" ? v : v.toNumber());
}
