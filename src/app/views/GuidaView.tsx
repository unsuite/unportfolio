/** Pagina esplicativa delle metriche di rendimento (MWRR vs TWRR). */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-3xl">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}

export function GuidaView() {
  return (
    <div className="space-y-8">
      <Section title="MWRR: il rendimento annuo dei tuoi soldi">
        <p>
          Il gain (anche in percentuale) non basta per giudicare un investimento:{" "}
          <strong>+10% in 4 anni e +10% in 6 mesi non sono la stessa cosa</strong>, e se hai versato
          in più tranche ogni euro è stato investito per un tempo diverso. Il <strong>MWRR</strong>{" "}
          (money-weighted rate of return) risolve esattamente questo: è{" "}
          <strong>il tasso annuo equivalente che avrebbe prodotto gli stessi risultati</strong> —
          come se ogni tuo versamento fosse stato messo su un conto a interesse composto da quel
          giorno fino a oggi.
        </p>
        <p>
          Nel calcolo entra <em>tutto ciò che è cassa</em>: acquisti, vendite, commissioni, cedole e
          dividendi, più il valore di oggi della posizione. E ogni flusso pesa per quanto è grande e
          per quanto a lungo è rimasto investito: 10.000 € fermi 3 anni contano molto più di 100 €
          entrati il mese scorso.
        </p>
        <p>
          Essendo annualizzato,{" "}
          <strong>rende confrontabili investimenti con durate e flussi diversi</strong>: un bond
          tenuto 4 anni e un ETF comprato 8 mesi fa si leggono sulla stessa scala. È il motivo per
          cui questa è la colonna da guardare al posto del semplice capital gain.
        </p>
      </Section>

      <Section title="TWRR: la performance dello strumento, non la tua">
        <p>
          Il <strong>TWRR</strong> (time-weighted rate of return) spezza la storia in periodi
          delimitati da ogni acquisto/vendita, calcola il rendimento di ciascun periodo e li
          moltiplica. Così{" "}
          <strong>la dimensione e il momento dei tuoi versamenti non contano più</strong>: misura
          solo come si è mosso il prezzo dello strumento mentre lo possedevi. È la metrica con cui
          si giudicano i fondi (il gestore non controlla quando i clienti versano).
        </p>
        <p className="text-zinc-400">
          Nota tecnica: qui il TWRR è <em>price-only</em> (cedole e commissioni escluse, le trovi
          nel MWRR e nel Gain netto) e le valutazioni ai confini usano lo storico campionato — con
          campioni settimanali è un'approssimazione.
        </p>
      </Section>

      <Section title="Come confrontarli">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400 [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
              <th>Se osservi…</th>
              <th>Significa…</th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-b [&>tr]:border-zinc-800 [&>tr>td]:px-2 [&>tr>td]:py-2 [&>tr>td]:align-top">
            <tr>
              <td className="font-medium whitespace-nowrap">MWRR ≈ TWRR</td>
              <td>
                I tuoi versamenti non hanno influito: o sono stati regolari (PAC), o piccoli
                rispetto alla posizione, o il prezzo si è mosso in modo uniforme.
              </td>
            </tr>
            <tr>
              <td className="font-medium whitespace-nowrap">MWRR &lt; TWRR</td>
              <td>
                <strong>Timing sfavorevole</strong>: hai versato di più prima dei ribassi o dopo i
                rialzi. Lo strumento è andato meglio di quanto ne abbiano beneficiato i tuoi soldi.
              </td>
            </tr>
            <tr>
              <td className="font-medium whitespace-nowrap">MWRR &gt; TWRR</td>
              <td>
                <strong>Timing favorevole</strong> (o cedole): hai comprato nei momenti giusti —
                oppure, per i bond, il MWRR include cedole che il TWRR price-only non vede.
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Esempi dal portafoglio">
        <p>
          <strong>ETF azionario comprato in due tranche</strong> — primo acquisto a 100, il prezzo
          sale a 110, secondo acquisto (più grosso), il prezzo chiude a 121. Il TWRR è +10% × +10% ={" "}
          <strong>+21%</strong> qualunque sia la dimensione delle tranche. Il MWRR invece scende
          verso il +10% quanto più è grossa la seconda tranche: la maggior parte dei soldi ha visto
          solo l'ultimo tratto. È il caso "MEUD": TWRR 25% annuo ma MWRR 16,6% — il grosso è entrato
          a prezzi già alti.
        </p>
        <p>
          <strong>Bond tenuto per le cedole</strong> — il prezzo scivola leggermente sotto il
          carico: TWRR ≈ −1%. Ma le cedole incassate entrano nei flussi: MWRR +2%. Nessun mistero:
          stanno misurando due cose diverse, e la differenza ≈ il rendimento cedolare.
        </p>
        <p>
          <strong>Acquisto unico recente</strong> — con un solo flusso e pochi mesi di storia le due
          metriche quasi coincidono e l'annualizzazione amplifica il rumore: sotto i 90 giorni
          mostriamo solo il cumulato ("dal …").
        </p>
      </Section>

      <Section title="Quale guardare, in pratica">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Sto scegliendo/giudicando lo strumento?</strong> → TWRR (e confrontalo col
            benchmark).
          </li>
          <li>
            <strong>Sto giudicando il mio piano di investimento?</strong> → MWRR: è il rendimento
            effettivo dei tuoi euro.
          </li>
          <li>
            <strong>Il divario MWRR−TWRR</strong> è la misura del tuo market timing (più le cedole,
            per i bond). Su un PAC disciplinato tende a zero da solo.
          </li>
        </ul>
      </Section>
    </div>
  );
}
