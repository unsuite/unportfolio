import { useState } from "react";
import { fmtEur, useDerived } from "../store/selectors";

export function MovimentiView() {
  const { transactions } = useDerived();
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const rows = transactions
    .filter(
      (t) =>
        f === "" ||
        t.narration.toLowerCase().includes(f) ||
        t.payee?.toLowerCase().includes(f) ||
        t.postings.some((p) => p.account.toLowerCase().includes(f)),
    )
    .slice()
    .reverse();

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filtra per testo, ticker, conto…"
          className="w-80 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
        />
        <span className="text-sm text-zinc-500">{rows.length} transazioni</span>
      </div>
      <div className="space-y-1">
        {rows.map((t, i) => (
          <details
            key={t.meta["import-id"] ?? i}
            className="rounded border border-zinc-800 bg-zinc-900/50"
          >
            <summary className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm">
              <span className="tabular-nums text-zinc-500">{t.date}</span>
              <span className="font-medium">{t.payee}</span>
              <span className="flex-1 truncate text-zinc-300">{t.narration}</span>
              <span className="tabular-nums">
                {fmtEur(t.postings.find((p) => p.account.endsWith(":Cash"))?.amount?.number)}
              </span>
            </summary>
            <div className="border-t border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-400">
              {t.postings.map((p, j) => (
                <div key={j} className="flex justify-between">
                  <span>{p.account}</span>
                  <span className="tabular-nums">
                    {p.amount ? `${p.amount.number.toString()} ${p.amount.currency}` : ""}
                    {p.cost?.number ? ` {${p.cost.number.toString()} ${p.cost.currency}}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
