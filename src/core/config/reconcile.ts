import type { InstrumentPosition } from "../beancount/booking";
import type { CommodityInfo } from "../derive/assets";
import type { PatrimonioAccount } from "../model/config";

/**
 * Asset accounts to create for holdings that have no patrimonio row yet.
 *
 * Ogni posizione (deposito, commodity) deve avere un conto in patrimonio.toml.
 * Gli strumenti importati ma non ancora assegnati prendono un conto di default
 * (owner vuoto = "da assegnare", `deposito` = segmento del rapporto); il `nome`
 * parte dall'ISIN e si cura a mano.
 *
 * Copertura retro-compatibile: un conto senza `deposito` copre qualunque
 * deposito di quella commodity (impianto a deposito unico). Una volta assegnato
 * il `deposito` a un conto, le posizioni dello stesso ISIN su altri depositi
 * non sono più coperte e ottengono un conto proprio. Idempotente.
 */
export function missingAssetAccounts(
  positions: Map<string, InstrumentPosition>,
  commodities: Map<string, CommodityInfo>,
  accounts: PatrimonioAccount[],
): PatrimonioAccount[] {
  const ledgerAccounts = accounts.filter((a) => !!a.commodity);
  const covers = (deposito: string, commodity: string): boolean =>
    ledgerAccounts.some(
      (a) => a.commodity === commodity && (a.deposito === undefined || a.deposito === deposito),
    );

  const out: PatrimonioAccount[] = [];
  const created = new Set<string>();
  for (const pos of positions.values()) {
    const { deposito, commodity } = pos;
    const key = `${deposito}|${commodity}`;
    if (created.has(key) || covers(deposito, commodity)) continue;
    created.add(key);
    const info = commodities.get(commodity);
    const acc: PatrimonioAccount = {
      id: deposito
        ? `${commodity.toLowerCase()}-${deposito.toLowerCase()}`
        : commodity.toLowerCase(),
      nome: commodity, // default = ISIN, da curare a mano
      sezione: "asset",
      tipo: info?.assetClass ?? "ETF",
      owner: "",
      inNetWorth: true,
      valuta: "EUR",
      commodity,
    };
    if (deposito) acc.deposito = deposito;
    out.push(acc);
  }
  return out;
}
