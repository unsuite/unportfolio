import type { InstrumentInfo, RawMovimento } from "../model/movimento";

export interface ImportFile {
  name: string;
  /** text files (CSV) */
  text?: string;
  /** binary files */
  bytes?: Uint8Array;
}

export interface ImportResult {
  movimenti: RawMovimento[];
  /** instrument registry carried by the source, when available */
  instruments: InstrumentInfo[];
  warnings: string[];
}

export interface ImporterPlugin {
  id: string;
  label: string;
  /** quick check on name/content to offer this importer automatically */
  sniff(file: ImportFile): boolean;
  parse(file: ImportFile): ImportResult;
}
