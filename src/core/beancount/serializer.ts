import type { Amount, Directive, LedgerFile, Meta, Posting, TransactionDirective } from "./ast";

function quote(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

function fmtAmount(a: Amount): string {
  return `${a.number.toString()} ${a.currency}`;
}

/** Metadata values: quote unless the value is a bare date or number. */
function fmtMetaValue(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v) || /^-?[\d.]+$/.test(v)) return v;
  return quote(v);
}

function fmtMeta(meta: Meta, indent: string): string[] {
  return Object.entries(meta).map(([k, v]) => `${indent}${k}: ${fmtMetaValue(v)}`);
}

const POSTING_INDENT = "  ";
const META_INDENT = "    ";

function fmtPosting(p: Posting): string[] {
  let line = POSTING_INDENT;
  if (p.flag) line += p.flag + " ";
  line += p.account;
  if (p.amount) {
    // align amounts in a 50-char gutter like bean-format
    const pad = Math.max(2, 50 - line.length - p.amount.number.toString().length);
    line += " ".repeat(pad) + fmtAmount(p.amount);
    if (p.cost) {
      const parts: string[] = [];
      if (p.cost.number !== undefined && p.cost.currency !== undefined)
        parts.push(`${p.cost.number.toString()} ${p.cost.currency}`);
      if (p.cost.date) parts.push(p.cost.date);
      if (p.cost.label) parts.push(quote(p.cost.label));
      line += ` {${parts.join(", ")}}`;
    }
    if (p.price) line += ` ${p.price.kind === "unit" ? "@" : "@@"} ${fmtAmount(p.price.amount)}`;
  }
  return [line, ...fmtMeta(p.meta, META_INDENT)];
}

function fmtTransaction(t: TransactionDirective): string {
  let header = `${t.date} ${t.flag}`;
  if (t.payee !== undefined) header += ` ${quote(t.payee)}`;
  header += ` ${quote(t.narration)}`;
  for (const tag of t.tags) header += ` #${tag}`;
  for (const link of t.links) header += ` ^${link}`;
  const lines = [header, ...fmtMeta(t.meta, POSTING_INDENT)];
  for (const p of t.postings) lines.push(...fmtPosting(p));
  return lines.join("\n") + "\n";
}

export function formatDirective(d: Directive): string {
  switch (d.kind) {
    case "raw":
      return d.src;
    case "transaction":
      return fmtTransaction(d);
    case "open": {
      let line = `${d.date} open ${d.account}`;
      if (d.currencies.length > 0) line += ` ${d.currencies.join(",")}`;
      if (d.booking) line += ` ${quote(d.booking)}`;
      return [line, ...fmtMeta(d.meta, POSTING_INDENT)].join("\n") + "\n";
    }
    case "close":
      return [`${d.date} close ${d.account}`, ...fmtMeta(d.meta, POSTING_INDENT)].join("\n") + "\n";
    case "commodity":
      return (
        [`${d.date} commodity ${d.currency}`, ...fmtMeta(d.meta, POSTING_INDENT)].join("\n") + "\n"
      );
    case "price":
      return (
        [
          `${d.date} price ${d.currency} ${fmtAmount(d.amount)}`,
          ...fmtMeta(d.meta, POSTING_INDENT),
        ].join("\n") + "\n"
      );
    case "balance":
      return (
        [
          `${d.date} balance ${d.account} ${fmtAmount(d.amount)}`,
          ...fmtMeta(d.meta, POSTING_INDENT),
        ].join("\n") + "\n"
      );
    case "option":
      return `option ${quote(d.name)} ${quote(d.value)}\n`;
    case "include":
      return `include ${quote(d.path)}\n`;
  }
}

/**
 * Lossless serialization: directives parsed from a file keep their original
 * source (`src`) and are emitted verbatim; directives created or edited by
 * the app (src === undefined) are formatted.
 */
export function serialize(file: LedgerFile): string {
  return file.directives.map((d) => (d.src !== undefined ? d.src : formatDirective(d))).join("");
}
