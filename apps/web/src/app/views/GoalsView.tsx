import type { IsoDate } from "@unportfolio/core/beancount/ast";
import { goalTarget } from "@unportfolio/core/config/codecs";
import { deriveGoalStatus } from "@unportfolio/core/derive/goalStatus";
import { portfolioCurrents } from "@unportfolio/core/derive/patrimonio";
import type { Goal } from "@unportfolio/core/model/config";
import { useMemo, useState } from "react";
import { fmtEur, fmtPct, useApp, useDerived } from "../store/selectors";
import { saveGoals } from "../store/store";
import { EsuberoGraph } from "./EsuberoGraph";
import { Modal } from "./Modal";

export function GoalsView() {
  const s = useApp();
  const { patrimonio } = useDerived();
  const [editing, setEditing] = useState<Goal | "new">();
  const [showGraph, setShowGraph] = useState(true);
  const [reference, setReference] = useState<IsoDate | "live">("live");

  // Se la data di riferimento scelta sparisce (es. snapshot eliminato), torna a "live".
  const refValid = reference === "live" || patrimonio.dates.includes(reference);
  const ref = refValid ? reference : "live";

  const goalStatus = useMemo(
    () =>
      deriveGoalStatus({
        goals: s.goals,
        currents: portfolioCurrents(patrimonio, ref),
        priorita: s.config.priorita,
        flussi: s.config.esuberoFlussi,
      }),
    [patrimonio, ref, s.goals, s.config.priorita, s.config.esuberoFlussi],
  );

  if (s.goals.length === 0 && !editing) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">Nessun goal definito.</p>
        <button
          onClick={() => setEditing("new")}
          className="rounded bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600"
        >
          Nuovo goal
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {editing && (
        <Modal onClose={() => setEditing(undefined)}>
          <GoalForm
            goal={editing === "new" ? undefined : editing}
            all={s.goals}
            onClose={() => setEditing(undefined)}
          />
        </Modal>
      )}
      <section>
        <button
          onClick={() => setShowGraph(!showGraph)}
          className="mb-2 text-lg font-semibold text-zinc-200 hover:text-white"
        >
          {showGraph ? "▾" : "▸"} Grafo di esubero
        </button>
        {showGraph && <EsuberoGraph statuses={goalStatus} />}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-lg font-semibold">Goal Status — esubero a cascata</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <span>Riferimento</span>
            <select
              value={ref}
              onChange={(e) => setReference(e.target.value as IsoDate | "live")}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200"
            >
              <option value="live">Live (oggi)</option>
              {[...patrimonio.dates].reverse().map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          {ref !== "live" && (
            <span className="text-xs text-zinc-500">valori al {ref} invece dei correnti</span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400 [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
              <th>Portfolio</th>
              <th className="text-right">Target</th>
              <th className="text-right">Corrente</th>
              <th className="text-right">Completamento</th>
              <th className="text-right">Con esubero</th>
              <th className="text-right">Compl. c/esubero</th>
              <th className="text-right">Esubero →</th>
            </tr>
          </thead>
          <tbody>
            {goalStatus.map((g) => (
              <tr key={g.portfolio} className="border-b border-zinc-800 [&>td]:px-2 [&>td]:py-1.5">
                <td className="font-medium">{g.portfolio}</td>
                <td className="text-right tabular-nums">{fmtEur(g.target)}</td>
                <td className="text-right tabular-nums">{fmtEur(g.current)}</td>
                <td className="text-right">
                  <CompletionBar value={g.completion.toNumber()} />
                </td>
                <td className="text-right tabular-nums">{fmtEur(g.withSurplus)}</td>
                <td className="text-right">
                  <CompletionBar value={g.completionWithSurplus.toNumber()} />
                </td>
                <td
                  className={`text-right tabular-nums ${g.esubero.isNegative() ? "text-red-400" : "text-emerald-400"}`}
                >
                  {fmtEur(g.esubero)}
                  <div className="max-w-44 truncate text-right text-xs text-zinc-500">
                    {g.verso.length > 0 ? `→ ${g.verso.join(", ")}` : "terminale"}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-lg font-semibold">Obiettivi</h2>
          <button
            onClick={() => setEditing("new")}
            className="rounded bg-zinc-700 px-3 py-1 text-sm hover:bg-zinc-600"
          >
            Nuovo goal
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400 [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
              <th>ID</th>
              <th>Tipo</th>
              <th>Owner</th>
              <th>Portfolio</th>
              <th>Descrizione</th>
              <th className="text-right">Target</th>
              <th className="text-right">Data</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.goals.map((g) => (
              <tr
                key={g.id}
                className={`border-b border-zinc-800 [&>td]:px-2 [&>td]:py-1.5 ${g.attivo ? "" : "opacity-50"}`}
              >
                <td className="font-medium">{g.id}</td>
                <td>{g.tipo}</td>
                <td className="text-zinc-500">{g.owner}</td>
                <td className="max-w-44 truncate text-zinc-500">{g.portfolio}</td>
                <td className="max-w-64 truncate text-zinc-400">{g.descrizione ?? ""}</td>
                <td className="text-right tabular-nums">
                  {fmtEur(goalTarget(g))}
                  {g.target === undefined && g.costoStimato !== undefined && (
                    <div className="text-xs text-zinc-500">
                      {fmtEur(g.costoStimato)} × {fmtPct(g.probabilita ?? 1)}
                    </div>
                  )}
                </td>
                <td className="text-right tabular-nums text-zinc-500">{g.dataTarget ?? "—"}</td>
                <td className="text-right">
                  <button
                    onClick={() => setEditing(g)}
                    className="rounded px-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
                    title="Modifica goal"
                  >
                    ✎
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function GoalForm({
  goal,
  all,
  onClose,
}: {
  goal: Goal | undefined;
  all: Goal[];
  onClose: () => void;
}) {
  const [id, setId] = useState(goal?.id ?? "");
  const [tipo, setTipo] = useState(goal?.tipo ?? "Liquidità");
  const [owner, setOwner] = useState(goal?.owner ?? "");
  const [portfolio, setPortfolio] = useState(goal?.portfolio ?? "");
  const [descrizione, setDescrizione] = useState(goal?.descrizione ?? "");
  const [attivo, setAttivo] = useState(goal?.attivo ?? true);
  const [target, setTarget] = useState(goal?.target?.toString() ?? "");
  const [costo, setCosto] = useState(goal?.costoStimato?.toString() ?? "");
  const [prob, setProb] = useState(
    goal?.probabilita !== undefined ? String(goal.probabilita * 100) : "",
  );
  const [dataTarget, setDataTarget] = useState(goal?.dataTarget ?? "");

  async function save() {
    if (!id.trim() || !portfolio.trim()) return;
    const next: Goal = {
      id: id.trim(),
      attivo,
      tipo: tipo.trim(),
      owner: owner.trim(),
      portfolio: portfolio.trim(),
    };
    if (descrizione.trim()) next.descrizione = descrizione.trim();
    const costoN = Number(costo.replace(",", "."));
    const probN = Number(prob.replace(",", "."));
    if (costo.trim() && !Number.isNaN(costoN)) {
      next.costoStimato = costoN;
      if (prob.trim() && !Number.isNaN(probN)) next.probabilita = probN / 100;
    } else {
      const t = Number(target.replace(",", "."));
      if (!Number.isNaN(t) && target.trim()) next.target = t;
    }
    if (dataTarget) next.dataTarget = dataTarget;
    const others = all.filter((g) => g.id !== (goal?.id ?? id.trim()));
    await saveGoals([...others, next]);
    onClose();
  }

  async function remove() {
    if (!goal) return;
    if (!window.confirm(`Eliminare il goal "${goal.id}" da goals.toml?`)) return;
    await saveGoals(all.filter((g) => g.id !== goal.id));
    onClose();
  }

  return (
    <div className="w-full rounded border border-zinc-700 bg-zinc-900 p-4 text-sm">
      <div className="mb-3 font-medium">{goal ? `Modifica: ${goal.id}` : "Nuovo goal"}</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-zinc-500">ID</span>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={!!goal}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Tipo</span>
          <input
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Owner</span>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Portfolio (chiave di raggruppamento)</span>
          <input
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            list="portfolio-suggestions"
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
          <datalist id="portfolio-suggestions">
            {[...new Set(all.map((g) => g.portfolio))].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="col-span-2 block">
          <span className="text-xs text-zinc-500">Descrizione</span>
          <input
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500">Target € (esplicito)</span>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="es. 8300"
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right tabular-nums"
          />
        </label>
        <div className="flex gap-2">
          <label className="block flex-1">
            <span className="text-xs text-zinc-500">…oppure costo €</span>
            <input
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              placeholder="3000"
              className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right tabular-nums"
            />
          </label>
          <label className="block w-20">
            <span className="text-xs text-zinc-500">× prob. %</span>
            <input
              value={prob}
              onChange={(e) => setProb(e.target.value)}
              placeholder="80"
              className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right tabular-nums"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-zinc-500">Data target</span>
          <input
            type="date"
            value={dataTarget}
            onChange={(e) => setDataTarget(e.target.value)}
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
        </label>
        <label className="flex items-end gap-2 pb-1">
          <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} />
          <span className="text-zinc-400">attivo</span>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void save()}
          className="rounded bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600"
        >
          Salva
        </button>
        <button onClick={onClose} className="rounded bg-zinc-700 px-3 py-1.5 hover:bg-zinc-600">
          Annulla
        </button>
        {goal && (
          <button
            onClick={() => void remove()}
            className="ml-auto rounded border border-red-900 px-3 py-1.5 text-red-400 hover:bg-red-950"
          >
            Elimina
          </button>
        )}
      </div>
    </div>
  );
}

function CompletionBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(value, 1) * 100);
  return (
    <div className="inline-flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded bg-zinc-800">
        <div
          className={`h-full ${pct >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs tabular-nums">{pct}%</span>
    </div>
  );
}
