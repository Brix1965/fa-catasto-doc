/**
 * Decompilatore: dai record Docfa (NCV/NMV/ATT) al modello della pratica.
 * Serve per importare documenti esistenti e per i test di round-trip.
 */
import { FixedRecord, FixedRecordLibero } from './tracciati/record';
import { ELENCO_SUBALTERNI, ELENCO_SUBALTERNI_LENGTH } from './tracciati/schema';
import type { Identificativo, Pratica, UnitaImmobiliare, Mod1NParteII, Mod1NParteI, Ambiente, LocaleGruppoC, ElencoSubalterno, Campi, Ditta, Intestato, EstremiAtto, Data } from './model';
import { splitCRLF, decode1252 } from './bytes';

function readIdentificativo(r: FixedRecord, prefix: string): Identificativo | undefined {
  const foglio = r.getTrimmed(`${prefix}_foglio`);
  const numero = r.getTrimmed(`${prefix}_numero`);
  if (!foglio && !numero) return undefined;
  const den = r.getTrimmed(`${prefix}_denominatore`);
  const sub = r.getTrimmed(`${prefix}_subalterno`);
  return {
    sezione: r.getTrimmed(`${prefix}_sezione`) || undefined,
    foglio: foglio.replace(/^0+(?=\d)/, ''),
    numero: numero.replace(/^0+(?=\d)/, ''),
    denominatore: den && den !== '0' ? den : undefined,
    subalterno: sub ? sub.replace(/^0+(?=\d)/, '') : undefined,
  };
}

function readIdentificativoCT(r: FixedRecord, prefix: string): Identificativo | undefined {
  const foglio = r.getTrimmed(`${prefix}_foglio`);
  const numero = r.getTrimmed(`${prefix}_numero`);
  if (!foglio && !numero) return undefined;
  return { sezione: r.getTrimmed(`${prefix}_sezione`) || undefined, foglio: foglio.replace(/^0+(?=\d)/, ''), numero: numero.replace(/^0+(?=\d)/, '') };
}

/** Legge tutti i campi dati (18-334) di un record in una mappa id → valore tipizzato. */
function leggiGenerico(r: FixedRecord): Campi {
  const out: Campi = {};
  for (const f of r.schema.fields) {
    if (f.start < 18 || f.start >= 335) continue;
    const v = r.get(f.id);
    if (f.kind === 'N') {
      if (!/^\d+$/.test(v)) { if (v.trim()) out[f.id] = v; continue; }
      out[f.id] = Number(v);
    } else if (v.trim()) out[f.id] = v.trimEnd();
  }
  return out;
}

const flagsFrom = (r: FixedRecord, prefix: string, keys: string[]): Record<string, boolean> =>
  Object.fromEntries(keys.map((k) => [k, r.get(`${prefix}${k}`) === '1']));

export interface Decompilato {
  pratica: Pratica;
  /** record non interpretati (tipo → numero) */
  nonInterpretati: string[];
}

export function decompilaDocumento(ncv: Uint8Array, nmv?: Uint8Array, att?: Uint8Array, epv?: Uint8Array): Decompilato {
  const lines = splitCRLF(ncv).filter((l) => l.length > 0);
  const recs = lines.map((l) => FixedRecord.parse(l));
  const nonInterpretati: string[] = [];
  const byType = (t: string) => recs.filter((r) => r.type === t).map((r) => r.record);

  const r1 = byType('1')[0];
  if (!r1) throw new Error('Manca il record di testata (tipo 1)');

  const unita: UnitaImmobiliare[] = [];
  for (const r3 of byType('3')) {
    const prog = Number(r3.get('progressivo'));
    const categoria = r3.getTrimmed('categoria');
    const rendita = Number(r3.get('rendita_centesimi')) / 100;
    const u: UnitaImmobiliare = {
      operazione: r3.get('operazione') as 'C' | 'V' | 'S',
      partitaSpeciale: r3.getTrimmed('partita_speciale') || undefined,
      destinazioneUsoDE: r3.getTrimmed('destinazione_uso_de') || undefined,
      identificativo: readIdentificativo(r3, 'uiu')!,
      graffati: [],
      ambienti: [],
    };
    const top = r3.getTrimmed('indirizzo_toponimo');
    if (top) {
      const codice = r3.get('indirizzo_codice');
      u.indirizzo = {
        codiceStrada: r3.get('indirizzo_flag') === '/' ? codice.slice(4).trim() : undefined,
        toponimo: top,
        civici: ['civico_1', 'civico_2', 'civico_3'].map((k) => r3.getTrimmed(k).replace(/^0+(?=\d)/, '')).filter(Boolean),
        piani: ['piano_1', 'piano_2', 'piano_3'].map((k) => r3.getTrimmed(k)).filter(Boolean),
        scala: r3.getTrimmed('scala') || undefined,
        interno: r3.getTrimmed('interno') || undefined,
        lotto: r3.getTrimmed('lotto') || undefined,
        edificio: r3.getTrimmed('edificio') || undefined,
      };
    }
    if (categoria && categoria !== '00') {
      u.classamento = {
        zonaCensuaria: r3.getTrimmed('zona_censuaria'),
        categoria,
        classe: r3.getTrimmed('classe'),
        consistenza: r3.get('consistenza').trim(),
        superficieCatastale: Number(r3.get('superficie_catastale')),
        rendita,
        classamentoAutomatico: r3.getTrimmed('classamento_note').includes('automatico'),
        esitoAutomatico: /^0[0-6] /.test(r3.getTrimmed('classamento_note')) ? r3.getTrimmed('classamento_note').slice(0, 2) : undefined,
      };
    }
    if (r3.get('flag_uiu_recuperata') === '1') u.recuperata = true;
    const modD = Number(r3.get('progressivo_modello_d'));
    if (modD > 1) u.ditta = modD - 1;
    // utilità comuni: la prima nel record 3, le altre nel record 5
    const uc0 = readIdentificativo(r3, 'uc');
    const uc: NonNullable<UnitaImmobiliare['utilitaComuni']> = [];
    if (uc0) uc.push({ operazione: (r3.get('uc_operazione') as 'I' | 'A') || 'I', identificativo: uc0 });
    for (const r5 of byType('5').filter((r) => Number(r.get('progressivo')) === prog && Number(r.get('progressivo_modello_d')) === modD))
      for (let j = 1; j <= 9; j++) {
        const id = readIdentificativo(r5, `uc${j}`);
        if (id) uc.push({ operazione: (r5.get(`uc${j}_operazione`) as 'I' | 'A') || 'I', identificativo: id });
      }
    if (uc.length) u.utilitaComuni = uc;
    const r6 = byType('6').find((r) => Number(r.get('progressivo')) === prog && Number(r.get('progressivo_modello_d')) === modD);
    if (r6) {
      u.altriIndirizzi = [2, 3, 4].map((n) => ({
        codiceStrada: r6.get(`ind${n}_flag`) === '/' ? r6.get(`ind${n}_codice`).slice(4).trim() : undefined,
        toponimo: r6.getTrimmed(`ind${n}_toponimo`),
        civici: [1, 2, 3].map((c) => r6.getTrimmed(`ind${n}_civico_${c}`).replace(/^0+(?=\d)/, '')).filter(Boolean),
      })).filter((x) => x.toponimo);
    }
    const plan = Number(r3.get('identificativo_planimetria'));
    if (plan) u.planimetria = { progressivo: plan, formato: 'A4', scala: 200, poligoni: [] };
    const rif = Number(r3.get('rif_mod_1n_ii'));
    if (rif) u.rifMod1NParteI = rif;
    // modello 2N
    const rM = byType('M').find((r) => Number(r.get('progressivo')) === prog);
    if (rM) {
      const rN = byType('N').find((r) => Number(r.get('progressivo')) === prog);
      const rOs = byType('O').filter((r) => Number(r.get('progressivo')) === prog);
      const comp = rOs.filter((r) => r.get('tipo_stima') === '0').map((r) => { const c = leggiGenerico(r); delete c.tipo_stima; return c; });
      const altro = rOs.filter((r) => r.get('tipo_stima') === '1').map((r) => decode1252(r.buf.subarray(18, 318)).trimEnd());
      const corpi: NonNullable<UnitaImmobiliare['mod2N']>['corpi'] = [];
      for (const rP of byType('P').filter((r) => Number(r.get('progressivo')) === prog)) {
        const corpo = decode1252(rP.buf.subarray(11, 14));
        const trova = (t: string) => byType(t).find((r) => Number(r.get('progressivo')) === prog && decode1252(r.buf.subarray(11, 14)) === corpo);
        const rQ = trova('Q'), rR = trova('R');
        corpi.push({ recordP: leggiGenerico(rP), recordQ: rQ ? leggiGenerico(rQ) : {}, recordR: rR ? leggiGenerico(rR) : {} });
      }
      u.mod2N = { recordM: leggiGenerico(rM), recordN: rN ? leggiGenerico(rN) : {}, stimaComparativa: comp, altroTipoStima: altro.some(Boolean) ? altro : undefined, corpi };
    }
    // identificativi secondari (tipo 4) della stessa u.i.u.
    for (const r4 of byType('4')) {
      if (Number(r4.get('progressivo')) !== prog) continue;
      for (let j = 1; j <= 10; j++) {
        const id = readIdentificativo(r4, `id${j}`);
        if (id) u.graffati.push(id);
      }
    }
    unita.push(u);
  }

  // 1N parte II
  const num = (r: FixedRecord, id: string) => { const n = Number(r.get(id)); return Number.isFinite(n) ? n : 0; };
  for (const rH of byType('H')) {
    const prog = num(rH, 'progressivo');
    const u = unita[prog - 1];
    if (!u) continue;
    const rI = byType('I').find((r) => Number(r.get('progressivo')) === prog);
    const rLs = byType('L').filter((r) => Number(r.get('progressivo')) === prog);
    const m: Mod1NParteII = {
      annoCostruzione: num(rH, 'anno_costruzione') || undefined,
      annoRistrutturazione: num(rH, 'anno_ristrutturazione') || undefined,
      vaniPrincipaliN: num(rH, 'vani_principali_n'),
      vaniPrincipaliSup: num(rH, 'vani_principali_sup'),
      bagniN: num(rH, 'acc_diretti_bagni_n'),
      bagniSup: num(rH, 'acc_diretti_bagni_sup'),
      accessoriDirettiN: num(rH, 'acc_diretti_altri_n'),
      accessoriDirettiSup: num(rH, 'acc_diretti_altri_sup'),
      superficieLorda: num(rH, 'sup_lorda_principali_accessori'),
      accessoriIndirettiN: num(rH, 'acc_indiretti_n'),
      accessoriIndirettiSup: num(rH, 'acc_indiretti_sup'),
      balconiSup: num(rH, 'dip_balconi_sup'),
      terrazziCopertiSup: num(rH, 'dip_terrazzo_coperto_sup'),
      pertinenzeScoperteSup: num(rH, 'pert_scoperte_sup'),
      pertAltraDescrizione: rH.getTrimmed('pert_altra_descrizione') || undefined,
      pertAltraSup: num(rH, 'pert_altra_sup') || undefined,
      pertSupLorda: num(rH, 'pert_sup_lorda') || undefined,
      postiAuto: num(rH, 'posti_auto') || undefined,
      bPianiFuoriTerra: num(rH, 'b_piani_fuori_terra') || undefined, bMcFuoriTerra: num(rH, 'b_mc_fuori_terra') || undefined,
      bPianiEntroTerra: num(rH, 'b_piani_entro_terra') || undefined, bMcEntroTerra: num(rH, 'b_mc_entro_terra') || undefined,
      altezzaMediaCm: num(rH, 'altezza_media_cm'),
      supAltezzaInferiore230: num(rH, 'sup_altezza_inferiore_230'),
      nAscensori: num(rH, 'dot_n_ascensori'),
      dotazioniAltre: rH.getTrimmed('dot_altre') || undefined,
      dotazioni: flagsFrom(rH, 'dot_', ['riscaldamento', 'acqua_calda', 'condizionamento', 'citofono', 'videocitofono', 'ascensore_esclusivo', 'ascensore', 'ascensore_servizio', 'montacarichi']),
      pavimenti: {},
      infissi: {},
      destinazioneUso: rI?.getTrimmed('destinazione_uso') ?? '',
      osservazioni: rLs.map((r) => r.getTrimmed('osservazioni')).join('') || undefined,
    };
    for (const g of ['camere', 'cucina', 'accessori'])
      for (const k of ['marmo', 'ceramica', 'scaglie', 'moquette', 'gomma', 'parquet', 'altro'])
        m.pavimenti[`${g}_${k}`] = rH.get(`pav_${g}_${k}`) === '1';
    if (rI)
      for (const k of ['legno', 'tamburato', 'metallo', 'altro']) {
        m.infissi[`ingresso_${k}`] = rI.get(`porta_ingresso_${k}`) === '1';
        m.infissi[`interne_${k}`] = rI.get(`porte_interne_${k}`) === '1';
      }
    const cat = u.classamento?.categoria ?? rH.getTrimmed('categoria');
    if (cat.startsWith('C')) {
      const raw = rH.buf.subarray(105, 246);
      const txt = decode1252(raw);
      const loc = (off: number): LocaleGruppoC | undefined => {
        const piano = txt.slice(off, off + 3).trimEnd();
        const lorda = Number(txt.slice(off + 3, off + 8)); const utile = Number(txt.slice(off + 8, off + 13));
        return piano || lorda || utile ? { piano, lorda, utile } : undefined;
      };
      const pick = (...xs: (LocaleGruppoC | undefined)[]) => xs.filter(Boolean) as LocaleGruppoC[];
      m.gruppoC = {
        principali: pick(loc(0), loc(13)),
        accessoriDiretti: pick(loc(26), loc(39)),
        accessoriIndiretti: pick(loc(52), loc(65)),
        balconiSup: Number(txt.slice(78, 83)), coperteSup: Number(txt.slice(83, 88)),
        pertinenzeSup: Number(txt.slice(108, 113)), postiAuto: Number(txt.slice(113, 117)),
        accessoCarrabile: txt.charAt(123) === '1', altezzaMediaCm: Number(txt.slice(125, 128)),
        supAltezzaInferiore230: Number(txt.slice(128, 133)), postoAutoScoperto: txt.charAt(138) === '1',
      };
    }
    u.mod1NParteII = m;
    if (!u.rifMod1NParteI) u.rifMod1NParteI = 1;
  }

  // dati metrici
  if (nmv) {
    const mlines = splitCRLF(nmv).filter((l) => l.length > 0);
    for (const l of mlines) {
      const s = decode1252(l);
      const prog = Number(s.slice(8, 11));
      const trasc = Number(s.slice(11, 16));
      const u = unita[prog - 1];
      if (!u) continue;
      if (trasc === 0) { u.tipologiaMetrica = s.slice(17, 19); if (s.charAt(16) === '1' || s.charAt(16) === '2') u.spessoreMuri = Number(s.charAt(16)) as 1 | 2; }
      for (let k = 0; k < 21; k++) {
        const a = s.slice(19 + k * 14, 33 + k * 14);
        const tipo = a.charAt(0);
        if (tipo === ' ') continue;
        const amb: Ambiente = { tipo: tipo as Ambiente['tipo'], superficie: Number(a.slice(1, 6)), altezzaMin: Number(a.slice(6, 10)), altezzaMax: Number(a.slice(10, 14)) };
        u.ambienti[trasc * 21 + k] = amb;
      }
      u.ambienti = u.ambienti.filter(Boolean);
    }
  }

  // formato e scala delle planimetrie dall'indice allegati
  const epSchede: NonNullable<NonNullable<Pratica['elaboratoPlanimetrico']>['schede']> = [];
  const orfani: NonNullable<Pratica['allegatiOrfani']> = [];
  if (att) {
    const s = decode1252(att);
    let pos = 23;
    while (pos + 23 <= s.length) {
      const chunk = s.slice(pos, pos + 23);
      pos += 23;
      const m = /^(\d{7})(\d{3})(\d)(\d{4})/.exec(chunk);
      if (!m) continue;
      const prog = Number(m[1]);
      const scheda = { formato: (m[3] === '3' ? 'A3' : 'A4') as 'A3' | 'A4', scala: Number(m[4]) as 100 | 200 | 500, poligoni: chunk.charAt(21) === 'N' };
      const u = unita.find((x) => x.planimetria?.progressivo === prog);
      if (u?.planimetria) {
        const pl = u.planimetria;
        if (Number(m[2]) === 1) { pl.formato = scheda.formato; pl.scala = scheda.scala; pl.schede = [scheda]; }
        else pl.schede = [...(pl.schede ?? []), scheda];
        if (scheda.poligoni && !pl.ntf) pl.ntf = new Uint8Array(0); // segnaposto: poligoni presenti
      } else if (!scheda.poligoni) epSchede.push({ progressivo: prog, scheda: Number(m[2]), formato: scheda.formato, scala: scheda.scala });
      else orfani.push({ progressivo: prog, scheda: Number(m[2]), ...scheda });
    }
    for (const u of unita) if (u.planimetria?.schede?.length === 1) delete u.planimetria.schede;
  }

  const rA = byType('A')[0];
  const rB = byType('B')[0];
  const rC = byType('C')[0];
  const r9s = byType('9');

  let mod1NParteI: Mod1NParteI | undefined;
  if (rB) mod1NParteI = { recordB: leggiGenerico(rB), recordC: rC ? leggiGenerico(rC) : {} };

  const tipi: Pratica['tipiVariazione'] = {};
  const flagMap: Record<string, keyof Pratica['tipiVariazione']> = {
    var_div: 'DIV', var_frz: 'FRZ', var_fus: 'FUS', var_amp: 'AMP', var_det: 'DET', var_dep: 'DEP', var_vsi: 'VSI', var_rst: 'RST',
    var_frf: 'FRF', var_vto: 'VTO', var_ufu: 'UFU', var_vde: 'VDE', var_var: 'VAR', var_vrp: 'VRP', var_nc: 'NC',
    var_area_corte: 'AREA_CORTE', var_afferenti: 'AFFERENTI', var_vmi: 'VMI', var_altre: 'ALTRE', var_rur: 'RUR',
  };
  for (const [f, k] of Object.entries(flagMap)) if (r1.get(f) === '1') tipi[k] = true;

  const accatastamento = Number(r1.get('numero_ditta')) > 0;
  const dataDa = (gg: string, mm: string, aaaa: string): Data => ({ gg: Number(r1.get(gg)), mm: Number(r1.get(mm)), aaaa: Number(r1.get(aaaa)) });
  const numeroMappale = Number(r1.get('numero_mappale'));
  const tipoMappaleDi = (r: FixedRecord) => (Number(r.get('numero_mappale')) ? { numero: Number(r.get('numero_mappale')), data: { gg: Number(r.get('data_mappale_gg')), mm: Number(r.get('data_mappale_mm')), aaaa: Number(r.get('data_mappale_aaaa')) } } : undefined);

  const pratica: Pratica = {
    tipoDocumento: accatastamento ? 'accatastamento' : 'variazione',
    tipologia: Number(r1.get('flag_documento_presentato')) || 0,
    progressivo: Number(r1.get('progressivo_variazione')),
    comune: { codice: '', codiceAmministrativo: r1.getTrimmed('codice_comune'), nome: '', provincia: '' },
    dataVariazione: { gg: Number(r1.get('data_variazione_gg')), mm: Number(r1.get('data_variazione_mm')), aaaa: Number(r1.get('data_variazione_aaaa')) },
    causale: r1.getTrimmed('causale') as Pratica['causale'],
    tipiVariazione: tipi,
    variazioneDa: r1.getTrimmed('variazione_da') || undefined,
    variazioneA: r1.getTrimmed('variazione_a') || undefined,
    altreVariazioni: r1.getTrimmed('altre_variazioni') || undefined,
    annotazioni: r9s.map((r, i) => (i === 0 ? r.get('annotazioni') : decode1252(r.buf.subarray(17, 334)))).join('').trimEnd() || undefined,
    derivate: { ordinarie: Number(r1.get('derivate_ordinarie')), speciali: Number(r1.get('derivate_speciali')), bcnc: Number(r1.get('derivate_bcnc')) },
    dichiarante: {
      cognome: rA?.getTrimmed('dich_cognome') ?? '', nome: rA?.getTrimmed('dich_nome') ?? '',
      comune: rA?.getTrimmed('dich_comune') ?? '', provincia: rA?.getTrimmed('dich_provincia') ?? '',
      indirizzo: rA?.getTrimmed('dich_indirizzo') ?? '', civico: rA?.getTrimmed('dich_civico') ?? '',
      cap: rA?.getTrimmed('dich_cap') ?? '', pec: rA?.getTrimmed('dich_pec') || undefined,
    },
    tecnico: {
      cognome: rA?.getTrimmed('tec_cognome') ?? '', nome: rA?.getTrimmed('tec_nome') ?? '',
      codiceFiscale: rA?.getTrimmed('tec_codice_fiscale') ?? '', albo: rA?.get('tec_albo') ?? '',
      numeroIscrizione: rA?.getTrimmed('tec_numero_iscrizione') ?? '', provinciaAlbo: rA?.getTrimmed('tec_provincia_albo') ?? '',
    },
    mod1NParteI,
    unita,
  };
  if (!accatastamento) {
    if (numeroMappale) pratica.tipoMappale = { numero: numeroMappale, data: dataDa('data_mappale_gg', 'data_mappale_mm', 'data_mappale_aaaa') };
    pratica.dichiarate = { soppresse: Number(r1.get('uiu_soppresse')), variate: Number(r1.get('uiu_variate')), costituite: Number(r1.get('uiu_costituite')) };
    if (pratica.causale === 'AFF') {
      pratica.presentazione = 'afferenti';
      pratica.afferentiVariazione = { areaUrbana: tipi.AREA_CORTE === true, lastricoSolare: tipi.AFFERENTI === true, altro: tipi.ALTRE === true, descrizione: pratica.altreVariazioni };
    } else pratica.presentazione = 'variazione';
  } else {
    // accatastamento: un record 1 per ditta (modello D), intestati nei record 2
    const ditte: Ditta[] = byType('1').map((r) => {
      const md = Number(r.get('progressivo_modello_d'));
      const flag = r.get('flag_identificativo_riferimento');
      const intestati: Intestato[] = byType('2').filter((x) => Number(x.get('progressivo_modello_d')) === md).map((x) => {
        const nome = x.getTrimmed('nome');
        const nascitaAaaa = Number(x.get('nascita_aaaa'));
        const qn = x.get('quota_numeratore');
        const fisica = !!nome || !!nascitaAaaa;
        const titolo = decode1252(x.buf.subarray(249, 252));
        const it: Intestato = {
          tipo: fisica ? 'fisica' : x.getTrimmed('codice_fiscale') || x.getTrimmed('comune_nascita') ? 'giuridica' : 'bcc',
          titolo,
          codiceFiscale: x.getTrimmed('codice_fiscale') || undefined,
          comune: x.getTrimmed('comune_nascita') || undefined,
          provincia: x.getTrimmed('provincia_nascita') || undefined,
          pec: x.getTrimmed('pec_intestato') || undefined,
          specificazione: x.getTrimmed('specificazione_diritto') || undefined,
          regime: (x.getTrimmed('codice_regime') || undefined) as Intestato['regime'],
          riferimento: Number(x.get('n_intestato_riferimento')) || undefined,
          quotaNumeratore: Number(qn) ? String(Number(qn)) : undefined,
          quotaDenominatore: Number(x.get('quota_denominatore')) || undefined,
        };
        if (fisica) {
          it.cognome = x.getTrimmed('cognome_o_denominazione');
          it.nome = nome;
          it.sesso = (x.getTrimmed('sesso') || undefined) as Intestato['sesso'];
          if (nascitaAaaa) it.nascita = { gg: Number(x.get('nascita_gg')), mm: Number(x.get('nascita_mm')), aaaa: nascitaAaaa };
        } else it.denominazione = decode1252(x.buf.subarray(24, 124)).trimEnd();
        return it;
      });
      const d: Ditta = {
        tipoMappale: tipoMappaleDi(r),
        intestazione: flag === '1' ? 'ct' : flag === '2' ? 'ceu' : 'nuova',
        intestati,
        unitaOrdinarie: Number(r.get('derivate_ordinarie')),
        unitaSpeciali: Number(r.get('derivate_speciali')),
      };
      if (flag === '2') d.riferimento = { comune: r.getTrimmed('rif_comune'), ...readIdentificativo(r, 'rif')! };
      if (flag === '1') {
        const t = decode1252(r.buf.subarray(249, 272));
        d.riferimento = { comune: t.slice(0, 5).trim(), foglio: t.slice(5, 10).replace(/^0+(?=\d)/, ''), numero: t.slice(10, 15).replace(/^0+(?=\d)/, ''), denominatore: Number(t.slice(15, 19)) ? t.slice(15, 19) : undefined, subalterno: t.slice(19, 23).trim() || undefined };
      }
      return d;
    });
    const aff = pratica.causale === 'AFF';
    pratica.quadroA = { ditte, causale: aff ? 'AFF' : 'NC' };
    if (aff) pratica.quadroA.afferenti = { identificativo: readIdentificativoCT(r1, 'afferenti') ?? { foglio: '', numero: '' }, sopraelevazione: tipi.AFFERENTI === true, areaCorte: tipi.AREA_CORTE === true, altro: tipi.ALTRE === true };
    // beni comuni non censibili (record 8)
    const bcnc: NonNullable<Pratica['bcnc']> = [];
    for (const r8 of byType('8'))
      for (let j = 1; j <= 7; j++) {
        const id = readIdentificativo(r8, `bc${j}`);
        if (id) bcnc.push({ identificativo: id, piani: [1, 2, 3].map((n) => r8.getTrimmed(`bc${j}_piano_${n}`)).filter(Boolean) });
      }
    if (bcnc.length) pratica.bcnc = bcnc;
    // estremi del titolo giustificativo (record 9, primo)
    const r9 = r9s[0];
    if (r9 && r9.get('presenza_estremi') === '1') {
      const estremi: EstremiAtto[] = [];
      for (let j = 0; j < 3; j++) {
        const t = decode1252(r9.buf.subarray(85 + j * 59, 144 + j * 59));
        if (!t.trim() || /^0+$/.test(t.slice(0, 6))) continue;
        const data = (x: string): Data => ({ aaaa: Number(x.slice(0, 2)) + (Number(x.slice(0, 2)) > 50 ? 1900 : 2000), mm: Number(x.slice(2, 4)), gg: Number(x.slice(4, 6)) });
        estremi.push({
          uiuDa: Number(t.slice(0, 3)), uiuA: Number(t.slice(3, 6)), rogante: t.slice(6, 26).trim(), sede: t.slice(26, 30).trim(), provincia: t.slice(30, 32).trim(),
          repertorio: t.slice(32, 38).trim(), causale: t.slice(38, 41).trim(), efficacia: data(t.slice(41, 47)), volume: t.slice(47, 53).trim() || undefined,
          dataRegistrazione: Number(t.slice(53, 59)) ? data(t.slice(53, 59)) : undefined,
        });
      }
      if (estremi.length) pratica.estremi = estremi;
    }
  }
  // codice catastale del comune: lo ricaviamo dal codice strada del primo indirizzo
  const r3c = byType('3').find((r) => r.get('indirizzo_flag') === '/');
  if (r3c) pratica.comune.codice = r3c.get('indirizzo_codice').slice(0, 4);
  if (rB) {
    const ct = [readIdentificativoCT(rB, 'ct')].filter(Boolean) as Identificativo[];
    const ct2 = rB.getTrimmed('ct_numero_2');
    if (ct2 && ct[0]) ct.push({ foglio: ct[0].foglio, numero: ct2.replace(/^0+(?=\d)/, '') });
    const ceu = [readIdentificativoCT(rB, 'ceu')].filter(Boolean) as Identificativo[];
    const ceu2 = rB.getTrimmed('ceu_numero_2');
    if (ceu2 && ceu[0]) ceu.push({ foglio: ceu[0].foglio, numero: ceu2.replace(/^0+(?=\d)/, '') });
    pratica.riferimentiFabbricato = { ct, ceu };
  }
  if (orfani.length) pratica.allegatiOrfani = orfani;
  const nEp = Number(r1.get('n_elaborati_planimetrici'));
  if (nEp || epv) {
    const subalterni: ElencoSubalterno[] = epv ? leggiElencoSubalterni(epv) : [];
    pratica.elaboratoPlanimetrico = {
      identificativo: { sezione: r1.getTrimmed('ep_sezione') || undefined, foglio: r1.getTrimmed('ep_foglio').replace(/^0+(?=\d)/, ''), numero: r1.getTrimmed('ep_numero').replace(/^0+(?=\d)/, '') },
      progressivoImmagine: Number(r1.get('n_immagine_elaborato_planimetrico')),
      schede: epSchede.length ? epSchede : undefined,
      subalterni,
    };
  }
  for (const r of recs) if (!['1', '2', '3', '4', '5', '6', '8', '9', 'A', 'B', 'C', 'H', 'I', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'].includes(r.type)) nonInterpretati.push(r.type);
  return { pratica, nonInterpretati };
}

/** EPVnnn.DAT (elenco subalterni) → righe dell'elenco. */
export function leggiElencoSubalterni(epv: Uint8Array): ElencoSubalterno[] {
  const out: ElencoSubalterno[] = [];
  for (const l of splitCRLF(epv).filter((x) => x.length)) {
    const r = new FixedRecordLibero(ELENCO_SUBALTERNI, ELENCO_SUBALTERNI_LENGTH, l);
    const id = readIdentificativo(r as unknown as FixedRecord, 'uiu')!;
    out.push({
      identificativo: id,
      indirizzo: r.getTrimmed('indirizzo') || undefined,
      civico: r.getTrimmed('civico').replace(/^0+(?=\d)/, '') || undefined,
      piani: ['piano_1', 'piano_2', 'piano_3'].map((k) => r.getTrimmed(k)).filter(Boolean),
      scala: r.getTrimmed('scala') || undefined,
      interno: r.getTrimmed('interno') || undefined,
      descrizione: r.getTrimmed('descrizione'),
      flagInserimento: Number(r.get('flag_inserimento')) as 0 | 1 | 2,
      tipo: r.get('tipo') as 'U' | 'B',
      categoria: r.get('categoria') === ' 00' ? undefined : r.getTrimmed('categoria'),
      entita: ['entita_1', 'entita_2', 'entita_3', 'entita_4', 'entita_5'].map((k) => r.getTrimmed(k)).filter(Boolean),
    });
  }
  return out;
}
