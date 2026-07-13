import type { Meta, StoryObj } from "@storybook/react-vite";
import { Table, TBody, Td, TFoot, THead, Th, Tr } from "./Table";

const meta: Meta<typeof Table> = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Table>;

interface Riga {
  nome: string;
  quantita: number;
  valore: number;
}

const righe: Riga[] = [
  { nome: "Azioni globali", quantita: 12, valore: 18420.5 },
  { nome: "Obbligazioni EUR", quantita: 40, valore: 9650.0 },
  { nome: "Liquidità", quantita: 1, valore: 3200.75 },
];

const eur = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

/** Tabella completa: header, righe numeriche, riga cliccabile, footer. */
export const Completa: Story = {
  render: () => {
    const totale = righe.reduce((acc, r) => acc + r.valore, 0);
    return (
      <Table>
        <THead>
          <Tr>
            <Th>Strumento</Th>
            <Th align="right">Quantità</Th>
            <Th align="right">Valore</Th>
          </Tr>
        </THead>
        <TBody>
          {righe.map((r) => (
            <Tr key={r.nome} clickable onClick={() => {}}>
              <Td>{r.nome}</Td>
              <Td numeric>{r.quantita}</Td>
              <Td numeric>{eur(r.valore)}</Td>
            </Tr>
          ))}
        </TBody>
        <TFoot>
          <Tr>
            <Td>Totale</Td>
            <Td numeric />
            <Td numeric>{eur(totale)}</Td>
          </Tr>
        </TFoot>
      </Table>
    );
  },
};

/** Riga attenuata (muted) accanto a righe normali. */
export const RigaAttenuata: Story = {
  render: () => (
    <Table>
      <THead>
        <Tr>
          <Th>Conto</Th>
          <Th align="right">Saldo</Th>
        </Tr>
      </THead>
      <TBody>
        <Tr>
          <Td>Conto corrente</Td>
          <Td numeric>{eur(5200)}</Td>
        </Tr>
        <Tr muted>
          <Td>Conto chiuso</Td>
          <Td numeric>{eur(0)}</Td>
        </Tr>
      </TBody>
    </Table>
  ),
};

/** Solo intestazione e corpo, senza footer. */
export const Semplice: Story = {
  render: () => (
    <Table>
      <THead>
        <Tr>
          <Th>Data</Th>
          <Th>Descrizione</Th>
          <Th align="right">Importo</Th>
        </Tr>
      </THead>
      <TBody>
        <Tr>
          <Td>2026-01-15</Td>
          <Td>Dividendo</Td>
          <Td numeric>{eur(120.4)}</Td>
        </Tr>
        <Tr>
          <Td>2026-02-01</Td>
          <Td>Versamento</Td>
          <Td numeric>{eur(1000)}</Td>
        </Tr>
      </TBody>
    </Table>
  ),
};
