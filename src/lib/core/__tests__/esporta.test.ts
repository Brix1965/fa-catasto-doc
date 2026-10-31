import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decompilaDocumento } from '../decompile';
import { esportaPratica } from '../esporta';
import { splitCRLF } from '../bytes';

const ROOT = join(process.cwd(), 'fixtures-private');
const ok = existsSync(join(ROOT, 'NCV002/NCV002.DAT')) && existsSync(join(ROOT, 'NCV002/planimetria.dxf'));

describe.skipIf(!ok)('esportazione completa NCV002 (dal DXF)', () => {
  it('produce il PDF con annotazioni e planimetria generata dal DXF', async () => {
    const dir = join(ROOT, 'NCV002');
    const { pratica } = decompilaDocumento(
      new Uint8Array(readFileSync(join(dir, 'NCV002.DAT'))),
      new Uint8Array(readFileSync(join(dir, 'NMV002.DAT'))),
      new Uint8Array(readFileSync(join(dir, 'NCV002.ATT'))),
    );
    pratica.comune.nome = 'FIRENZE';
    pratica.comune.provincia = 'FI';
    const u = pratica.unita[0];
    u.planimetria!.dxf = readFileSync(join(dir, 'planimetria.dxf'), 'latin1');
    u.planimetria!.ntf = undefined;
    const r = await esportaPratica(pratica, { dataOra: new Date(2026, 9, 27, 16, 44, 27), data: new Date(2026, 9, 27, 15, 59, 14) });
    expect(r.avvisi).toEqual([]);
    expect(r.immagini.length).toBe(1);
    expect(r.immagini[0].ntf).toBeDefined();
    expect(r.nomeFile).toBe('NCV002.PDF');
    writeFileSync(join(dir, 'esportato_dal_dxf.pdf'), r.pdf);
    // il NCV rigenerato deve essere identico all'originale (l'ATT segna N = poligoni presenti)
    const orig = splitCRLF(new Uint8Array(readFileSync(join(dir, 'NCV002.DAT'))));
    const nostri = splitCRLF(r.compilato.ncv.dati);
    expect(nostri.length).toBe(orig.length);
    orig.forEach((rec, i) => {
      if (rec[16] === 0x49) return; // record I: zone non inizializzate in Docfa
      expect(Buffer.from(nostri[i]).equals(Buffer.from(rec)), `record ${i}`).toBe(true);
    });
    expect(Buffer.from(r.compilato.att.dati).equals(readFileSync(join(dir, 'NCV002.ATT')))).toBe(true);
  }, 60000);
});
