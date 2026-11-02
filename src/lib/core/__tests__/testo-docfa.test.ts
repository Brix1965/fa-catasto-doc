/** Accentate nel testo libero convertite come le scrive Docfa (segnalato da Fabrizio sulla relazione tecnica). */
import { it, expect } from 'vitest';
import { testoDocfa } from '../regole-docfa';
import { compilaDocumento } from '../compile';
import { nuovaPratica, tecnicoVuoto } from '$lib/stato/pratica-file';

it('è → e\', À → A\', apostrofi tipografici → \'', () => {
  expect(testoDocfa("l’unità immobiliare è stata oggetto di modifiche – PERCHÉ")).toBe("l'unita' immobiliare e' stata oggetto di modifiche - PERCHE'");
});
it('nelle note del documento (record 9) non restano accentate', () => {
  const p = nuovaPratica(tecnicoVuoto(), 'variazione', 1);
  p.annotazioni = "l'unità è stata variata";
  const r9 = compilaDocumento(p).records.map((r) => new TextDecoder('latin1').decode(r.bytes())).find((s) => s[16] === '9')!;
  expect(r9).toContain("l'unita' e' stata variata");
});
