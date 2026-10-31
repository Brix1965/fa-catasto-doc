import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decompilaDocumento } from '../decompile';
import { compilaDocumento } from '../compile';
import { splitCRLF, decode1252, firstDiff } from '../bytes';
import { FixedRecord } from '../tracciati/record';

const ROOT = join(process.cwd(), 'fixtures-private');
const CASI = ['NCV002', 'NCV059', 'NCV065', 'NCV081'].filter((c) => existsSync(join(ROOT, c, `${c}.DAT`)));

function diffRecords(atteso: Uint8Array, ottenuto: Uint8Array): string[] {
  const a = splitCRLF(atteso).filter((l) => l.length);
  const b = splitCRLF(ottenuto).filter((l) => l.length);
  const out: string[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    let x = a[i], y = b[i];
    // record I: Docfa lascia memoria non inizializzata in 18-44 e 68-198 e varia il riempimento (0xFF/spazi) in 249-265: zone non significative
    if (x && y && x[16] === 0x49 /* I */) {
      x = new Uint8Array(x); y = new Uint8Array(y);
      for (const [a, b] of [[17, 44], [67, 198], [248, 259], [260, 265]]) { x.fill(0x20, a, b); y.fill(0x20, a, b); }
    }
    if (!x || !y) { out.push(`record ${i}: ${x ? 'manca nel generato' : 'in più nel generato'} (${decode1252((x ?? y).subarray(0, 17))})`); continue; }
    const d = firstDiff(x, y);
    if (d >= 0) {
      const type = String.fromCharCode(x[16]);
      let campo = '?';
      try { campo = FixedRecord.parse(x).record.schema.fields.find((f) => d + 1 >= f.start && d + 1 <= f.end)?.id ?? '(zona non mappata)'; } catch {}
      out.push(`record ${i} tipo ${type} pos ${d + 1} [${campo}]: atteso ${JSON.stringify(decode1252(x.subarray(d, d + 24)))} ottenuto ${JSON.stringify(decode1252(y.subarray(d, d + 24)))}`);
    }
  }
  return out;
}

if (CASI.length === 0) describe('round-trip', () => { it.skip('campioni in fixtures-private assenti', () => {}); });

describe.each(CASI)('round-trip %s', (caso) => {
  const dir = join(ROOT, caso);
  const ncv = new Uint8Array(readFileSync(join(dir, `${caso}.DAT`)));
  const nmv = new Uint8Array(readFileSync(join(dir, `NMV${caso.slice(3)}.DAT`)));
  const att = new Uint8Array(readFileSync(join(dir, `${caso}.ATT`)));
  const epvPath = join(dir, `EPV${caso.slice(3)}.DAT`);
  const epv = existsSync(epvPath) ? new Uint8Array(readFileSync(epvPath)) : undefined;
  const { pratica } = decompilaDocumento(ncv, nmv, att, epv);
  const out = compilaDocumento(pratica);

  it('NCV identico', () => {
    const diffs = diffRecords(ncv, out.ncv.dati);
    expect(diffs, diffs.join('\n')).toEqual([]);
  });
  it('NMV identico', () => {
    const diffs = diffRecords(nmv, out.nmv.dati);
    expect(diffs, diffs.join('\n')).toEqual([]);
  });
  it('ATT identico', () => {
    expect(decode1252(out.att.dati)).toEqual(decode1252(att));
  });
  if (epv)
    it('EPV identico', () => {
      const diffs = diffRecords(epv, out.epv!.dati);
      expect(diffs, diffs.join('\n')).toEqual([]);
    });
});
