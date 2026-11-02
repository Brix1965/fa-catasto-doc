/**
 * Logo del D1: non è nel repository, si prende da un PDF di Docfa del tecnico (qui NCV002 in fixtures-private)
 * e si stampa sulla prima pagina del D1 nella stessa posizione di Docfa.
 */
import { it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { estraiLogoD1 } from '../importa';
import { renderDocumento } from '../documento';
import { caricaCaso, casoDisponibile } from './helpers';

it.skipIf(!casoDisponibile('NCV002') || !existsSync('fixtures-private/NCV002.PDF'))('logo letto dal PDF di Docfa e stampato sul D1', async () => {
  const logo = await estraiLogoD1(new Uint8Array(readFileSync('fixtures-private/NCV002.PDF')));
  expect(logo).toMatchObject({ larghezza: 502, altezza: 178 });
  const caso = caricaCaso('NCV002');
  const pdf = await renderDocumento(caso.pratica, caso.compilato, [], { logoD1: logo! });
  const testo = new TextDecoder('latin1').decode(pdf);
  expect(testo).toContain('/Filter /DCTDecode');
  expect(testo.match(/\/XObject <<\/Im0/g)?.length).toBe(1);
});
