import type { CommodityInfo } from "../derive/assets";
import type { PatrimonioAccount } from "../model/config";

/**
 * Asset accounts to create for instruments that have no patrimonio row yet.
 *
 * Ogni strumento (direttiva commodity) deve avere un conto in patrimonio.toml,
 * così il modello è sempre 1:1 commodity↔conto e l'etichetta visualizzata è il
 * `nome` del conto. Gli strumenti importati ma non ancora assegnati prendono un
 * conto di default (owner vuoto = "da assegnare"); il `nome` parte dall'ISIN e
 * si cura a mano. Idempotente: ritorna [] quando ogni commodity ha già un conto.
 */
export function missingAssetAccounts(
  commodities: Map<string, CommodityInfo>,
  accounts: PatrimonioAccount[],
): PatrimonioAccount[] {
  const have = new Set(accounts.map((a) => a.commodity).filter((c): c is string => !!c));
  const out: PatrimonioAccount[] = [];
  for (const [commodity, info] of commodities) {
    if (have.has(commodity)) continue;
    out.push({
      id: commodity.toLowerCase(),
      nome: commodity, // default = ISIN, da curare a mano
      sezione: "asset",
      tipo: info.assetClass,
      owner: "",
      inNetWorth: true,
      valuta: "EUR",
      commodity,
    });
  }
  return out;
}
