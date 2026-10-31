import { encode1252, decode1252 } from '../bytes';
import type { FieldDef, RecordSchema } from './types';
import { RECORD_LENGTH, SCHEMAS, VERSIONE } from './schema';
import { TEMPLATES } from './templates';

export type FieldValue = string | number | boolean | null | undefined;

/**
 * Un record a lunghezza fissa. Si parte dal template del tipo (zone riservate
 * già corrette) e si impostano i campi per id secondo lo schema.
 */
export class FixedRecord {
  readonly buf: Uint8Array;
  readonly schema: RecordSchema;
  private readonly byId: Map<string, FieldDef>;

  constructor(type: string, template?: Uint8Array | string) {
    const schema = SCHEMAS[type];
    if (!schema) throw new Error(`Tipo record sconosciuto: ${type}`);
    this.schema = schema;
    this.byId = new Map(schema.fields.map((f) => [f.id, f]));
    const tpl = template ?? TEMPLATES[type];
    if (tpl === undefined) throw new Error(`Nessun template per il record di tipo ${type}`);
    this.buf = typeof tpl === 'string' ? encode1252(tpl) : new Uint8Array(tpl);
    if (this.buf.length !== RECORD_LENGTH) throw new Error(`Template di lunghezza errata per ${type}: ${this.buf.length}`);
  }

  field(id: string): FieldDef {
    const f = this.byId.get(id);
    if (!f) throw new Error(`Campo sconosciuto nel record ${this.schema.type}: ${id}`);
    return f;
  }

  /** Imposta un campo. N: zero-filled a sinistra; AN: spazi a destra (troncato). */
  set(id: string, value: FieldValue): this {
    const f = this.field(id);
    const len = f.end - f.start + 1;
    let s: string;
    if (value === null || value === undefined) s = f.kind === 'N' ? '' : '';
    else if (typeof value === 'boolean') s = value ? '1' : '0';
    else s = String(value);
    if (f.kind === 'N') {
      if (!/^\d*$/.test(s)) throw new Error(`Valore non numerico per ${this.schema.type}.${id}: ${s}`);
      if (s.length > len) throw new Error(`Valore troppo lungo per ${this.schema.type}.${id}: ${s}`);
      s = s.padStart(len, '0');
    } else {
      s = s.length > len ? s.slice(0, len) : s.padEnd(len, ' ');
    }
    this.buf.set(encode1252(s), f.start - 1);
    return this;
  }

  /** Imposta più campi in un colpo (oggetto id → valore). */
  assign(values: Record<string, FieldValue>): this {
    for (const [k, v] of Object.entries(values)) this.set(k, v);
    return this;
  }

  /** Scrive byte grezzi in una posizione 1-based (per le zone non descritte dallo schema). */
  setRaw(start: number, bytes: Uint8Array | string): this {
    const b = typeof bytes === 'string' ? encode1252(bytes) : bytes;
    this.buf.set(b, start - 1);
    return this;
  }

  get(id: string): string {
    const f = this.field(id);
    return decode1252(this.buf.subarray(f.start - 1, f.end));
  }

  getTrimmed(id: string): string {
    const f = this.field(id);
    return f.kind === 'N' ? this.get(id).replace(/^0+(?=\d)/, '') : this.get(id).trimEnd();
  }

  /** Chiave standard del record. */
  key(progressivoVariazione: number, identificativo: string, progressivo: number, trascinato = 0, progressivoModelloD = 0): this {
    return this.assign({
      progressivo_variazione: progressivoVariazione,
      progressivo_modello_d: progressivoModelloD,
      identificativo_record: identificativo,
      progressivo,
      trascinato,
      tipo_record: this.schema.type,
      versione: VERSIONE,
    });
  }

  bytes(): Uint8Array {
    return this.buf;
  }

  /** Decodifica un record esistente (350 byte) in un oggetto id → valore (stringhe grezze). */
  static parse(line: Uint8Array): { type: string; values: Record<string, string>; record: FixedRecord } {
    if (line.length !== RECORD_LENGTH) throw new Error(`Record di lunghezza ${line.length}, attesi ${RECORD_LENGTH}`);
    const type = String.fromCharCode(line[16]);
    const rec = new FixedRecord(type, line);
    const values: Record<string, string> = {};
    for (const f of rec.schema.fields) values[f.id] = rec.get(f.id);
    return { type, values, record: rec };
  }
}

/** Record a lunghezza fissa generico (senza template), per i file minori come l'elenco subalterni. */
export class FixedRecordLibero {
  readonly buf: Uint8Array;
  private readonly byId: Map<string, FieldDef>;
  constructor(readonly fields: FieldDef[], length: number, template?: Uint8Array) {
    this.buf = template ? new Uint8Array(template) : new Uint8Array(length).fill(0x20);
    this.byId = new Map(fields.map((f) => [f.id, f]));
  }
  field(id: string): FieldDef {
    const f = this.byId.get(id);
    if (!f) throw new Error(`Campo sconosciuto: ${id}`);
    return f;
  }
  set(id: string, value: FieldValue): this {
    const f = this.field(id);
    const len = f.end - f.start + 1;
    let s = value === null || value === undefined ? '' : typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    if (f.kind === 'N') {
      if (!/^\d*$/.test(s)) throw new Error(`Valore non numerico per ${id}: ${s}`);
      s = s.padStart(len, '0');
    } else s = s.length > len ? s.slice(0, len) : s.padEnd(len, ' ');
    this.buf.set(encode1252(s), f.start - 1);
    return this;
  }
  assign(values: Record<string, FieldValue>): this {
    for (const [k, v] of Object.entries(values)) this.set(k, v);
    return this;
  }
  get(id: string): string {
    const f = this.field(id);
    return decode1252(this.buf.subarray(f.start - 1, f.end));
  }
  getTrimmed(id: string): string {
    const f = this.field(id);
    return f.kind === 'N' ? this.get(id).replace(/^0+(?=\d)/, '') : this.get(id).trimEnd();
  }
  bytes(): Uint8Array {
    return this.buf;
  }
}
