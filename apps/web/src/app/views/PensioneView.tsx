import type { Decimal } from "decimal.js";
import { useRef, useState } from "react";
import { serializeConfig } from "../../core/config/codecs";
import { portfolioCurrents } from "../../core/derive/patrimonio";
import { computePension, type PensionResult } from "../../core/math/pension";
import type { PensionProfile } from "../../core/model/config";
import { fmtEur, useApp, useDerived } from "../store/selectors";
import { writeFile } from "../store/store";

type Row = PensionProfile & { _id: number };

function newProfile(nome: string): PensionProfile {
  return {
    nome,
    dataNascita: "",
    etaPensionamento: 67,
    etaDecesso: 100,
    speseAnnuali: 30000,
    rendimentoPre: 0.05,
    rendimentoPost: 0.04,
    portafogli: [],
  };
}

function stripId(r: Row): PensionProfile {
  const { _id, ...rest } = r;
  return rest;
}

function CoverageBar({ label, live, target }: { label: string; live: number; target: number }) {
  const cov = Number.isFinite(target) && target > 0 ? live / target : undefined;
  const gap = Number.isFinite(target) ? live - target : Number.NEGATIVE_INFINITY;
  return (
    <div className="text-xs">
      <div className="mb-1 flex justify-between text-zinc-400">
        <span>{label}</span>
        <span className="tabular-nums">
          {cov !== undefined ? `${(cov * 100).toFixed(0)}%` : "—"}
          {Number.isFinite(gap) && (
            <span className={gap >= 0 ? "text-emerald-400" : "text-amber-400"}>
              {" "}
              ({gap >= 0 ? "+" : ""}
              {fmtEur(gap)})
            </span>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-zinc-800">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${Math.min(100, (cov ?? 0) * 100).toFixed(1)}%` }}
        />
      </div>
    </div>
  );
}

function TargetsTable({ r }: { r: PensionResult }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
          <th className="py-1.5 font-medium">Target</th>
          <th className="py-1.5 text-right font-medium">Senza erosione</th>
          <th className="py-1.5 text-right font-medium">Con erosione</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        <tr className="border-b border-zinc-900">
          <td className="py-1.5 text-zinc-400">A pensionamento</td>
          <td className="py-1.5 text-right">{fmtEur(r.targetPensionamentoSenzaErosione)}</td>
          <td className="py-1.5 text-right">{fmtEur(r.targetPensionamentoConErosione)}</td>
        </tr>
        <tr>
          <td className="py-1.5 text-zinc-400">
            Corrente <span className="text-xs text-zinc-600">(scontato ad oggi)</span>
          </td>
          <td className="py-1.5 text-right font-medium text-zinc-100">
            {fmtEur(r.targetCorrenteSenzaErosione)}
          </td>
          <td className="py-1.5 text-right font-medium text-zinc-100">
            {fmtEur(r.targetCorrenteConErosione)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** specchietto "capitale destinato alla pensione vs target": scelta portafogli,
 *  capitale considerato e barre di copertura. Condiviso tra nucleo e singola persona. */
function CapitalePanel({
  portafogli,
  portCurrents,
  selected,
  onToggle,
  considerato,
  totSenza,
  totCon,
  labelSenza,
  labelCon,
}: {
  portafogli: string[];
  portCurrents: Map<string, Decimal>;
  selected: string[];
  onToggle: (name: string) => void;
  considerato: number;
  totSenza: number;
  totCon: number;
  labelSenza: string;
  labelCon: string;
}) {
  return (
    <>
      <div className="mb-3">
        <div className="mb-1 text-xs text-zinc-500">
          Capitale destinato alla pensione — scegli i portafogli (nessuno = patrimonio totale)
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {portafogli.map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-xs text-zinc-300">
              <input type="checkbox" checked={selected.includes(p)} onChange={() => onToggle(p)} />
              <span>{p}</span>
              <span className="text-zinc-600 tabular-nums">
                {fmtEur(portCurrents.get(p)?.toNumber() ?? 0)}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-zinc-400">
          {selected.length
            ? `Capitale considerato (${selected.length} portaf.)`
            : "Patrimonio netto totale"}
        </span>
        <span className="text-lg font-semibold tabular-nums">{fmtEur(considerato)}</span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div className="flex justify-between border-r border-zinc-800 pr-3">
          <span className="text-zinc-400">Target corrente (senza erosione)</span>
          <span className="font-medium tabular-nums">{fmtEur(totSenza)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Target corrente (con erosione)</span>
          <span className="font-medium tabular-nums">{fmtEur(totCon)}</span>
        </div>
      </div>
      <div className="space-y-2">
        <CoverageBar label={labelSenza} live={considerato} target={totSenza} />
        <CoverageBar label={labelCon} live={considerato} target={totCon} />
      </div>
    </>
  );
}

export function PensioneView() {
  const s = useApp();
  const { patrimonio, asOf } = useDerived();
  const nextId = useRef(s.config.pensioni.length);
  const [rows, setRows] = useState<Row[]>(() =>
    s.config.pensioni.map((p, i) => ({ ...p, _id: i })),
  );
  const [saved, setSaved] = useState(false);
  // persone aperte in modifica: di default i campi sono in sola lettura
  const [editing, setEditing] = useState<Set<number>>(() => new Set());
  const toggleEdit = (id: number) =>
    setEditing((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function persist(next: Row[], portafogli: string[] = s.config.pensionePortafogli) {
    const ok = await writeFile(
      "config.toml",
      serializeConfig({ ...s.config, pensioni: next.map(stripId), pensionePortafogli: portafogli }),
    );
    setSaved(ok);
    if (ok) setTimeout(() => setSaved(false), 1500);
  }

  function togglePortafoglio(name: string) {
    const cur = s.config.pensionePortafogli;
    const next = cur.includes(name) ? cur.filter((p) => p !== name) : [...cur, name];
    void persist(rows, next);
  }

  function togglePersonPortafoglio(id: number, name: string) {
    setRows((rs) => {
      const next = rs.map((r) =>
        r._id === id
          ? {
              ...r,
              portafogli: r.portafogli.includes(name)
                ? r.portafogli.filter((p) => p !== name)
                : [...r.portafogli, name],
            }
          : r,
      );
      void persist(next);
      return next;
    });
  }

  function patch(id: number, p: Partial<PensionProfile>) {
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...p } : r)));
  }
  function addPerson() {
    const id = nextId.current++;
    setRows((rs) => {
      const next = [...rs, { ...newProfile(`Persona ${rs.length + 1}`), _id: id }];
      void persist(next);
      return next;
    });
    setEditing((s) => new Set(s).add(id)); // una persona nuova nasce in modifica
  }
  function removePerson(id: number) {
    setRows((rs) => {
      const next = rs.filter((r) => r._id !== id);
      void persist(next);
      return next;
    });
  }
  // salva l'array intero dopo una modifica a un campo (onBlur)
  const flush = () => setRows((rs) => (void persist(rs), rs));

  const portCurrents = portfolioCurrents(patrimonio, "live");
  const portafogli = [...portCurrents.keys()].sort();
  const selected = s.config.pensionePortafogli;
  // capitale destinato alla pensione: somma dei portafogli scelti, oppure il
  // patrimonio netto totale se non ne è selezionato nessuno
  const considerato = selected.length
    ? selected.reduce((acc, p) => acc + (portCurrents.get(p)?.toNumber() ?? 0), 0)
    : patrimonio.liveTotal.toNumber();
  const computed = rows.filter((r) => r.dataNascita !== "").map((r) => computePension(r, asOf));
  const sum = (pick: (r: PensionResult) => number) => computed.reduce((acc, r) => acc + pick(r), 0);
  const totSenza = sum((r) => r.targetCorrenteSenzaErosione);
  const totCon = sum((r) => r.targetCorrenteConErosione);

  return (
    <div className="max-w-3xl space-y-6 text-sm">
      <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Calcolo pensione</h2>
          {saved && <span className="text-xs text-emerald-400">config.toml salvato ✓</span>}
        </div>
        <p className="text-xs text-zinc-500">
          Stima il capitale-obiettivo per finanziare le spese in pensione, in termini reali (spese e
          rendimenti già al netto dell'inflazione). Due varianti: <strong>senza erosione</strong>{" "}
          (rendita perpetua, capitale intatto) e <strong>con erosione</strong> (consumi anche il
          capitale, azzerandolo a fine vita). Età = anno corrente − anno di nascita.
        </p>
      </section>

      {rows.map((row) => {
        const r = row.dataNascita !== "" ? computePension(row, asOf) : undefined;
        const isEditing = editing.has(row._id);
        // capitale destinato alla pensione di questa persona: portafogli scelti,
        // oppure il patrimonio netto totale se non ne è selezionato nessuno
        const considerato = row.portafogli.length
          ? row.portafogli.reduce((acc, p) => acc + (portCurrents.get(p)?.toNumber() ?? 0), 0)
          : patrimonio.liveTotal.toNumber();
        return (
          <section key={row._id} className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              {isEditing ? (
                <input
                  value={row.nome}
                  onChange={(e) => patch(row._id, { nome: e.target.value })}
                  onBlur={flush}
                  placeholder="Nome"
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-semibold"
                />
              ) : (
                <h3 className="font-semibold">{row.nome || "—"}</h3>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleEdit(row._id)}
                  className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  {isEditing ? "Fatto" : "Modifica"}
                </button>
                <button
                  type="button"
                  onClick={() => removePerson(row._id)}
                  className="rounded border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
                >
                  Rimuovi
                </button>
              </div>
            </div>

            {isEditing && (
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Data di nascita</span>
                  <input
                    type="date"
                    value={row.dataNascita}
                    onChange={(e) => patch(row._id, { dataNascita: e.target.value })}
                    onBlur={flush}
                    className="w-40 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 tabular-nums"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Età pensionamento</span>
                  <input
                    type="number"
                    value={row.etaPensionamento}
                    onChange={(e) =>
                      patch(row._id, { etaPensionamento: Math.round(+e.target.value) })
                    }
                    onBlur={flush}
                    className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Età decesso (orizzonte)</span>
                  <input
                    type="number"
                    value={row.etaDecesso}
                    onChange={(e) => patch(row._id, { etaDecesso: Math.round(+e.target.value) })}
                    onBlur={flush}
                    className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Spese annuali €</span>
                  <input
                    type="number"
                    value={row.speseAnnuali}
                    onChange={(e) => patch(row._id, { speseAnnuali: Math.max(0, +e.target.value) })}
                    onBlur={flush}
                    className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Rendimento pre %</span>
                  <input
                    type="number"
                    step="0.1"
                    value={row.rendimentoPre * 100}
                    onChange={(e) => patch(row._id, { rendimentoPre: +e.target.value / 100 })}
                    onBlur={flush}
                    className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Rendimento post %</span>
                  <input
                    type="number"
                    step="0.1"
                    value={row.rendimentoPost * 100}
                    onChange={(e) => patch(row._id, { rendimentoPost: +e.target.value / 100 })}
                    onBlur={flush}
                    className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums"
                  />
                </label>
              </div>
            )}

            {r ? (
              <>
                <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-400">
                  <span>
                    Età <strong className="text-zinc-200">{r.etaAttuale}</strong>
                  </span>
                  <span>
                    Anni alla pensione{" "}
                    <strong className="text-zinc-200">{r.anniAllaPensione}</strong>
                  </span>
                  <span>
                    Anni da finanziare{" "}
                    <strong className="text-zinc-200">{r.anniDaFinanziare}</strong>
                  </span>
                </div>
                <TargetsTable r={r} />
                <div className="mt-4 border-t border-zinc-800 pt-3">
                  <CapitalePanel
                    portafogli={portafogli}
                    portCurrents={portCurrents}
                    selected={row.portafogli}
                    onToggle={(name) => togglePersonPortafoglio(row._id, name)}
                    considerato={considerato}
                    totSenza={r.targetCorrenteSenzaErosione}
                    totCon={r.targetCorrenteConErosione}
                    labelSenza="vs target (senza erosione)"
                    labelCon="vs target (con erosione)"
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-500">Inserisci la data di nascita per i target.</p>
            )}
          </section>
        );
      })}

      <button
        type="button"
        onClick={addPerson}
        className="rounded bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600"
      >
        + Aggiungi persona
      </button>

      {computed.length > 0 && (
        <section className="rounded border border-zinc-700 bg-zinc-900/60 p-4">
          <h3 className="mb-3 font-semibold">Nucleo · {computed.length} persone</h3>

          <CapitalePanel
            portafogli={portafogli}
            portCurrents={portCurrents}
            selected={selected}
            onToggle={togglePortafoglio}
            considerato={considerato}
            totSenza={totSenza}
            totCon={totCon}
            labelSenza="vs target nucleo (senza erosione)"
            labelCon="vs target nucleo (con erosione)"
          />
        </section>
      )}
    </div>
  );
}
