/**
 * Confronto testo per testo con i PDF reali di Docfa: per ogni documento di prova in fixtures-private
 * il PDF rigenerato deve avere, pagina per pagina, gli stessi testi nelle stesse posizioni
 * (valori dei modelli 1N/2N, quadri del D1, dati metrici, elenco subalterni). Usa tools/pdf_confronta.py.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renderDocumento } from '../documento';
import { caricaCaso, casoDisponibile, ROOT, strumentoDisponibile } from './helpers';

const TMP = join(tmpdir(), 'fa-catasto-doc-pdf-test');
mkdirSync(TMP, { recursive: true });
const PYTHON_OK = strumentoDisponibile('python3', ['-c', 'import pikepdf']);
const CASI = ['NCV002', 'NCV059', 'NCV065', 'NCV081'].filter(casoDisponibile);

type Differenze = Record<string, { solo_originale: [number, number, string, string][]; solo_nostro: [number, number, string, string][] }>;

describe.skipIf(!PYTHON_OK || !CASI.length)('testi uguali ai PDF di Docfa', () => {
  it.each(CASI)('%s', async (nome) => {
    const caso = caricaCaso(nome);
    // senza immagini: le pagine delle planimetrie non hanno testi e non entrano nel confronto
    const pdf = await renderDocumento(caso.pratica, caso.compilato, [], { dataOra: new Date(2026, 9, 27, 16, 44, 27), ufficioProvinciale: 'FIRENZE' });
    const file = join(TMP, `${nome}-confronto.pdf`);
    writeFileSync(file, pdf);
    let out: string;
    try {
      out = execFileSync('python3', [join(ROOT, 'tools', 'pdf_confronta.py'), caso.pdfOriginale, file, '--ignora-fissi', '--json'], { encoding: 'utf-8' });
    } catch (e) {
      out = (e as { stdout: string }).stdout;
    }
    const diff = JSON.parse(out) as Differenze;
    // NCV059 è stato prodotto da una versione di Docfa che scriveva "Rendita" senza il simbolo dell'euro
    for (const [pg, d] of Object.entries(diff)) {
      d.solo_originale = d.solo_originale.filter((t) => t[3] !== 'Rendita');
      d.solo_nostro = d.solo_nostro.filter((t) => t[3] !== 'Rendita €');
      if (!d.solo_originale.length && !d.solo_nostro.length) delete diff[pg];
    }
    expect(diff, JSON.stringify(diff, null, 1)).toEqual({});
  });
});
