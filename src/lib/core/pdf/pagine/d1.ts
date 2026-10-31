/**
 * Modello D1 (prima pagina del documento): quadro B (dichiarazione di variazione), quadro U
 * (elenco delle unità immobiliari, anche su più pagine), quadro D (note), dichiarazioni del tecnico
 * e spazio riservato all'ufficio. Le posizioni (in mm dal bordo inferiore, griglia di 1 mm) sono
 * quelle osservate nei PDF di Docfa 4.
 */
import type { Pratica, UnitaImmobiliare } from '../../model';
import type { Compilato } from '../../compile';
import { Pagina, MM } from '../pagina';
import { FORMATO, intestazione, riquadroModello, type DatiCornice } from '../cornice';
import { aCapo, aDestra, dataEstesa, decimali, intero } from '../formato';
import { albo, CAUSALI_STAMPA, rigaAlbo } from '../tabelle';
import { TITOLI } from '../../dati/docfa-tabelle.generated';
import { CAUSALI_ATTO } from '../../regole-docfa';

const X1 = 28.346; // bordo sinistro dei riquadri (10 mm)
const X2 = 566.929; // bordo destro (200 mm)
const mm = (v: number): number => v * MM;

/** Testo del "numero" dell'unità: indice nel documento, allineato a destra su 3 caratteri. */
function n3(v: number): string {
  return aDestra(String(v), 3);
}

/** Categoria come la stampa Docfa: "A03" → ["A/", " 3"]; "D02" → ["D/", " 2"]. */
function categoriaStampa(cat: string): [string, string] {
  const c = cat.trim();
  if (!c) return ['', ''];
  return [c.charAt(0) + '/', aDestra(c.slice(1).replace(/^0+(?=\d)/, ''), 2)];
}

/** Riga dell'indirizzo: toponimo + civico allineato a destra su 6 caratteri (come nel record). */
function indirizzoStampa(u: UnitaImmobiliare): string {
  const ind = u.indirizzo;
  if (!ind) return '';
  const civici = ind.civici.map((c) => (/^\d+$/.test(c.trim()) ? aDestra(c.trim(), 6) : c.trim())).join(' ');
  return `${ind.toponimo} ${civici}`.trimEnd();
}

/** Piani come li stampa Docfa: piano 1 + spazio + piano 2 (su 4) + spazio + piano 3. */
function pianiStampa(piani: string[]): string {
  if (!piani.length) return '';
  const [p1 = '', p2 = '', p3 = ''] = piani;
  return `${p1.trim()} ${p2.padEnd(4, ' ')} ${p3}`.trimEnd();
}

function pianiStampaIndirizzo(u: UnitaImmobiliare): string {
  return pianiStampa(u.indirizzo?.piani ?? []);
}

export function pagineD1(pratica: Pratica, compilato: Compilato, cornice: DatiCornice): Pagina[] {
  const r1 = compilato.records.find((r) => r.schema.type === '1');
  const pagine: Pagina[] = [];
  const nuovaPagina = (): Pagina => {
    const p = new Pagina(FORMATO.d1.larghezza, FORMATO.d1.altezza);
    intestazione(p, cornice);
    // intestazione del modello (al posto del logo dell'Agenzia: spazio vuoto)
    p.testo(113.386, 754.016, 'B', 9, 'MODELLO UNICO INFORMATICO DI AGGIORNAMENTO DEGLI ATTI CATASTALI');
    p.testo(127.559, 742.677, 'B', 10, "ACCERTAMENTO DELLA PROPRIETA' IMMOBILIARE URBANA");
    riquadroModello(p, 'mod. D1');
    pagine.push(p);
    return p;
  };

  let p = nuovaPagina();
  const acc = pratica.tipoDocumento === 'accatastamento';
  const riquadro = (y1: number, y2: number) => p.rettangolo(X1, mm(y2), X2 - X1, mm(y1 - y2), 1);
  const R = (x: number, ymm: number, s: string, size = 9) => p.testo(x, mm(ymm), 'R', size, s);
  const B = (x: number, ymm: number, s: string, size = 9) => p.testo(x, mm(ymm), 'B', size, s);
  const v1 = (id: string, len = 3): string => {
    const s = r1 ? intero(r1.get(id)) : '';
    return s ? aDestra(s, len) : '';
  };
  const stampa = (x: number, y: number, s: string, size = 9) => { if (s) B(x, y, s, size); };
  /** x in mm (coordinate del programma di stampa di Docfa) → punti */
  const X = (xmm: number) => xmm * MM;

  let topU = 186;
  if (acc) {
    // ---------------------------------------------------------------- Quadro A (posizioni dal programma di stampa NZST00)
    riquadro(254, 249);
    riquadro(249, 230);
    riquadro(230, 215);
    B(X(10.5), 250, ' Quadro A | ');
    B(X(30), 250, 'Dichiarazione di Fabbricato Urbano o Nuova Costruzione');
    R(X(10.5), 245, ' Tipo Mappale n.');
    R(X(46), 245, 'del ');
    R(X(86), 245, 'Ditta ');
    R(X(100), 245, 'n. ');
    R(X(110), 245, 'di ');
    R(X(139), 245, "Unita' a ");
    R(X(150), 245, 'destinazione ordinaria ');
    R(X(150), 240, 'speciale e particolare ');
    R(X(150), 235, 'totali in costituzione ');
    for (const y of [245, 240, 235]) R(X(183), y, 'n. ');
    R(X(10.5), 240, ' Causale: ');
    R(X(10.5), 235, " Data in cui l'immobile è divenuto servibile all'uso (ultimazione dei lavori):");
    R(X(10.5), 225, ' Documenti allegati: ');
    R(X(40), 225, 'Mod. 1N parte I ');
    R(X(40), 220, 'Mod. 1N parte II ');
    R(X(86), 225, 'Mod. 2N parte I ');
    R(X(86), 220, 'Mod. 2N parte II ');
    R(X(139), 225, 'planimetrie');
    R(X(139), 220, 'pagine elaborato planimetrico');
    for (const y of [225, 220]) for (const x of [70, 112, 183]) R(X(x), y, 'n. ');
    const tm = pratica.quadroA?.ditte[0]?.tipoMappale;
    if (tm) {
      stampa(X(37.5), 245, String(tm.numero), 7);
      stampa(X(52), 245, dataEstesa(tm.data.gg, tm.data.mm, tm.data.aaaa));
    }
    stampa(X(104), 245, v1('numero_ditta'));
    stampa(X(114), 245, v1('numero_totale_ditte'));
    stampa(X(188), 245, v1('derivate_ordinarie'));
    stampa(X(188), 240, v1('derivate_speciali'));
    stampa(X(188), 235, v1('uiu_costituite'));
    const qa = pratica.quadroA;
    const causale = qa?.causale === 'AFF'
      ? "unita' afferenti" + [qa.afferenti?.sopraelevazione ? ' edificate in sopraelevazione' : '', qa.afferenti?.areaCorte ? ' edificate su aree di corte' : '', qa.afferenti?.altro ? ' altro' : ''].filter(Boolean).join(',')
      : 'nuova costruzione';
    stampa(X(30), 240, ' ' + causale);
    if (pratica.dataVariazione.aaaa) stampa(X(30), 231, dataEstesa(pratica.dataVariazione.gg, pratica.dataVariazione.mm, pratica.dataVariazione.aaaa));
    stampa(X(75), 225, v1('n_mod_1n_i'));
    stampa(X(117), 225, v1('n_mod_2n_i'));
    stampa(X(188), 225, v1('n_planimetrie'));
    stampa(X(75), 220, v1('n_mod_1n_ii'));
    stampa(X(117), 220, v1('n_mod_2n_ii'));
    stampa(X(188), 220, v1('n_elaborati_planimetrici'));

    // ---------------------------------------------------------------- Quadro I (ditta da intestare)
    const ditta = qa?.ditte[0];
    let top = 213;
    p.linea(X1, mm(top), X2, mm(top), 1);
    B(X(10.5), top - 4, ' Quadro I | ');
    B(X(30), top - 4, 'Ditta da intestare:');
    if (ditta && ditta.intestazione !== 'nuova' && ditta.riferimento) {
      const r = ditta.riferimento;
      const etichetta = ditta.intestazione === 'ceu' ? ' Già in atti al C.E.U. con Idc' : ' Già in atti al C.T.   con Idc';
      R(X(65), top - 4, etichetta);
      stampa(X(115), top - 4, `Com: ${r.comune}  Sez: ${r.sezione ?? ''}  Fgl: ${r.foglio}  Pla: ${r.numero}  Sub: ${r.subalterno ?? ''}`);
      p.linea(X1, mm(top - 6), X2, mm(top - 6), 1);
      p.linea(X1, mm(top), X1, mm(top - 6), 1);
      p.linea(X2, mm(top), X2, mm(top - 6), 1);
      topU = top - 9;
    } else {
      p.linea(29.764, mm(top - 5), X2, mm(top - 5), 0);
      const intest: [number, string][] = [[10.5, 'Cognome o Denominazione'], [54.5, 'Nome'], [98, 'Comune di nascita o Sede Legale'], [136, 'Prov.'], [143, 'Data di nascita'], [162, 'Sesso'], [175, 'Codice Fiscale']];
      for (const [x, s] of intest) R(X(x), top - 9, s, 7);
      for (const [x, s] of [[12.5, 'N.'], [17, '|titolo'], [24, '| reg.'], [30.5, '| rif.'], [37, '| Titolo e Natura del possesso o godimento'], [180, '|     Quota']] as [number, string][]) R(X(x), top - 13, s, 7);
      p.linea(X1, mm(top - 14), X2, mm(top - 14), 1);
      let y = top - 19;
      const titoli = new Map(TITOLI.map((t) => [t.codice, t.descrizione]));
      (ditta?.intestati ?? []).forEach((it, i) => {
        if (it.tipo === 'fisica') {
          stampa(X(10.5), y, (it.cognome ?? '').toUpperCase(), 8);
          stampa(X(54.5), y, (it.nome ?? '').toUpperCase(), 8);
          stampa(X(98), y, (it.comune ?? '').toUpperCase(), 8);
          stampa(X(136), y, (it.provincia ?? '').toUpperCase(), 8);
          if (it.nascita) stampa(X(143), y, `${String(it.nascita.gg).padStart(2, '0')}/${String(it.nascita.mm).padStart(2, '0')}/${it.nascita.aaaa}`, 8);
          stampa(X(162), y, it.sesso ?? '', 8);
        } else {
          stampa(X(10.5), y, (it.denominazione ?? '').toUpperCase(), 8);
          stampa(X(98), y, (it.comune ?? '').toUpperCase(), 8);
          stampa(X(136), y, (it.provincia ?? '').toUpperCase(), 8);
        }
        stampa(X(175), y, (it.codiceFiscale ?? '').toUpperCase(), 7);
        y -= 4;
        stampa(X(12.5), y, aDestra(String(i + 1), 3), 8);
        stampa(X(17), y, it.titolo.trim(), 8);
        stampa(X(24), y, it.regime ?? '', 8);
        if (it.regime === 'C' && it.riferimento) stampa(X(30.5), y, String(it.riferimento), 8);
        stampa(X(37), y, [titoli.get(it.titolo) ?? '', it.specificazione ?? ''].filter(Boolean).join(' - ').toUpperCase(), 8);
        if (it.quotaNumeratore && it.quotaDenominatore) stampa(X(180), y, `${it.quotaNumeratore}/${it.quotaDenominatore}`, 8);
        y -= 2;
        if (i < (ditta?.intestati.length ?? 0) - 1) p.linea(X1, mm(y), X2, mm(y), 0);
        y -= 4;
      });
      const fine = y + 4;
      p.linea(X1, mm(top), X1, mm(fine), 1);
      p.linea(X2, mm(top), X2, mm(fine), 1);
      p.linea(X1, mm(fine), X2, mm(fine), 1);
      topU = fine - 3;
    }
    if (topU < 60) { p = nuovaPagina(); topU = 249; }
  } else {
  // ---------------------------------------------------------------- Quadro B
  riquadro(254, 249);
  riquadro(249, 219);
  riquadro(219, 204);
  riquadro(204, 189);
  B(29.764, 250, ' Quadro B | ');
  B(85.039, 250, "Dichiarazione di variazione presentata ai sensi dell'art. 20 del RDL 13 aprile 1939, n. 652");
  R(29.764, 245, ' Tipo Mappale n.');
  R(130.394, 245, 'del ');
  R(215.433, 245, "Unita'");
  R(255.118, 245, 'a destinazione ordinaria');
  R(368.504, 245, ' n.');
  R(413.858, 245, "Unita'");
  R(436.535, 245, ' in soppressione');
  R(510.236, 245, ' n.');
  R(255.118, 240, 'speciale e particolare');
  R(368.504, 240, ' n.');
  R(436.535, 240, ' in variazione');
  R(510.236, 240, ' n.');
  R(255.118, 235, 'beni comuni non censibili');
  R(368.504, 235, ' n.');
  R(436.535, 235, ' in costituzione');
  R(510.236, 235, ' n.');
  R(29.764, 230, ' Causali:');
  R(29.764, 220, ' Data in cui la variazione si è verificata (ultimazione dei lavori):');
  R(29.764, 215, ' Documenti allegati: ');
  R(113.386, 215, 'Mod. 1N parte I ');
  R(113.386, 210, 'Mod. 1N parte II ');
  R(255.118, 215, 'Mod. 2N parte I ');
  R(255.118, 210, 'Mod. 2N parte II ');
  R(413.858, 215, 'planimetrie');
  R(413.858, 210, 'pagine elaborato planimetrico');
  for (const y of [215, 210]) for (const x of [226.772, 368.504, 538.583]) R(x, y, 'n. ');
  R(29.764, 200, ' Preallineamento ');
  R(113.386, 200, 'Volture ');
  R(226.772, 200, 'n.');
  R(255.118, 200, 'Variazioni ');
  R(368.504, 200, 'n.');
  R(413.858, 200, 'Accatastamenti');
  R(538.583, 200, 'n.');
  R(113.386, 195, "Unita' afferenti con intestati");
  R(226.772, 195, 'n.');
  R(255.118, 195, "Unita' afferenti");
  R(368.504, 195, 'n. ');
  // valori del quadro B (dal record 1)
  stampa(396.85, 245, v1('derivate_ordinarie'));
  stampa(544.252, 245, v1('uiu_soppresse'));
  stampa(396.85, 240, v1('derivate_speciali'));
  stampa(544.252, 240, v1('uiu_variate'));
  stampa(396.85, 235, v1('derivate_bcnc'));
  stampa(544.252, 235, v1('uiu_costituite'));
  const causali = CAUSALI_STAMPA.filter(([c]) => pratica.tipiVariazione[c as keyof Pratica['tipiVariazione']]).map(([, d]) => d);
  const testoCausali = causali.length ? causali.join(', ') : pratica.causale === 'NC' ? 'accatastamento' : '';
  const righeCausali = aCapo(testoCausali, 110);
  stampa(85.039, 230, ' ' + (righeCausali[0] ?? ''));
  stampa(85.039, 225, ' ' + (righeCausali[1] ?? ''));
  stampa(269.291, 220, dataEstesa(pratica.dataVariazione.gg, pratica.dataVariazione.mm, pratica.dataVariazione.aaaa));
  stampa(235.276, 215, v1('n_mod_1n_i'));
  stampa(396.85, 215, v1('n_mod_2n_i'));
  stampa(544.252, 215, v1('n_planimetrie'));
  stampa(235.276, 210, v1('n_mod_1n_ii'));
  stampa(396.85, 210, v1('n_mod_2n_ii'));
  stampa(544.252, 210, v1('n_elaborati_planimetrici'));
  }

  // ---------------------------------------------------------------- Quadro U
  /** Disegna la testata del quadro U con il bordo superiore a `top` mm; restituisce l'ordinata della prima riga. */
  const testataU = (top: number): number => {
    p.linea(X1, mm(top), X2, mm(top), 1);
    p.linea(29.764, mm(top - 5), X2, mm(top - 5), 0);
    p.linea(X1, mm(top - 10), X2, mm(top - 10), 0);
    B(29.764, top - 4, ' Quadro U | ');
    B(85.039, top - 4, "Unita' Immobiliari");
    B(39.685, top - 9, '  Riferimenti Catastali');
    B(223.937, top - 9, "Utilita' Comuni Censibili");
    B(345.827, top - 9, 'Dati di Classamento Proposti');
    const intest: [number, string][] = [
      [29.764, ' N.'], [45.354, 'Part. spec.'], [87.874, 'Oper.'], [113.386, 'Sez.'], [133.228, 'Foglio'], [164.409, 'Particella'],
      [198.425, 'Sub.'], [223.937, 'Op.'], [240.945, 'Sez.'], [260.787, 'Foglio'], [291.969, 'Particella'], [325.984, 'Sub.'],
      [345.827, 'Z.C.'], [368.504, 'Cat.'], [391.181, 'Cl.'], [402.52, ' Cons.'], [425.197, 'Superf. cat.'], [476.22, 'Rendita €'],
      [510.236, ' 1N/2N'], [538.583, ' Plan.'],
    ];
    for (const [x, s] of intest) R(x, top - 14, s, 8);
    for (const [x, s] of [[45.354, 'Indirizzo'], [368.504, 'Piano'], [425.197, 'Scala'], [453.543, 'Interno'], [496.063, 'Lotto'], [538.583, 'Edificio']] as [number, string][])
      R(x, top - 18, s, 8);
    p.linea(X1, mm(top - 19), X2, mm(top - 19), 1);
    return top - 24;
  };
  /** Chiude il quadro U: bordi laterali da `top` a `bottom` e riga di chiusura. */
  const chiudiU = (top: number, bottom: number) => {
    p.linea(X1, mm(top), X1, mm(bottom), 1);
    p.linea(X2, mm(top), X2, mm(bottom), 1);
    p.linea(X1, mm(bottom), X2, mm(bottom), 1);
  };

  let y = testataU(topU);
  pratica.unita.forEach((u, idx) => {
    const conIndirizzo = !!u.indirizzo && u.operazione !== 'S';
    // ordinata della riga di separazione sotto l'unità: se scende sotto i 30 mm si passa alla pagina seguente
    if (y - 5 * u.graffati.length - (conIndirizzo ? 6 : 1) < 30) {
      // la riga di separazione dell'ultima unità diventa la chiusura del riquadro
      chiudiU(topU, y + 4);
      p = nuovaPagina();
      topU = 249;
      y = testataU(topU);
    }
    const idf = u.identificativo;
    stampa(29.764, y, n3(idx + 1));
    if (u.partitaSpeciale) stampa(45.354, y, u.partitaSpeciale === 'A' ? 'BCNC' : u.partitaSpeciale);
    stampa(90.709, y, u.recuperata ? 'R' : u.operazione);
    if (idf.sezione) stampa(113.386, y, idf.sezione);
    stampa(130.394, y, aDestra(idf.foglio, 4));
    stampa(150.236, y, aDestra(idf.numero, 10));
    if (idf.subalterno) stampa(195.591, y, aDestra(idf.subalterno, 4));
    const cl = u.classamento;
    if (cl && cl.categoria.trim() && cl.categoria.trim() !== '00') {
      stampa(348.661, y, cl.zonaCensuaria);
      const [cat, numCat] = categoriaStampa(cl.categoria);
      stampa(371.339, y, cat);
      stampa(377.008, y, numCat);
      if (u.destinazioneUsoDE) stampa(388.346, y, u.destinazioneUsoDE);
      else stampa(388.346, y, aDestra(cl.classe.trim().replace(/^0+(?=.)/, ''), 2));
      stampa(399.685, y, aDestra(cl.consistenza.trim(), 7));
      stampa(433.701, y, aDestra(intero(cl.superficieCatastale), 5));
      stampa(462.047, y, aDestra(decimali(Math.round(cl.rendita * 100), 2), 13));
    }
    if (u.mod1NParteII || u.mod2N || u.rifMod1NParteI) stampa(524.409, y, 'SI');
    if (u.planimetria) stampa(547.087, y, 'SI');
    for (const g of u.graffati) {
      y -= 5;
      if (g.sezione) stampa(113.386, y, g.sezione);
      stampa(130.394, y, aDestra(g.foglio, 4));
      stampa(150.236, y, aDestra(g.numero, 10));
      if (g.subalterno) stampa(195.591, y, aDestra(g.subalterno, 4));
    }
    if (conIndirizzo && u.indirizzo) {
      y -= 4;
      stampa(45.354, y, indirizzoStampa(u));
      stampa(379.843, y, pianiStampaIndirizzo(u));
      if (u.indirizzo.scala) stampa(428.031, y, u.indirizzo.scala);
      if (u.indirizzo.interno) stampa(456.378, y, u.indirizzo.interno);
      if (u.indirizzo.lotto) stampa(498.898, y, u.indirizzo.lotto);
      if (u.indirizzo.edificio) stampa(541.417, y, u.indirizzo.edificio);
      y -= 2;
    } else y -= 1;
    if (idx < pratica.unita.length - 1) p.linea(X1, mm(y), X2, mm(y), 0);
    y -= 4;
  });
  const fineU = y + 4;
  chiudiU(topU, fineU);

  // ---------------------------------------------------------------- Quadro D: beni comuni non censibili ed estremi (accatastamento)
  let topD = fineU - 3;
  if (acc && pratica.bcnc?.length) {
    const righe = pratica.bcnc;
    if (topD - 14 - 5 * righe.length < 30) { p = nuovaPagina(); topD = 249; }
    riquadro(topD, topD - 5);
    B(29.764, topD - 4, ' Quadro D | ');
    B(85.039, topD - 4, 'Beni Comuni non Censibili');
    const alto = topD - 5;
    for (const [x, s] of [[10.5, ' Sez.'], [20.5, 'Foglio'], [30.5, 'Particella'], [45.5, 'Sub.'], [55.5, 'Piano']] as [number, string][]) R(X(x), alto - 4, s, 8);
    p.linea(X1, mm(alto - 5), X2, mm(alto - 5), 0);
    let yb = alto - 9;
    for (const b of righe) {
      if (b.identificativo.sezione) stampa(X(11), yb, b.identificativo.sezione);
      stampa(X(20.5), yb, aDestra(b.identificativo.foglio, 4));
      stampa(X(30.5), yb, aDestra(b.identificativo.numero, 5));
      if (b.identificativo.subalterno) stampa(X(45.5), yb, aDestra(b.identificativo.subalterno, 4));
      stampa(X(55.5), yb, pianiStampa(b.piani));
      yb -= 5;
    }
    riquadro(alto, yb + 2);
    topD = yb - 1;
  }
  if (acc && pratica.estremi?.length) {
    const righe = pratica.estremi;
    if (topD - 20 - 5 * righe.length < 30) { p = nuovaPagina(); topD = 249; }
    riquadro(topD, topD - 5);
    B(29.764, topD - 4, ' Quadro D | ');
    B(85.039, topD - 4, "Estremi dei Titoli giustificativi dell'intestazione al catasto");
    const alto = topD - 5;
    for (const [x, s] of [[10.5, ' N.UIU'], [24.5, 'Causale'], [62, 'Efficace'], [75, 'Rep. o'], [87, 'Rogante o'], [117.5, 'Sede del Rogante o '], [170, 'Volume'], [185.5, 'Data di']] as [number, string][]) R(X(x), alto - 4, s, 8);
    for (const [x, s] of [[10.5, ' da:         a:'], [62, 'dal:'], [75, 'N. Reg.'], [87, 'de cuius:'], [117.5, 'Ufficio del Registro:'], [183, 'registrazione']] as [number, string][]) R(X(x), alto - 8, s, 8);
    p.linea(X1, mm(alto - 9), X2, mm(alto - 9), 0);
    let ye = alto - 13;
    const causali = new Map(CAUSALI_ATTO);
    const dataBreve = (d?: { gg: number; mm: number; aaaa: number }) => (d && d.aaaa ? `${String(d.gg).padStart(2, '0')}/${String(d.mm).padStart(2, '0')}/${d.aaaa}` : '');
    for (const e of righe) {
      stampa(X(13), ye, aDestra(String(e.uiuDa), 3), 8);
      stampa(X(19), ye, aDestra(String(e.uiuA), 3), 8);
      stampa(X(24.5), ye, (causali.get(e.causale) ?? e.causale).toUpperCase(), 8);
      stampa(X(62), ye, dataBreve(e.efficacia), 8);
      stampa(X(75), ye, e.repertorio, 8);
      stampa(X(87), ye, e.rogante.toUpperCase(), 8);
      stampa(X(117.5), ye, `${e.sede} ${e.provincia}`.trim().toUpperCase(), 8);
      stampa(X(170), ye, e.volume ?? '', 8);
      stampa(X(183), ye, dataBreve(e.dataRegistrazione), 8);
      ye -= 5;
    }
    riquadro(alto, ye + 2);
    topD = ye - 1;
  }

  // ---------------------------------------------------------------- Quadro D (note) e dichiarazioni
  if (topD - 109 < 20) {
    p = nuovaPagina();
    topD = 249;
  }
  riquadro(topD, topD - 5);
  riquadro(topD - 5, topD - 30);
  B(29.764, topD - 4, ' Quadro D | ');
  B(85.039, topD - 4, 'Note Relative al Documento e Relazione Tecnica');
  aCapo((pratica.annotazioni ?? '').toLowerCase().trim(), 100).slice(0, 4).forEach((riga, i) => stampa(34.016, topD - 9 - 5 * i, riga));
  const t2 = topD - 33;
  riquadro(t2, t2 - 45);
  R(45.354, t2 - 4, "- Dichiaro di non essere nella condizione di sospensione o revoca dell'esercizio della professione.", 8);
  R(45.354, t2 - 8, '- Dichiaro di effettuare la presentazione del presente atto su incarico di: ', 8);
  const d = pratica.dichiarante;
  stampa(102.047, t2 - 13, `${d.cognome} ${d.nome}`.trim().toUpperCase());
  R(45.354, t2 - 18, '  quale soggetto obbligato, residente in ', 8);
  const civico = /^\d+$/.test(d.civico.trim()) ? d.civico.trim().padStart(5, '0') : d.civico.trim();
  stampa(175.748, t2 - 18, `${d.comune.toUpperCase()} (${d.provincia.toUpperCase()}) - ${d.indirizzo.toUpperCase()} n. ${civico} c.a.p. ${d.cap}`);
  R(45.354, t2 - 26, '- Dichiaro che il presente modello unico informatico di aggiornamento degli atti catastali è conforme ai documenti cartacei in originale', 8);
  R(45.354, t2 - 29, '  sottoscritti da me medesimo e dal soggetto obbligato.', 8);
  R(45.354, t2 - 32, 'Il Tecnico:', 8);
  const t = pratica.tecnico;
  const a = albo(t.albo);
  stampa(102.047, t2 - 32, `${a.titolo} ${t.cognome.toUpperCase()} ${t.nome.toUpperCase()}`.trim());
  stampa(45.354, t2 - 37, rigaAlbo(t.albo, t.provinciaAlbo, t.numeroIscrizione));
  R(45.354, t2 - 42, 'Codice Fiscale:', 8);
  stampa(102.047, t2 - 42, t.codiceFiscale.toUpperCase());
  const t3 = t2 - 48;
  riquadro(t3, t3 - 25);
  for (const [x, s] of [[45.354, " Riservato all'Ufficio"], [228.189, 'Data __________'], [425.197, 'Protocollo ______________']] as [number, string][]) R(x, t3 - 4, s, 8);
  for (const [x, s] of [[45.354, ' Verifica eseguita in data'], [228.189, 'Eseguita la registrazione'], [425.197, 'Notifica eseguita in data']] as [number, string][]) R(x, t3 - 9, s, 8);
  for (const y2 of [t3 - 14, t3 - 19]) {
    R(45.354, y2, ' ___________________________', 8);
    R(228.189, y2, '___________________________', 8);
    R(425.197, y2, '___________________________', 8);
  }
  for (const [x, s] of [[73.701, " l'incaricato"], [256.535, "l'incaricato"], [453.543, "l'incaricato"]] as [number, string][]) R(x, t3 - 24, s, 8);
  return pagine;
}
