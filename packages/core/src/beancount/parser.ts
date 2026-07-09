import { Decimal } from "decimal.js";
import type {
  Amount,
  CostSpec,
  Directive,
  LedgerFile,
  Meta,
  OpenDirective,
  Posting,
  PostingPrice,
  TransactionDirective,
} from "./ast";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_RE = /^(Assets|Liabilities|Equity|Income|Expenses)(:[A-Z0-9][A-Za-z0-9-]*)+$/;
const CURRENCY_RE = /^[A-Z][A-Z0-9'._-]{0,22}[A-Z0-9]?$/;
const META_KEY_RE = /^[a-z][a-zA-Z0-9_-]*$/;

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
  ) {
    super(`line ${line}: ${message}`);
  }
}

/** Parse a beancount number: optional sign, thousands commas allowed. */
export function parseNumber(text: string): Decimal {
  return new Decimal(text.replace(/,/g, ""));
}

function stripComment(line: string): string {
  // A ';' starts a comment unless inside a double-quoted string.
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i - 1] !== "\\") inString = !inString;
    else if (ch === ";" && !inString) return line.slice(0, i);
  }
  return line;
}

/** Split a line into tokens: quoted strings, braces/@ symbols, plain words. */
function tokenize(line: string, lineNo: number): string[] {
  const tokens: string[] = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    const ch = line[i]!;
    if (ch === " " || ch === "\t") {
      i++;
    } else if (ch === '"') {
      let j = i + 1;
      let out = "";
      while (j < n && line[j] !== '"') {
        if (line[j] === "\\" && j + 1 < n) {
          out += line[j + 1];
          j += 2;
        } else {
          out += line[j];
          j++;
        }
      }
      if (j >= n) throw new ParseError("unterminated string", lineNo);
      tokens.push('"' + out); // marker prefix: token is a string literal
      i = j + 1;
    } else if (ch === "{" || ch === "}" || ch === ",") {
      tokens.push(ch);
      i++;
    } else if (ch === "@") {
      if (line[i + 1] === "@") {
        tokens.push("@@");
        i += 2;
      } else {
        tokens.push("@");
        i++;
      }
    } else {
      let j = i;
      while (j < n) {
        const c = line[j]!;
        if (c === "@" || ' \t"{}'.includes(c)) break;
        if (c === ",") {
          // thousands separator: keep the comma only inside a number (digit,digit)
          const isThousands = /^-?[\d,]*\d$/.test(line.slice(i, j)) && /\d/.test(line[j + 1] ?? "");
          if (!isThousands) break;
        }
        j++;
      }
      tokens.push(line.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

const isString = (t: string | undefined): t is string => t !== undefined && t.startsWith('"');
const strVal = (t: string) => t.slice(1);

interface Line {
  no: number;
  raw: string; // original text, no trailing newline
  text: string; // comment-stripped, rtrimmed
  indented: boolean;
}

function isNumberToken(t: string): boolean {
  return /^-?[\d,]+(\.\d*)?$/.test(t) || /^-?\.\d+$/.test(t);
}

/** Parse "NUMBER CURRENCY" starting at tokens[i]. Returns [amount, nextIndex]. */
function parseAmountAt(tokens: string[], i: number, lineNo: number): [Amount, number] {
  const num = tokens[i];
  const cur = tokens[i + 1];
  if (num === undefined || !isNumberToken(num))
    throw new ParseError(`expected number, got '${num ?? "EOL"}'`, lineNo);
  if (cur === undefined || !CURRENCY_RE.test(cur))
    throw new ParseError(`expected currency, got '${cur ?? "EOL"}'`, lineNo);
  return [{ number: parseNumber(num), currency: cur }, i + 2];
}

function parsePostingLine(line: Line): Posting {
  const tokens = tokenize(line.text.trim(), line.no);
  let i = 0;
  let flag: string | undefined;
  if (tokens[i] === "!" || tokens[i] === "*") flag = tokens[i++];
  const account = tokens[i++];
  if (account === undefined || !ACCOUNT_RE.test(account))
    throw new ParseError(`invalid account '${account ?? "EOL"}'`, line.no);
  const posting: Posting = { account, meta: {} };
  if (flag) posting.flag = flag;
  if (i < tokens.length) {
    [posting.amount, i] = parseAmountAt(tokens, i, line.no);
  }
  if (tokens[i] === "{") {
    i++;
    const cost: CostSpec = {};
    while (tokens[i] !== "}") {
      const t = tokens[i];
      if (t === undefined) throw new ParseError("unterminated cost spec", line.no);
      if (t === ",") {
        i++;
      } else if (DATE_RE.test(t)) {
        cost.date = t;
        i++;
      } else if (isString(t)) {
        cost.label = strVal(t);
        i++;
      } else if (isNumberToken(t)) {
        const [amt, next] = parseAmountAt(tokens, i, line.no);
        cost.number = amt.number;
        cost.currency = amt.currency;
        i = next;
      } else {
        throw new ParseError(`unexpected token in cost spec: '${t}'`, line.no);
      }
    }
    i++; // consume }
    posting.cost = cost;
  }
  if (tokens[i] === "@" || tokens[i] === "@@") {
    const kind: PostingPrice["kind"] = tokens[i] === "@" ? "unit" : "total";
    i++;
    const [amount, next] = parseAmountAt(tokens, i, line.no);
    posting.price = { kind, amount };
    i = next;
  }
  if (i < tokens.length)
    throw new ParseError(`unexpected trailing tokens: '${tokens[i]}'`, line.no);
  return posting;
}

/** key: value — value kept as raw string (unquoted if it was a string literal). */
function tryParseMetaLine(line: Line): [string, string] | undefined {
  const m = /^\s+([a-z][a-zA-Z0-9_-]*):\s*(.*)$/.exec(line.text);
  if (!m) return undefined;
  const key = m[1]!;
  if (!META_KEY_RE.test(key)) return undefined;
  let value = m[2]!.trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
    value = value.slice(1, -1).replace(/\\(.)/g, "$1");
  return [key, value];
}

function parseTransaction(header: Line, body: Line[]): TransactionDirective {
  const tokens = tokenize(header.text.trim(), header.no);
  const date = tokens[0]!;
  let flag = tokens[1]!;
  if (flag === "txn") flag = "*";
  let i = 2;
  const strings: string[] = [];
  while (isString(tokens[i])) strings.push(strVal(tokens[i++]!));
  const tags: string[] = [];
  const links: string[] = [];
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (t.startsWith("#")) tags.push(t.slice(1));
    else if (t.startsWith("^")) links.push(t.slice(1));
    else throw new ParseError(`unexpected token '${t}' in transaction header`, header.no);
    i++;
  }
  let payee: string | undefined;
  let narration = "";
  if (strings.length === 1) narration = strings[0]!;
  else if (strings.length >= 2) {
    payee = strings[0];
    narration = strings[1]!;
  }

  const meta: Meta = {};
  const postings: Posting[] = [];
  for (const line of body) {
    const kv = tryParseMetaLine(line);
    if (kv) {
      if (postings.length === 0) meta[kv[0]] = kv[1];
      else postings[postings.length - 1]!.meta[kv[0]] = kv[1];
    } else {
      postings.push(parsePostingLine(line));
    }
  }

  const txn: TransactionDirective = {
    kind: "transaction",
    date,
    flag,
    narration,
    tags,
    links,
    meta,
    postings,
  };
  if (payee !== undefined) txn.payee = payee;
  return txn;
}

function parseSimpleDirective(header: Line, body: Line[], keyword: string): Directive {
  const tokens = tokenize(header.text.trim(), header.no);
  const date = tokens[0]!;
  const meta: Meta = {};
  for (const line of body) {
    const kv = tryParseMetaLine(line);
    if (!kv) throw new ParseError(`expected metadata under ${keyword}`, line.no);
    meta[kv[0]] = kv[1];
  }
  switch (keyword) {
    case "open": {
      const account = tokens[2];
      if (account === undefined || !ACCOUNT_RE.test(account))
        throw new ParseError(`invalid account in open`, header.no);
      const currencies: string[] = [];
      let booking: string | undefined;
      for (let i = 3; i < tokens.length; i++) {
        const t = tokens[i]!;
        if (isString(t)) booking = strVal(t);
        else if (t !== ",") currencies.push(t);
      }
      const d: OpenDirective = { kind: "open", date, account, currencies, meta };
      if (booking !== undefined) d.booking = booking;
      return d;
    }
    case "close": {
      const account = tokens[2];
      if (account === undefined || !ACCOUNT_RE.test(account))
        throw new ParseError(`invalid account in close`, header.no);
      return { kind: "close", date, account, meta };
    }
    case "commodity": {
      const currency = tokens[2];
      if (currency === undefined || !CURRENCY_RE.test(currency))
        throw new ParseError(`invalid currency in commodity`, header.no);
      return { kind: "commodity", date, currency, meta };
    }
    case "price": {
      const currency = tokens[2];
      if (currency === undefined || !CURRENCY_RE.test(currency))
        throw new ParseError(`invalid currency in price`, header.no);
      const [amount] = parseAmountAt(tokens, 3, header.no);
      return { kind: "price", date, currency, amount, meta };
    }
    case "balance": {
      const account = tokens[2];
      if (account === undefined || !ACCOUNT_RE.test(account))
        throw new ParseError(`invalid account in balance`, header.no);
      const [amount] = parseAmountAt(tokens, 3, header.no);
      return { kind: "balance", date, account, amount, meta };
    }
    default:
      throw new ParseError(`unsupported directive '${keyword}'`, header.no);
  }
}

const KNOWN_DATED = new Set(["txn", "*", "!", "open", "close", "commodity", "price", "balance"]);

/**
 * Parse beancount source. Modeled directives become typed; everything else
 * (comments, blank lines, unknown directives like note/event/pad/document)
 * is preserved as raw blocks. serialize(parse(text)) === text always holds.
 */
export function parse(source: string): LedgerFile {
  const rawLines = source.split("\n");
  // split("\n") yields a trailing "" if source ends with \n; drop it.
  const endsWithNewline = source.endsWith("\n");
  if (endsWithNewline) rawLines.pop();

  const lines: Line[] = rawLines.map((raw, idx) => ({
    no: idx + 1,
    raw,
    text: stripComment(raw).replace(/\s+$/, ""),
    indented: /^[ \t]/.test(raw),
  }));

  const directives: Directive[] = [];
  let rawBuf: string[] = [];
  const flushRaw = () => {
    if (rawBuf.length > 0) {
      directives.push({ kind: "raw", src: rawBuf.join("\n") + "\n" });
      rawBuf = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.text.trim();

    // blank / comment-only / indented stray lines → raw
    if (trimmed === "" || line.indented) {
      rawBuf.push(line.raw);
      i++;
      continue;
    }

    const firstWord = trimmed.split(/\s+/)[0]!;

    let header: Line | undefined;
    let keyword: string | undefined;
    if (DATE_RE.test(firstWord)) {
      const second = trimmed.split(/\s+/)[1];
      if (second !== undefined && KNOWN_DATED.has(second)) {
        header = line;
        keyword = second;
      }
    } else if (firstWord === "option" || firstWord === "include") {
      header = line;
      keyword = firstWord;
    }

    if (header === undefined || keyword === undefined) {
      rawBuf.push(line.raw);
      i++;
      continue;
    }

    // collect indented continuation lines (skipping blank lines is NOT done:
    // a blank line ends the directive, like beancount)
    const body: Line[] = [];
    let j = i + 1;
    const bodyRaw: string[] = [];
    while (j < lines.length && lines[j]!.indented && lines[j]!.text.trim() !== "") {
      body.push(lines[j]!);
      bodyRaw.push(lines[j]!.raw);
      j++;
    }
    const src = [line.raw, ...bodyRaw].join("\n") + "\n";

    try {
      let d: Directive;
      if (keyword === "option") {
        const tokens = tokenize(trimmed, line.no);
        if (!isString(tokens[1]) || !isString(tokens[2]))
          throw new ParseError("option expects two strings", line.no);
        d = { kind: "option", name: strVal(tokens[1]!), value: strVal(tokens[2]!) };
      } else if (keyword === "include") {
        const tokens = tokenize(trimmed, line.no);
        if (!isString(tokens[1])) throw new ParseError("include expects a string", line.no);
        d = { kind: "include", path: strVal(tokens[1]!) };
      } else if (keyword === "txn" || keyword === "*" || keyword === "!") {
        d = parseTransaction(line, body);
      } else {
        d = parseSimpleDirective(line, body, keyword);
      }
      d.src = src;
      flushRaw();
      directives.push(d);
    } catch (e) {
      if (e instanceof ParseError) {
        // Tolerant mode: keep unparseable blocks as raw so nothing is lost.
        rawBuf.push(line.raw, ...bodyRaw);
      } else {
        throw e;
      }
    }
    i = j;
  }
  flushRaw();

  // If the file didn't end with a newline, mark it by trimming the final block's src.
  if (!endsWithNewline && directives.length > 0) {
    const last = directives[directives.length - 1]!;
    if (last.src !== undefined) last.src = last.src.replace(/\n$/, "");
  }

  return { directives };
}
