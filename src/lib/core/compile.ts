/**
 * Compilatore: dal modello della pratica ai file dell'Agenzia.
 *   - NCVnnn.DAT  record a 350 byte (documento attuale)
 *   - NMVnnn.DAT  dati metrici (313 byte)
 *   - NCVnnn.ATT  indice allegati
 *   - Nnnnnnnn.001 poligoni NTF (vedi ntf.ts)
 */
import { FixedRecord, FixedRecordLibero } from './tracciati/record';
import { ELENCO_SUBALTERNI, ELENCO_SUBALTERNI_LENGTH } from './tracciati/schema';
import type { Data, Identificativo, LocaleGruppoC, Pratica, UnitaImmobiliare } from './model';
import { schedeElaborato, schedePlanimetria } from './model';
import { CAUSALI_VARIAZIONE, normalizzaIndirizzo, allineaZona, allineaClasse, type CodiceVariazione } from './regole-docfa';
import { REC_H_GRUPPO_C_FIELDS, REC_H } from './tracciati/schema';

/** Record H "virtuale" con i campi del gruppo C, usato per scrivere la zona 106-246. */
function schemaGruppoC(): FixedRecord {
  const r = new FixedRecord('H');
  // sostituisce lo schema con quello del gruppo C (solo per i campi della zona ridefinita)
  (r as unknown as { schema: typeof REC_H }).schema = { ...REC_H, fields: [...REC_H.fields.filter((f) => f.start < 106 || f.start > 246), ...REC_H_GRUPPO_C_FIELDS] };
  (r as unknown as { byId: Map<string, unknown> }).byId = new Map((r as unknown as { schema: typeof REC_H }).schema.fields.map((f) => [f.id, f]));
  r.setRaw(106, ' '.repeat(141));
  return r;
}
import { encode1252, joinCRLF, concat, CR, LF, HIGH } from './bytes';
import { testoEsito as testoEsitoClassamento } from './classamento/nzct01';

function pad(n: number | string, len: number): string {
  return String(n).padStart(len, '0');
}

function setIdentificativo(rec: FixedRecord, prefix: string, id: Identificativo | undefined): void {
  rec.assign({
    [`${prefix}_sezione`]: id?.sezione ?? '',
    [`${prefix}_foglio`]: id ? pad(id.foglio, 4) : '',
    [`${prefix}_numero`]: id ? pad(id.numero, 5) : '',
    [`${prefix}_denominatore`]: id?.denominatore ? pad(id.denominatore, 4) : 0,
    [`${prefix}_subalterno`]: id?.subalterno ? pad(id.subalterno, 4) : '',
  });
}

function nomeFile(prefix: string, progressivo: number, ext: string): string {
  return `${prefix}${pad(progressivo, 3)}.${ext}`;
}

export interface Compilato {
  /** nome e contenuto dei file, nell'ordine in cui Docfa li inserisce nel PDF */
  ncv: { nome: string; dati: Uint8Array };
  att: { nome: string; dati: Uint8Array };
  nmv: { nome: string; dati: Uint8Array };
  /** elenco subalterni (solo con elaborato planimetrico) */
  epv?: { nome: string; dati: Uint8Array };
  records: FixedRecord[];
}

/** Prefisso dei file: NCA per l'accatastamento, NCV per la variazione (e NMA/NMV, EPA/EPV). */
export function letteraDocumento(p: Pratica): 'A' | 'V' {
  return p.tipoDocumento === 'accatastamento' ? 'A' : 'V';
}

/** Causale scritta nel record 1: NC/AFF per l'accatastamento, AFF per le afferenti, altrimenti la causale barrata (VAR se più d'una). */
export function causaleRecord(p: Pratica): string {
  if (p.tipoDocumento === 'accatastamento') return p.quadroA?.causale ?? 'NC';
  if (p.presentazione === 'afferenti') return 'AFF';
  const barrate = CAUSALI_VARIAZIONE.filter((c) => p.tipiVariazione[c as keyof typeof p.tipiVariazione]);
  if (barrate.length === 1) return barrate[0];
  if (barrate.length > 1) return 'VAR';
  return p.causale;
}

/** Causali di variazione barrate (quadro B). */
export function causaliBarrate(p: Pratica): CodiceVariazione[] {
  return CAUSALI_VARIAZIONE.filter((c) => p.tipiVariazione[c as keyof typeof p.tipiVariazione]);
}

const dataVuota: Data = { gg: 0, mm: 0, aaaa: 0 };

export function compilaDocumento(p: Pratica): Compilato {
  const prog = p.progressivo;
  const comune = p.comune.codiceAmministrativo;
  const recs: FixedRecord[] = [];
  const acc = p.tipoDocumento === 'accatastamento';
  const L = letteraDocumento(p);
  const conta = (op: 'C' | 'V' | 'S') => p.unita.filter((u) => u.operazione === op).length;
  const n1NII = p.unita.filter((u) => u.mod1NParteII).length;
  const ditte = acc ? (p.quadroA?.ditte.length ? p.quadroA.ditte : [undefined]) : [undefined];
  // modello D: 000 in variazione, numero della ditta in accatastamento (dedotto: 001, 002…)
  const modD = (k: number) => (acc ? k + 1 : 0);
  const unitaDitta = (k: number) => p.unita.map((u, i) => ({ u, i })).filter(({ u }) => !acc || (u.ditta ?? 0) === k || ditte.length === 1);

  // con più ditte i record della prima ditta precedono quelli di documento (chiave modello D 001), le altre seguono
  const altreDitte: FixedRecord[] = [];
  ditte.forEach((ditta, k) => {
    const md = modD(k);
    const bucket = k === 0 ? recs : altreDitte;
    const uiu = unitaDitta(k).map((x) => x.u);
    const nPlan = uiu.filter((u) => u.planimetria).length;
    const tm = acc ? ditta?.tipoMappale : p.tipoMappale;
    const aff = p.quadroA?.afferenti;
    const affV = p.afferentiVariazione;
    const rif = ditta?.riferimento;
    // --- tipo 1: testata (una per modello D)
    const r1 = new FixedRecord('1').key(prog, 'A', 1, 0, md);
    // in accatastamento è la data di ultimazione lavori del quadro A (vademecum 2.2.1.3)
    const data = p.dataVariazione ?? dataVuota;
    r1.assign({
      data_variazione_gg: pad(data.gg, 2),
      data_variazione_mm: pad(data.mm, 2),
      data_variazione_aaaa: pad(data.aaaa, 4),
      causale: causaleRecord(p),
      numero_mappale: tm?.numero || 0,
      data_mappale_gg: tm?.data.gg ?? 0, data_mappale_mm: tm?.data.mm ?? 0, data_mappale_aaaa: tm?.data.aaaa ?? 0,
      flag_documento_presentato: p.tipologia ?? 0,
      var_div: !!p.tipiVariazione.DIV, var_frz: !!p.tipiVariazione.FRZ, var_fus: !!p.tipiVariazione.FUS,
      var_amp: !!p.tipiVariazione.AMP, var_det: !!p.tipiVariazione.DET, var_dep: !!p.tipiVariazione.DEP,
      var_vsi: !!p.tipiVariazione.VSI, var_rst: !!p.tipiVariazione.RST, var_frf: !!p.tipiVariazione.FRF,
      var_vto: !!p.tipiVariazione.VTO, var_ufu: !!p.tipiVariazione.UFU, var_vde: !!p.tipiVariazione.VDE,
      var_var: !!p.tipiVariazione.VAR, var_vrp: !!p.tipiVariazione.VRP,
      var_nc: acc ? p.quadroA?.causale !== 'AFF' : !!p.tipiVariazione.NC,
      var_area_corte: acc ? !!aff?.areaCorte && p.quadroA?.causale === 'AFF' : p.presentazione === 'afferenti' ? !!affV?.areaUrbana : !!p.tipiVariazione.AREA_CORTE,
      var_afferenti: acc ? !!aff?.sopraelevazione && p.quadroA?.causale === 'AFF' : p.presentazione === 'afferenti' ? !!affV?.lastricoSolare : !!p.tipiVariazione.AFFERENTI,
      var_vmi: !!p.tipiVariazione.VMI,
      var_altre: acc ? !!aff?.altro && p.quadroA?.causale === 'AFF' : p.presentazione === 'afferenti' ? !!affV?.altro : !!p.tipiVariazione.ALTRE,
      var_rur: !!p.tipiVariazione.RUR,
      derivate_ordinarie: acc ? ditta?.unitaOrdinarie ?? 0 : p.derivate?.ordinarie ?? p.unita.filter((u) => u.operazione !== 'S' && !isSpeciale(u) && !u.partitaSpeciale).length,
      derivate_speciali: acc ? ditta?.unitaSpeciali ?? 0 : p.derivate?.speciali ?? p.unita.filter((u) => u.operazione !== 'S' && isSpeciale(u)).length,
      derivate_bcnc: acc ? 0 : p.derivate?.bcnc ?? p.unita.filter((u) => u.operazione !== 'S' && u.partitaSpeciale === 'A').length,
      uiu_soppresse: acc ? 0 : p.dichiarate?.soppresse ?? conta('S'),
      uiu_variate: acc ? 0 : p.dichiarate?.variate ?? conta('V'),
      uiu_costituite: acc ? (ditta?.unitaOrdinarie ?? 0) + (ditta?.unitaSpeciali ?? 0) : p.dichiarate?.costituite ?? conta('C'),
      numero_ditta: acc ? k + 1 : 0,
      numero_totale_ditte: acc ? ditte.length : 0,
      numero_intestati: acc && ditta?.intestazione === 'nuova' ? ditta.intestati.length : 0,
      n_mod_1n_i: p.mod1NParteI && k === 0 ? 1 : 0,
      n_mod_1n_ii: acc ? uiu.filter((u) => u.mod1NParteII).length : n1NII,
      n_mod_2n_i: uiu.filter((u) => u.mod2N).length,
      n_mod_2n_ii: uiu.reduce((n, u) => n + (u.mod2N?.corpi.length ?? 0), 0),
      n_planimetrie: nPlan,
      n_elaborati_planimetrici: p.elaboratoPlanimetrico && k === 0 ? Math.max(1, schedeElaborato(p.elaboratoPlanimetrico).filter((s) => s.progressivo === p.elaboratoPlanimetrico!.progressivoImmagine).length) : 0,
      variazione_da: p.tipiVariazione.VDE ? p.variazioneDa ?? '' : '',
      variazione_a: p.tipiVariazione.VDE ? p.variazioneA ?? '' : '',
      altre_variazioni: p.presentazione === 'afferenti' ? affV?.descrizione ?? '' : p.altreVariazioni ?? '',
      afferenti_sezione: aff && acc ? aff.identificativo.sezione ?? '' : '',
      afferenti_foglio: aff && acc && aff.identificativo.foglio ? pad(aff.identificativo.foglio, 4) : '',
      afferenti_numero: aff && acc && aff.identificativo.numero ? pad(aff.identificativo.numero, 5) : '',
      afferenti_denominatore: aff && acc && aff.identificativo.denominatore ? pad(aff.identificativo.denominatore, 4) : 0,
      flag_identificativo_riferimento: ditta?.intestazione === 'ct' ? 1 : ditta?.intestazione === 'ceu' ? 2 : 0,
      rif_comune: '', rif_sezione: '', rif_foglio: '', rif_numero: '', rif_denominatore: 0, rif_subalterno: '',
      n_documenti_ripresentati: 0,
      ep_sezione: p.elaboratoPlanimetrico?.identificativo.sezione ?? '',
      ep_foglio: p.elaboratoPlanimetrico ? pad(p.elaboratoPlanimetrico.identificativo.foglio, 4) : '',
      ep_numero: p.elaboratoPlanimetrico ? pad(p.elaboratoPlanimetrico.identificativo.numero, 5) : '',
      ep_denominatore: 0,
      n_immagine_elaborato_planimetrico: p.elaboratoPlanimetrico?.progressivoImmagine ?? 0,
      codice_comune: comune,
    });
    if (rif && ditta?.intestazione === 'ceu') {
      r1.assign({ rif_comune: rif.comune, rif_sezione: rif.sezione ?? '', rif_foglio: pad(rif.foglio, 4), rif_numero: pad(rif.numero, 5), rif_denominatore: rif.denominatore ? pad(rif.denominatore, 4) : 0, rif_subalterno: rif.subalterno ? pad(rif.subalterno, 4) : '' });
    } else if (rif && ditta?.intestazione === 'ct') {
      // identificativo terreni: comune (5) foglio (5) numero (5) denominatore (4) subalterno (4), poi 2 di filler
      r1.setRaw(250, rif.comune.padEnd(5, ' ').slice(0, 5) + pad(rif.foglio, 5) + pad(rif.numero, 5) + pad(rif.denominatore || 0, 4) + (rif.subalterno ?? '').padEnd(4, ' ').slice(0, 4) + '  ');
    } else if (acc) {
      // accatastamento con ditta nuova: Docfa usa la forma "terreni" vuota (denominatore a zero in 265-268)
      r1.setRaw(250, ' '.repeat(15) + '0000' + ' '.repeat(6));
    }
    bucket.push(r1);

    // --- tipo 2: intestati (solo ditta nuova)
    if (acc && ditta?.intestazione === 'nuova') {
      ditta.intestati.forEach((it, n) => {
        const r2 = new FixedRecord('2').key(prog, 'B', n + 1, 0, md);
        const fis = it.tipo === 'fisica';
        const [qi] = (it.quotaNumeratore ?? '').replace('.', ',').split(',');
        r2.assign({
          cognome_o_denominazione: fis ? (it.cognome ?? '').toUpperCase() : '',
          nome: fis ? (it.nome ?? '').toUpperCase() : '',
          comune_nascita: it.tipo === 'bcc' ? '' : (it.comune ?? '').toUpperCase(),
          provincia_nascita: it.tipo === 'bcc' ? '' : (it.provincia ?? '').toUpperCase(),
          nascita_gg: fis && it.nascita ? it.nascita.gg : 0,
          nascita_mm: fis && it.nascita ? it.nascita.mm : 0,
          nascita_aaaa: fis && it.nascita ? it.nascita.aaaa : 0,
          sesso: fis ? it.sesso ?? '' : '',
          codice_fiscale: (it.codiceFiscale ?? '').toUpperCase(),
          codice_regime: it.regime ?? '',
          n_intestato_riferimento: it.regime === 'C' ? it.riferimento ?? 0 : 0,
          specificazione_diritto: (it.specificazione ?? '').toUpperCase(),
          // quota: numeratore intero a 9 cifre, denominatore a 6 (come scrive Docfa: 1/1 = 000000001 000001)
          quota_numeratore: it.quotaNumeratore ? Number(qi || '0') : 0,
          quota_denominatore: it.quotaDenominatore ?? 0,
          nuovi_titoli: 'DN',
          codice_titolo: '',
          pec_intestato: it.pec ?? '',
          codice_comune: comune,
        });
        if (!fis) r2.setRaw(25, (it.denominazione ?? '').toUpperCase().padEnd(100, ' ').slice(0, 100));
        // il codice titolo ha anche lettere (01S, 08A): si scrive grezzo
        r2.setRaw(250, it.titolo.padEnd(3, ' ').slice(0, 3));
        bucket.push(r2);
      });
    }

    // --- tipo 3 / 4 / 5 / 6 per ogni u.i.u. della ditta
    for (const { u, i } of unitaDitta(k)) {
      const r3 = new FixedRecord('3').key(prog, 'C', i + 1, 0, md);
      r3.assign({ partita_speciale: acc ? '' : u.partitaSpeciale ?? '', operazione: u.operazione, codice_comune: comune });
      setIdentificativo(r3, 'uiu', u.identificativo);
      const ind = u.indirizzo;
      const det = !!p.tipiVariazione.DET && !acc;
      if (ind && u.operazione !== 'S') {
        r3.assign({
          indirizzo_flag: ind.codiceStrada ? '/' : '',
          indirizzo_codice: ind.codiceStrada ? p.comune.codice + pad(ind.codiceStrada, 7) : '',
          indirizzo_toponimo: ind.toponimo,
          civico_1: ind.civici[0] ? formatCivico(ind.civici[0]) : '',
          civico_2: ind.civici[1] ? formatCivico(ind.civici[1]) : '',
          civico_3: ind.civici[2] ? formatCivico(ind.civici[2]) : '',
          // per demolizione totale si indica solo l'indirizzo (E0398)
          piano_1: det ? '' : ind.piani[0] ?? '', piano_2: det ? '' : ind.piani[1] ?? '', piano_3: det ? '' : ind.piani[2] ?? '',
          scala: det ? '' : ind.scala ?? '', interno: det ? '' : ind.interno ?? '', lotto: det ? '' : ind.lotto ?? '', edificio: det ? '' : ind.edificio ?? '',
        });
      } else {
        r3.assign({ indirizzo_flag: '', indirizzo_codice: '', indirizzo_toponimo: '', civico_1: '', civico_2: '', civico_3: '', piano_1: '', piano_2: '', piano_3: '', scala: '', interno: '', lotto: '', edificio: '' });
      }
      const uc = u.utilitaComuni ?? [];
      r3.assign({ uc_operazione: uc[0]?.operazione ?? '' });
      setIdentificativo(r3, 'uc', uc[0]?.identificativo);
      const cl = u.classamento;
      r3.assign({
        rif_mod_1n_ii: u.rifMod1NParteI ?? (u.mod1NParteII || u.mod2N ? 1 : 0),
        zona_censuaria: allineaZona(cl?.zonaCensuaria),
        categoria: cl?.categoria ?? (u.operazione === 'S' ? ' 00' : ''),
        classe: allineaClasse(cl?.classe),
        consistenza: cl ? cl.consistenza.padStart(7, ' ') : '',
        superficie_catastale: cl ? Math.round(cl.superficieCatastale) : 0,
        rendita_centesimi: cl ? Math.round(cl.rendita * 100) : 0,
        identificativo_planimetria: u.planimetria ? u.planimetria.progressivo : 0,
        flag_uiu_recuperata: u.recuperata ? 1 : 0,
        destinazione_uso_de: u.destinazioneUsoDE ?? '',
        classamento_note: cl?.esitoAutomatico ? testoEsitoClassamento(cl.esitoAutomatico) : cl?.classamentoAutomatico ? testoEsitoClassamento('00') : '',
      });
      bucket.push(r3);
      for (let g = 0; g < u.graffati.length; g += 10) {
        const r4 = new FixedRecord('4').key(prog, 'C', i + 1, Math.floor(g / 10) + 1, md);
        r4.assign({ codice_comune: comune });
        for (let j = 0; j < 10; j++) setIdentificativo(r4, `id${j + 1}`, u.graffati[g + j]);
        bucket.push(r4);
      }
      // utilità comuni oltre la prima (record 5, trascinato 01000)
      if (uc.length > 1) {
        const r5 = new FixedRecord('5').key(prog, 'C', i + 1, 1000, md);
        r5.assign({ codice_comune: comune });
        for (let j = 0; j < 9; j++) {
          r5.set(`uc${j + 1}_operazione`, uc[j + 1]?.operazione ?? '');
          setIdentificativo(r5, `uc${j + 1}`, uc[j + 1]?.identificativo);
        }
        bucket.push(r5);
      }
      // indirizzi oltre il primo (record 6, trascinato 02000)
      const altri = (u.altriIndirizzi ?? []).filter((x) => x.toponimo.trim());
      if (altri.length && u.operazione !== 'S') {
        const r6 = new FixedRecord('6').key(prog, 'C', i + 1, 2000, md);
        r6.assign({ codice_comune: comune });
        altri.slice(0, 3).forEach((x, j) => {
          const n = j + 2;
          r6.assign({
            [`ind${n}_flag`]: x.codiceStrada ? '/' : '',
            [`ind${n}_codice`]: x.codiceStrada ? p.comune.codice + pad(x.codiceStrada, 7) : '',
            [`ind${n}_toponimo`]: x.toponimo,
            [`ind${n}_civico_1`]: x.civici[0] ? formatCivico(x.civici[0]) : '',
            [`ind${n}_civico_2`]: x.civici[1] ? formatCivico(x.civici[1]) : '',
            [`ind${n}_civico_3`]: x.civici[2] ? formatCivico(x.civici[2]) : '',
          });
        });
        bucket.push(r6);
      }
    }
  });

  const md0 = modD(0);

  // --- tipo 8: beni comuni non censibili (quadro D, solo accatastamento), 7 per record. In accatastamento i
  // record ci sono sempre, anche vuoti: senza, Docfa non apre il quadro D ("TREC NOT 8") e dà G0047.
  // Docfa scrive sempre tre record 8 (trascinato 0, 1, 2: fino a 21 beni), anche vuoti.
  const bcnc = acc ? p.bcnc ?? [] : [];
  for (let g = 0; g < (acc ? 21 : 0); g += 7) {
    const r8 = new FixedRecord('8').key(prog, 'H', 1, g / 7, md0);
    r8.assign({ codice_comune: comune });
    for (let j = 0; j < 7; j++) {
      const b = bcnc[g + j];
      setIdentificativo(r8, `bc${j + 1}`, b?.identificativo);
      r8.assign({ [`bc${j + 1}_piano_1`]: b?.piani[0] ?? '', [`bc${j + 1}_piano_2`]: b?.piani[1] ?? '', [`bc${j + 1}_piano_3`]: b?.piani[2] ?? '' });
    }
    recs.push(r8);
  }

  // --- tipo 9: annotazioni (una riga da 68 caratteri per record, sempre almeno una) ed estremi del titolo
  const note = (p.annotazioni ?? '').trimEnd();
  const righe = [note.slice(0, 68), ...spezza(note.slice(68), 317).filter(Boolean)];
  const estremi = acc ? (p.estremi ?? []).slice(0, 3) : [];
  righe.forEach((riga, i) => {
    const r9 = new FixedRecord('9').key(prog, 'L', 1, i, md0);
    r9.assign({
      annotazioni: '',
      atto1_uiu_da: '', atto1_uiu_a: '', atto1_rogante: '', atto1_sede: '', atto1_provincia: '', atto1_repertorio: '',
      atto1_causale: '', atto1_data: '', atto1_volume: '', atto1_data_registrazione: '', atto2: '', atto3: '',
      presenza_estremi: '',
      codice_comune: comune,
    });
    if (i === 0) {
      r9.set('annotazioni', riga);
      estremi.forEach((e, j) => r9.setRaw(86 + j * 59, bloccoAtto(e)));
      if (acc) r9.set('presenza_estremi', estremi.length ? '1' : '2');
    } else r9.setRaw(18, riga.padEnd(317, ' '));
    recs.push(r9);
  });

  // --- tipo A: dichiarante e tecnico
  const rA = new FixedRecord('A').key(prog, 'M', 1, 0, md0);
  rA.assign({
    dich_cognome: p.dichiarante.cognome.toUpperCase(), dich_nome: p.dichiarante.nome.toUpperCase(),
    dich_comune: p.dichiarante.comune.toUpperCase(), dich_provincia: p.dichiarante.provincia.toUpperCase(),
    dich_indirizzo: normalizzaIndirizzo(p.dichiarante.indirizzo), dich_civico: /^\d+$/.test(p.dichiarante.civico.trim()) ? pad(p.dichiarante.civico.trim(), 5) : p.dichiarante.civico.trim().toUpperCase(),
    dich_cap: p.dichiarante.cap,
    tec_cognome: p.tecnico.cognome.toUpperCase(), tec_nome: p.tecnico.nome.toUpperCase(),
    tec_codice_fiscale: p.tecnico.codiceFiscale.toUpperCase(),
    tec_albo: pad(p.tecnico.albo, 2), tec_numero_iscrizione: p.tecnico.numeroIscrizione,
    tec_provincia_albo: p.tecnico.provinciaAlbo.toUpperCase(),
    dich_pec: p.dichiarante.pec ?? '',
    flag_autocertificazione: 1,
    codice_comune: comune,
  });
  recs.push(rA);

  // --- tipo B e C: modello 1N parte I (campi generici per id di schema)
  if (p.mod1NParteI) {
    const rB = new FixedRecord('B').key(prog, 'N', 1, 0, md0);
    const rC = new FixedRecord('C').key(prog, 'P', 1, 0, md0);
    // anno di costruzione anteriore al 1942: Docfa scrive 1900 (W0816 altrimenti)
    const annoB = Number(p.mod1NParteI.recordB.anno_costruzione);
    const recordB = annoB > 0 && annoB < 1942 ? { ...p.mod1NParteI.recordB, anno_costruzione: 1900 } : p.mod1NParteI.recordB;
    riempiGenerico(rB, recordB, comune);
    // nei file di Docfa il flag "Ascensore" del fabbricato vale 1 quando il numero di ascensori è dichiarato,
    // anche se è 0 (NCV002, NCV059, NCV065): lo si imposta di conseguenza
    const nAsc = p.mod1NParteI.recordC.n_ascensori;
    const recordC = typeof nAsc === 'number' ? { ...p.mod1NParteI.recordC, imp_ascensore: 1 } : p.mod1NParteI.recordC;
    riempiGenerico(rC, recordC, comune);
    recs.push(rB, rC);
  }

  // --- tipo H / I / L: modello 1N parte II per ogni u.i.u.
  p.unita.forEach((u, idx) => {
    if (!u.mod1NParteII) return;
    const n2 = idx + 1;
    const m = u.mod1NParteII;
    const rH = new FixedRecord('H').key(prog, 'U', n2, 0, md0);
    const ids = [u.identificativo, ...u.graffati];
    for (let k = 0; k < 4; k++) setIdentificativo(rH, `id${k + 1}`, ids[k]);
    const categoria = u.classamento?.categoria ?? '';
    rH.assign({
      anno_costruzione: m.annoCostruzione ? (m.annoCostruzione < 1942 ? 1900 : m.annoCostruzione) : 0,
      anno_ristrutturazione: m.annoRistrutturazione ?? 0,
      categoria,
      dot_n_ascensori: m.nAscensori ?? 0, dot_altre: m.dotazioniAltre ?? '',
      pav_altro_descrizione: '',
      categoria_alfabetica: categoria.charAt(0),
      codice_comune: comune,
    });
    // layout gruppo A/B (zone 198-201 e 218-246 a spazi); il gruppo C lo sovrascrive parzialmente
    rH.assign({
      tipo_categoria: categoria.startsWith('B') ? 1 : 0,
      vani_principali_n: 0, vani_principali_sup: 0, acc_diretti_bagni_n: 0, acc_diretti_bagni_sup: 0,
      acc_diretti_altri_n: 0, acc_diretti_altri_sup: 0, sup_lorda_principali_accessori: 0, acc_indiretti_n: 0, acc_indiretti_sup: 0,
      dip_balconi_sup: 0, dip_terrazzo_coperto_sup: 0, pert_scoperte_sup: 0, pert_altra_descrizione: '', pert_altra_sup: 0, pert_sup_lorda: 0,
      posti_auto: 0, altezza_media_cm: 0, sup_altezza_inferiore_230: 0,
      b_piani_fuori_terra: m.bPianiFuoriTerra ?? 0, b_mc_fuori_terra: m.bMcFuoriTerra ?? 0,
      b_piani_entro_terra: m.bPianiEntroTerra ?? 0, b_mc_entro_terra: m.bMcEntroTerra ?? 0,
    });
    rH.setRaw(198, '    ').setRaw(218, ' '.repeat(29));
    if (m.gruppoC) {
      const c = m.gruppoC;
      const campiC = schemaGruppoC();
      const loc = (prefix: string, l: LocaleGruppoC | undefined) =>
        campiC.setRaw(campiC.field(`${prefix}_piano`).start, (l?.piano ?? '').padEnd(3, ' ').slice(0, 3) + pad(l ? Math.round(l.lorda) : 0, 5) + pad(l ? Math.round(l.utile) : 0, 5));
      loc('c_princ1', c.principali[0]); loc('c_princ2', c.principali[1]);
      loc('c_accd1', c.accessoriDiretti[0]); loc('c_accd2', c.accessoriDiretti[1]);
      loc('c_acci1', c.accessoriIndiretti[0]); loc('c_acci2', c.accessoriIndiretti[1]);
      campiC.set('c_dip_balconi', Math.round(c.balconiSup)).set('c_dip_coperte', Math.round(c.coperteSup))
        .set('c_pert_sup', Math.round(c.pertinenzeSup)).set('c_posti_auto', c.postiAuto)
        .set('c_accesso_carrabile', c.accessoCarrabile).set('c_altezza_media_cm', c.altezzaMediaCm)
        .set('c_sup_altezza_inferiore_230', Math.round(c.supAltezzaInferiore230)).set('c_posto_auto_scoperto', c.postoAutoScoperto);
      // zona 106-193: locali, balconi, coperte; 214-222: pertinenze e posti auto; 229, 231-238, 244: flag e altezze
      rH.setRaw(106, campiC.buf.subarray(105, 193));
      rH.setRaw(214, campiC.buf.subarray(213, 222));
      rH.setRaw(229, campiC.buf.subarray(228, 229));
      rH.setRaw(231, campiC.buf.subarray(230, 238));
      rH.setRaw(244, campiC.buf.subarray(243, 244));
    } else {
      rH.assign({
        vani_principali_n: m.vaniPrincipaliN, vani_principali_sup: m.vaniPrincipaliSup,
        acc_diretti_bagni_n: m.bagniN, acc_diretti_bagni_sup: m.bagniSup,
        acc_diretti_altri_n: m.accessoriDirettiN, acc_diretti_altri_sup: m.accessoriDirettiSup,
        sup_lorda_principali_accessori: m.superficieLorda,
        acc_indiretti_n: m.accessoriIndirettiN, acc_indiretti_sup: m.accessoriIndirettiSup,
        dip_balconi_sup: m.balconiSup, dip_terrazzo_coperto_sup: m.terrazziCopertiSup,
        pert_scoperte_sup: m.pertinenzeScoperteSup,
        pert_altra_descrizione: m.pertAltraDescrizione ?? '', pert_altra_sup: m.pertAltraSup ?? 0, pert_sup_lorda: m.pertSupLorda ?? 0,
        posti_auto: m.postiAuto ?? 0,
        altezza_media_cm: m.altezzaMediaCm,
        sup_altezza_inferiore_230: m.supAltezzaInferiore230,
      });
    }
    for (const k of ['riscaldamento', 'acqua_calda', 'condizionamento', 'citofono', 'videocitofono', 'ascensore_esclusivo', 'ascensore', 'ascensore_servizio', 'montacarichi'])
      rH.set(`dot_${k}`, !!m.dotazioni[k]);
    for (const g of ['camere', 'cucina', 'accessori'])
      for (const k of ['marmo', 'ceramica', 'scaglie', 'moquette', 'gomma', 'parquet', 'altro'])
        rH.set(`pav_${g}_${k}`, !!m.pavimenti[`${g}_${k}`]);
    recs.push(rH);

    const rI = new FixedRecord('I').key(prog, 'U', n2, 1, md0);
    rI.setRaw(18, ' '.repeat(27)); // nei file reali qui c'è memoria non inizializzata: scriviamo spazi
    rI.assign({
      infissi_altro_descrizione: '',
      destinazione_uso: m.destinazioneUso.toUpperCase(),
      categoria_appartenenza: categoria.charAt(0),
      codice_comune: comune,
    });
    for (const k of ['legno', 'tamburato', 'metallo', 'altro']) {
      rI.set(`porta_ingresso_${k}`, !!m.infissi[`ingresso_${k}`]);
      rI.set(`porte_interne_${k}`, !!m.infissi[`interne_${k}`]);
    }
    recs.push(rI);

    if (m.osservazioni?.trim()) {
      spezza(m.osservazioni.trim(), 300).slice(0, 2).forEach((riga, i) => {
        const rL = new FixedRecord('L').key(prog, 'U', n2, 2 + i, md0);
        rL.assign({ osservazioni: riga, codice_comune: comune });
        recs.push(rL);
      });
    }
  });

  // --- tipo M/N/O/P/Q/R: modello 2N per le u.i.u. a destinazione speciale
  p.unita.forEach((u, idx) => {
    const d = u.mod2N;
    if (!d) return;
    const n2 = idx + 1;
    const rM = new FixedRecord('M').key(prog, 'W', n2, 0, md0);
    riempiGenerico(rM, d.recordM, comune);
    recs.push(rM);
    const rN = new FixedRecord('N').key(prog, 'W', n2, 1, md0);
    riempiGenerico(rN, d.recordN, comune);
    recs.push(rN);
    for (let k = 0; k < 3; k++) {
      const rO = new FixedRecord('O').key(prog, 'W', n2, 2 + k, md0);
      riempiGenerico(rO, { ...(d.stimaComparativa[k] ?? {}), tipo_stima: 0 }, comune);
      recs.push(rO);
    }
    if (d.altroTipoStima?.length) {
      for (let k = 0; k < 3; k++) {
        const rO = new FixedRecord('O').key(prog, 'W', n2, 5 + k, md0);
        riempiGenerico(rO, { tipo_stima: 1 }, comune);
        rO.setRaw(19, (d.altroTipoStima[k] ?? '').padEnd(300, ' ').slice(0, 300));
        recs.push(rO);
      }
    }
    d.corpi.forEach((c, ci) => {
      const corpo = pad(ci + 1, 3);
      for (const [tipo, campi, tr] of [['P', c.recordP, '00'], ['Q', c.recordQ, '01'], ['R', c.recordR, '02']] as const) {
        const r = new FixedRecord(tipo).key(prog, 'W', n2, 0, md0);
        r.setRaw(12, corpo + tr);
        riempiGenerico(r, campi, comune);
        recs.push(r);
      }
    });
  });

  // Docfa scrive i record nell'ordine: 1, 3/4, 9, A, B, C, H, I (ordinamento per identificativo di record A,C,L,M,N,P,U)
  recs.push(...altreDitte);
  const ncv = joinCRLF(recs.map((r) => r.bytes()));
  return {
    ncv: { nome: nomeFile(`NC${L}`, prog, 'DAT'), dati: ncv },
    att: { nome: nomeFile(`NC${L}`, prog, 'ATT'), dati: compilaAtt(p) },
    nmv: { nome: nomeFile(`NM${L}`, prog, 'DAT'), dati: compilaDatiMetrici(p) },
    epv: p.elaboratoPlanimetrico ? { nome: nomeFile(`EP${L}`, prog, 'DAT'), dati: compilaElencoSubalterni(p) } : undefined,
    records: recs,
  };
}

/** Scrive tutti i campi dati (18-334) di un record da una mappa id → valore; i campi assenti vanno a zero/spazi. */
function riempiGenerico(rec: FixedRecord, campi: Record<string, boolean | number | string>, comune: string): void {
  for (const f of rec.schema.fields) {
    if (f.start < 18 || f.start >= 335) continue;
    const v = campi[f.id];
    rec.set(f.id, v === undefined ? (f.kind === 'N' ? 0 : '') : v);
  }
  rec.set('codice_comune', comune);
}

/**
 * Codice "tabella 6" scritto nei dati metrici (posizioni 18-19): gruppo e categoria del DPR 138/98
 * (allegato B) a cui appartiene la categoria catastale. R1, R2, T1 e P4 sono verificati sui file reali;
 * le altre corrispondenze seguono il quadro delle categorie del DPR 138/98.
 */
export function tipologiaMetrica(categoria: string): string {
  const c = categoria.toUpperCase().replace('/', '');
  const MAPPA: Record<string, string> = {
    A01: 'R1', A02: 'R1', A03: 'R1', A04: 'R1', A05: 'R1', A06: 'R1', A07: 'R2', A08: 'R2', A09: 'R2', A10: 'T7', A11: 'R3',
    B01: 'P1', B02: 'P2', B03: 'P3', B04: 'P4', B05: 'P4', B06: 'P5', B07: 'P5', B08: 'T2',
    C01: 'T1', C02: 'T2', C03: 'T2', C04: 'T3', C05: 'T3', C06: 'R4', C07: 'R4',
  };
  return MAPPA[c] ?? 'R1';
}

function isSpeciale(u: UnitaImmobiliare): boolean {
  const c = u.classamento?.categoria ?? '';
  return c.startsWith('D') || c.startsWith('E');
}

/** Estremi di un atto giustificativo nel record 9 (blocco da 59 byte, posizioni 86-144). */
function bloccoAtto(e: import('./model').EstremiAtto): string {
  const aammgg = (d?: Data) => (d && d.aaaa ? pad(d.aaaa % 100, 2) + pad(d.mm, 2) + pad(d.gg, 2) : '000000');
  return [
    pad(e.uiuDa, 3), pad(e.uiuA, 3),
    e.rogante.toUpperCase().padEnd(20, ' ').slice(0, 20),
    e.sede.toUpperCase().padEnd(4, ' ').slice(0, 4),
    e.provincia.toUpperCase().padEnd(2, ' ').slice(0, 2),
    e.repertorio.padEnd(6, ' ').slice(0, 6),
    e.causale.padEnd(3, ' ').slice(0, 3),
    aammgg(e.efficacia),
    (e.volume ?? '').padEnd(6, ' ').slice(0, 6),
    aammgg(e.dataRegistrazione),
  ].join('');
}

/** Il civico nei record è a 6 caratteri: numerico → zero-filled (000048), altrimenti com'è (3/A). */
export function formatCivico(c: string): string {
  const s = c.trim();
  return /^\d+$/.test(s) ? s.padStart(6, '0') : s;
}

function spezza(testo: string, len: number): string[] {
  if (!testo) return [''];
  const out: string[] = [];
  for (let i = 0; i < testo.length; i += len) out.push(testo.slice(i, i + len));
  return out;
}

/**
 * NCVnnn.ATT — indice degli allegati: un record di testata e uno per immagine.
 * Record immagine: progressivo immagine (7) + scheda (3) + formato (1: 4 = A4, 3 = A3) + scala (4) + 6×0xFF + "N" (poligoni presenti) + "0"
 * oppure 7×0xFF + "0" senza poligoni. L'ultimo record non ha il terminatore.
 */
export function compilaAtt(p: Pratica): Uint8Array {
  const parts: Uint8Array[] = [encode1252(`0000000100000000000000${p.elaboratoPlanimetrico ? '1' : ' '}`)];
  const riga = (progressivo: number, scheda: number, formato: 'A4' | 'A3', scala: number, poligoni: boolean) =>
    concat([
      encode1252(`${pad(progressivo, 7)}${pad(scheda, 3)}${formato === 'A3' ? '3' : '4'}${pad(scala, 4)}`),
      poligoni ? concat([new Uint8Array(6).fill(HIGH), encode1252('N0')]) : concat([new Uint8Array(7).fill(HIGH), encode1252('0')]),
    ]);
  const righe: { progressivo: number; scheda: number; formato: 'A4' | 'A3'; scala: number; poligoni: boolean }[] = [];
  for (const u of p.unita) {
    const pl = u.planimetria;
    if (!pl) continue;
    const schede = schedePlanimetria(pl);
    schede.forEach((s, i) => righe.push({ progressivo: pl.progressivo, scheda: i + 1, ...s }));
  }
  const ep = p.elaboratoPlanimetrico;
  if (ep) for (const s of schedeElaborato(ep)) righe.push({ ...s, poligoni: false });
  for (const o of p.allegatiOrfani ?? []) righe.push(o);
  righe.sort((a, b) => a.progressivo - b.progressivo || a.scheda - b.scheda);
  for (const r of righe) parts.push(riga(r.progressivo, r.scheda, r.formato, r.scala, r.poligoni));
  return concat(parts);
}

/**
 * NMVnnn.DAT — dati metrici: per ogni u.i.u. due record da 313 byte (il secondo di continuazione),
 * con 21 ambienti da 14 byte: tipo (1) + superficie (5) + altezza min (4) + altezza max (4).
 */
export function compilaDatiMetrici(p: Pratica): Uint8Array {
  const recs: Uint8Array[] = [];
  p.unita.forEach((u, i) => {
    if (!u.mod1NParteII) return;
    // modello D come nel record 3 dell'unità: 000 in variazione, numero della ditta in accatastamento
    const md = p.tipoDocumento === 'accatastamento' ? (p.quadroA?.ditte.length ?? 0) > 1 ? (u.ditta ?? 0) + 1 : 1 : 0;
    const key = `${pad(p.progressivo, 4)}${pad(md, 3)}C${pad(i + 1, 3)}`;
    // i poligoni G ("non rilevanti ai fini del calcolo della superficie catastale", vademecum Docfa) restano nella
    // planimetria (NTF) ma nei dati metrici dei gruppi R e P Docfa li rifiuta (M0710, verificato su un'A/3): si omettono
    const cat = u.classamento?.categoria ?? '';
    const amb = /^[AB]/.test(cat) ? u.ambienti.filter((a) => a.tipo !== 'G') : u.ambienti;
    for (let r = 0; r < 2; r++) {
      let s = key + pad(r, 5) + (r === 0 && u.spessoreMuri ? String(u.spessoreMuri) : '0') + (r === 0 ? (u.tipologiaMetrica ?? tipologiaMetrica(u.classamento?.categoria ?? '')) : '  ');
      for (let k = 0; k < 21; k++) {
        const a = r === 0 ? amb[k] : amb[21 + k];
        s += a ? a.tipo + pad(Math.round(a.superficie), 5) + pad(a.altezzaMin, 4) + pad(a.altezzaMax, 4) : ' 0000000000000';
      }
      recs.push(encode1252(s));
    }
  });
  return joinCRLF(recs);
}

/** EPVnnn.DAT — elenco subalterni dell'elaborato planimetrico: record da 500 byte + CRLF. */
export function compilaElencoSubalterni(p: Pratica): Uint8Array {
  const ep = p.elaboratoPlanimetrico;
  if (!ep) return new Uint8Array(0);
  const recs: Uint8Array[] = [];
  for (const sub of ep.subalterni) {
    const r = new FixedRecordLibero(ELENCO_SUBALTERNI, ELENCO_SUBALTERNI_LENGTH);
    r.assign({
      numero_ditta: 0,
      codice_comune: p.comune.codiceAmministrativo,
      uiu_sezione: sub.identificativo.sezione ?? '',
      uiu_foglio: pad(sub.identificativo.foglio, 4),
      uiu_numero: pad(sub.identificativo.numero, 5),
      uiu_denominatore: sub.identificativo.denominatore ? pad(sub.identificativo.denominatore, 4) : 0,
      uiu_subalterno: sub.identificativo.subalterno ? pad(sub.identificativo.subalterno, 4) : '',
      indirizzo: sub.indirizzo ?? '',
      civico: sub.civico ? formatCivico(sub.civico) : '',
      piano_1: sub.piani[0] ?? '', piano_2: sub.piani[1] ?? '', piano_3: sub.piani[2] ?? '',
      scala: sub.scala ?? '', interno: sub.interno ?? '',
      descrizione: sub.descrizione,
      numero_tipo_mappale: 0, data_tipo_mappale: 0,
      flag_inserimento: sub.flagInserimento,
      tipo: sub.tipo,
      categoria: sub.categoria ?? ' 00',
      entita_1: sub.entita[0] ?? '', entita_2: sub.entita[1] ?? '', entita_3: sub.entita[2] ?? '', entita_4: sub.entita[3] ?? '', entita_5: sub.entita[4] ?? '',
      versione_x: '', versione_f: 'F', versione: 'D3',
    });
    recs.push(r.bytes());
  }
  return joinCRLF(recs);
}
