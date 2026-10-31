/**
 * Tracciati record del "documento attuale" Docfa 4 (versione "D3"), curati a mano
 * a partire dal documento ufficiale "DocumentiAttuali.rtf" (4.00.3) e verificati
 * byte per byte sui file prodotti da Docfa 4.00.5.
 *
 * Ogni record è lungo 350 byte (+ CRLF). Posizioni 1-based, estremi inclusi.
 *
 * Chiave comune (1-17):
 *   1-4  progressivo variazione (numero documento)
 *   5-7  progressivo modello D (000)
 *   8    identificativo di record (A,B,C,L,M,N,P,U,W)
 *   9-11 progressivo nell'ambito del tipo record
 *   12-16 progressivo di trascinato
 *   17   tipo-record
 * Coda comune (335-350):
 *   335-339 codice amministrativo del comune (es. I1AA = Firenze), 340-348 riservato, 349-350 "D3"
 */
import type { FieldDef, RecordSchema } from './types';

const N = (id: string, start: number, end: number, note?: string): FieldDef => ({ id, start, end, kind: 'N', note });
const AN = (id: string, start: number, end: number, note?: string): FieldDef => ({ id, start, end, kind: 'AN', note });

/** Campi della chiave, uguali per tutti i tipi. */
export const KEY_FIELDS: FieldDef[] = [
  N('progressivo_variazione', 1, 4),
  N('progressivo_modello_d', 5, 7),
  AN('identificativo_record', 8, 8),
  N('progressivo', 9, 11),
  N('trascinato', 12, 16),
  AN('tipo_record', 17, 17),
];

export const TAIL_FIELDS: FieldDef[] = [
  AN('codice_comune', 335, 339, 'codice amministrativo comune, da Comuni.dat (es. I1AA)'),
  AN('versione', 349, 350, 'D3'),
];

/** Identificativo catastale standard: sezione(3) foglio(4) numero(5) denominatore(4) subalterno(4) = 20 byte. */
export function identificativo(prefix: string, start: number): FieldDef[] {
  return [
    AN(`${prefix}_sezione`, start, start + 2),
    AN(`${prefix}_foglio`, start + 3, start + 6),
    AN(`${prefix}_numero`, start + 7, start + 11),
    N(`${prefix}_denominatore`, start + 12, start + 15),
    AN(`${prefix}_subalterno`, start + 16, start + 19),
  ];
}

const rec = (type: string, title: string, fields: FieldDef[]): RecordSchema => ({
  type,
  title,
  fields: [...KEY_FIELDS, ...fields, ...TAIL_FIELDS],
});

/** Record tipo 1 — testata del documento (identificativo "A"). */
export const REC_1 = rec('1', 'Testata', [
  N('data_variazione_gg', 18, 19),
  N('data_variazione_mm', 20, 21),
  N('data_variazione_aaaa', 22, 25),
  AN('causale', 26, 28, 'NC, AFF, DIV, FRZ, FUS, AMP, DET, DEP, VSI, RST, FRF, VTO, UFU, VDE, VAR, VRP, VMI'),
  N('numero_mappale', 29, 36),
  N('data_mappale_gg', 37, 38),
  N('data_mappale_mm', 39, 40),
  N('data_mappale_aaaa', 41, 44),
  N('flag_documento_presentato', 45, 45),
  // 46-56 filler
  N('var_div', 57, 57), N('var_frz', 58, 58), N('var_fus', 59, 59), N('var_amp', 60, 60),
  N('var_det', 61, 61), N('var_dep', 62, 62), N('var_vsi', 63, 63), N('var_rst', 64, 64),
  N('var_frf', 65, 65), N('var_vto', 66, 66), N('var_ufu', 67, 67), N('var_vde', 68, 68),
  N('var_var', 69, 69), N('var_vrp', 70, 70), N('var_nc', 71, 71), N('var_area_corte', 72, 72),
  N('var_afferenti', 73, 73), N('var_vmi', 74, 74), N('var_altre', 75, 75), N('var_rur', 76, 76),
  N('derivate_ordinarie', 77, 79),
  N('derivate_speciali', 80, 82),
  N('derivate_bcnc', 83, 85),
  N('uiu_soppresse', 86, 88),
  N('uiu_variate', 89, 91),
  N('uiu_costituite', 92, 94),
  N('numero_ditta', 95, 97),
  N('numero_totale_ditte', 98, 100),
  N('numero_intestati', 101, 103),
  N('n_mod_1n_i', 104, 107),
  N('n_mod_1n_ii', 108, 111),
  N('n_mod_2n_i', 112, 115),
  N('n_mod_2n_ii', 116, 119),
  N('n_planimetrie', 120, 123),
  N('n_elaborati_planimetrici', 124, 127),
  AN('variazione_da', 128, 162),
  AN('variazione_a', 163, 197),
  AN('altre_variazioni', 198, 232),
  AN('afferenti_sezione', 233, 235),
  AN('afferenti_foglio', 236, 239),
  AN('afferenti_numero', 240, 244),
  N('afferenti_denominatore', 245, 248),
  N('flag_identificativo_riferimento', 249, 249, '0 ditta nuova, 1 da C.Terreni, 2 da fabbricati'),
  AN('rif_comune', 250, 254),
  AN('rif_sezione', 255, 257),
  AN('rif_foglio', 258, 261),
  AN('rif_numero', 262, 266),
  N('rif_denominatore', 267, 270),
  AN('rif_subalterno', 271, 274),
  // 275-285 filler (contiene 0xFF in 277-283)
  // 250-272 ridefinito per una ditta già in atti al Catasto Terreni: comune (5) foglio (5) numero (5) denominatore (4) subalterno (4)
  N('n_documenti_ripresentati', 286, 288),
  AN('ep_sezione', 289, 291),
  AN('ep_foglio', 292, 295),
  AN('ep_numero', 296, 300),
  N('ep_denominatore', 301, 304),
  // 305-320 riservato
  N('n_immagine_elaborato_planimetrico', 321, 327),
]);

/** Record tipo 2 — intestati (identificativo "B"). */
export const REC_2 = rec('2', 'Intestati', [
  AN('cognome_o_denominazione', 25, 74),
  AN('nome', 75, 124),
  AN('comune_nascita', 125, 149),
  AN('provincia_nascita', 150, 151),
  N('nascita_gg', 152, 153),
  N('nascita_mm', 154, 155),
  N('nascita_aaaa', 156, 159),
  AN('sesso', 160, 160),
  AN('codice_fiscale', 161, 176),
  AN('codice_regime', 179, 179, 'C comunione, S separazione, P'),
  N('n_intestato_riferimento', 180, 182),
  AN('specificazione_diritto', 183, 232),
  N('quota_numeratore', 233, 241),
  N('quota_denominatore', 242, 247),
  AN('nuovi_titoli', 248, 249, 'DN'),
  N('codice_titolo', 250, 252),
  AN('pec_intestato', 254, 313),
]);

/** Record tipo 3 — unità immobiliare (identificativo "C"). */
export const REC_3 = rec('3', 'Unità immobiliare', [
  AN('partita_speciale', 18, 24),
  AN('operazione', 25, 25, 'C costituita, V variata, S soppressa'),
  ...identificativo('uiu', 26),
  AN('indirizzo_flag', 46, 46, '/ = da stradario 4.00.2+'),
  AN('indirizzo_codice', 47, 57, 'codice catastale comune (4) + progressivo strada (7)'),
  AN('indirizzo_toponimo', 58, 95),
  AN('civico_1', 96, 101),
  AN('civico_2', 102, 107),
  AN('civico_3', 108, 113),
  AN('piano_1', 114, 117),
  AN('piano_2', 118, 121),
  AN('piano_3', 122, 125),
  AN('scala', 126, 127),
  AN('interno', 128, 130),
  AN('lotto', 131, 132),
  AN('edificio', 133, 134),
  AN('uc_operazione', 135, 135),
  ...identificativo('uc', 136),
  N('rif_mod_1n_ii', 156, 159),
  AN('zona_censuaria', 160, 162),
  AN('categoria', 163, 165, 'es. A03'),
  AN('classe', 166, 167),
  AN('consistenza', 168, 174, 'allineata a destra, es. "    4,5"'),
  N('superficie_catastale', 175, 179),
  N('rendita_centesimi', 180, 189, 'euro × 100'),
  // 190-220 riservato (template: "    00         0000000000000000")
  N('identificativo_planimetria', 221, 227),
  N('flag_uiu_recuperata', 228, 228),
  AN('destinazione_uso_de', 230, 236),
  // 237-272 filler 0xFF
  AN('classamento_note', 273, 334, 'es. "00 Classamento automatico eseguito"'),
]);

/** Record tipo 4 — identificativi secondari (graffati) della u.i.u. (identificativo "C", trascinato 00001-00099). */
export const REC_4 = rec('4', 'Identificativi secondari', [
  ...Array.from({ length: 10 }, (_, i) => identificativo(`id${i + 1}`, 18 + i * 20)).flat(),
  // 228-334 filler 0xFF
]);

/** Record tipo 5 — utilità comuni (identificativo "C", trascinato 1). */
export const REC_5 = rec('5', 'Utilità comuni', [
  ...Array.from({ length: 9 }, (_, i) => [
    AN(`uc${i + 1}_operazione`, 18 + i * 21, 18 + i * 21, 'I inserimento, A annullamento'),
    ...identificativo(`uc${i + 1}`, 19 + i * 21),
  ]).flat(),
]);

/** Record tipo 6 — ulteriori indirizzi della u.i.u. (identificativo "C", trascinato 2xxxx), fino a 3. */
export const REC_6 = rec('6', 'Ulteriori indirizzi', [
  ...[18, 86, 154].flatMap((start, i) => [
    AN(`ind${i + 2}_flag`, start, start, '/ = da stradario'),
    AN(`ind${i + 2}_codice`, start + 1, start + 11),
    AN(`ind${i + 2}_toponimo`, start + 12, start + 49),
    AN(`ind${i + 2}_civico_1`, start + 50, start + 55),
    AN(`ind${i + 2}_civico_2`, start + 56, start + 61),
    AN(`ind${i + 2}_civico_3`, start + 62, start + 67),
  ]),
]);

/** Record tipo 8 — beni comuni non censibili del quadro D (identificativo "H"), 7 per record. */
export const REC_8 = rec('8', 'Beni comuni non censibili', [
  ...Array.from({ length: 7 }, (_, i) => {
    const b = 18 + i * 32;
    return [
      ...identificativo(`bc${i + 1}`, b),
      AN(`bc${i + 1}_piano_1`, b + 20, b + 23),
      AN(`bc${i + 1}_piano_2`, b + 24, b + 27),
      AN(`bc${i + 1}_piano_3`, b + 28, b + 31),
    ];
  }).flat(),
]);

/** Record tipo 9 — annotazioni e atti giustificativi (identificativo "L"). */
export const REC_9 = rec('9', 'Annotazioni', [
  AN('annotazioni', 18, 85),
  AN('atto1_uiu_da', 86, 88), AN('atto1_uiu_a', 89, 91), AN('atto1_rogante', 92, 111), AN('atto1_sede', 112, 115),
  AN('atto1_provincia', 116, 117), AN('atto1_repertorio', 118, 123), AN('atto1_causale', 124, 126),
  AN('atto1_data', 127, 132), AN('atto1_volume', 133, 138), AN('atto1_data_registrazione', 139, 144),
  AN('atto2', 145, 203),
  AN('atto3', 204, 262),
  AN('presenza_estremi', 269, 269, '1 presenti, 2 non presenti, vuoto'),
]);

/** Record tipo A — dati del dichiarante e del tecnico (identificativo "M"). */
export const REC_A = rec('A', 'Dichiarante', [
  AN('dich_cognome', 18, 41),
  AN('dich_nome', 42, 61),
  AN('dich_comune', 62, 86),
  AN('dich_provincia', 87, 88),
  AN('dich_indirizzo', 89, 123),
  AN('dich_civico', 124, 128),
  AN('dich_cap', 129, 133),
  AN('tec_cognome', 134, 157),
  AN('tec_nome', 158, 177),
  AN('tec_codice_fiscale', 178, 193),
  N('tec_albo', 194, 195, '03 = geometri'),
  AN('tec_numero_iscrizione', 196, 200, 'allineato a sinistra nei file reali'),
  AN('tec_provincia_albo', 201, 202),
  AN('dich_pec', 203, 262),
  // 263-327 filler 0xFF
  N('flag_autocertificazione', 328, 328),
]);

const flag = (id: string, pos: number) => N(id, pos, pos);

/** Record tipo B — modello 1N parte I, testata (identificativo "N"). */
export const REC_B = rec('B', '1N parte I - riferimenti e fabbricato', [
  AN('ct_sezione', 18, 20), AN('ct_foglio', 21, 24), AN('ct_numero', 25, 29), N('ct_denominatore', 30, 33),
  AN('ct_numero_2', 34, 38), N('ct_denominatore_2', 39, 42),
  AN('ceu_sezione', 43, 45), AN('ceu_foglio', 46, 49), AN('ceu_numero', 50, 54), N('ceu_denominatore', 55, 58),
  AN('ceu_numero_2', 59, 63), N('ceu_denominatore_2', 64, 67),
  N('anno_costruzione', 68, 71, 'se < 1942 si imposta 1900'),
  N('anno_ristrutturazione', 72, 75),
  N('posizione_fabbricato', 76, 76, '1 isolato, 2 contiguo, 3 a schiera'),
  N('complesso_immobiliare', 77, 77),
  N('numero_edifici', 78, 81),
  N('n_abitazioni', 82, 84), N('n_negozi', 85, 86), N('n_magazzini', 87, 89), N('n_laboratori', 90, 91),
  N('n_uffici', 92, 93), N('n_box', 94, 96), N('n_autorimesse', 97, 98), N('n_impianti_sportivi', 99, 100),
  N('n_uiu_cat_b', 101, 102),
  flag('cortile_interno', 103),
  N('n_scale', 104, 106),
  N('tipo_accesso', 107, 107, '1 unico esterno, 2 plurimo esterno, 3 dal cortile'),
  N('piani_fuori_terra', 108, 110), N('piani_fuori_terra_min', 111, 113), N('piani_fuori_terra_max', 114, 116),
  N('piani_entro_terra', 117, 119), N('piani_entro_terra_min', 120, 122), N('piani_entro_terra_max', 123, 125),
  N('densita_ft_int', 126, 127), N('densita_ft_dec', 128, 129), N('densita_et_int', 130, 131), N('densita_et_dec', 132, 133),
  N('corpi_1_ft', 134, 135), N('corpi_1_et', 136, 137), N('corpi_2_ft', 138, 139), N('corpi_2_et', 140, 141),
  N('corpi_3_ft', 142, 143), N('corpi_3_et', 144, 145), N('corpi_4_ft', 146, 147), N('corpi_4_et', 148, 149),
  flag('coperti_guardiola', 150), flag('coperti_alloggio_custode', 151), flag('coperti_sala_riunioni', 152),
  flag('coperti_atrio', 153), flag('coperti_porticato', 154), flag('coperti_lavatoio', 155), flag('coperti_piscina', 156),
  flag('coperti_altro', 157),
  N('sup_sala_riunioni', 158, 161), N('sup_atrio', 162, 164), N('sup_porticato', 165, 168), N('sup_lavatoio', 169, 172),
  N('sup_piscina_coperta', 173, 176), AN('coperti_altro_descrizione', 177, 186),
  flag('scoperti_terrazza', 187), flag('scoperti_cortile', 188), flag('scoperti_verde', 189), flag('scoperti_parcheggio', 190),
  flag('scoperti_tennis', 191), flag('scoperti_piscine', 192), flag('scoperti_altro', 193),
  N('sup_terrazza', 194, 197), N('sup_cortile', 198, 201), N('sup_verde', 202, 205), N('n_posti_auto', 206, 209),
  N('n_campi_tennis', 210, 213), N('sup_piscina_scoperta', 214, 217), AN('scoperti_altro_descrizione', 218, 227),
  // 4 facciate × 9 flag: strada>10, strada<=10, piazza, distacco abitazioni, distacco altro, verde pubblico, verde privato, altro, aderenza
  ...[1, 2, 3, 4].flatMap((f) =>
    ['strada_larga', 'strada_stretta', 'piazza', 'distacco_abitazioni', 'distacco_altro', 'verde_pubblico', 'verde_privato', 'altro', 'aderenza']
      .map((k, i) => flag(`facciata${f}_${k}`, 228 + (f - 1) * 9 + i)),
  ),
  AN('affaccio_altro_descrizione', 264, 281),
  // 282-334 filler (0xFF da 282)
]);

/** Record tipo C — modello 1N parte I, caratteristiche costruttive (identificativo "P"). */
export const REC_C = rec('C', '1N parte I - caratteristiche', [
  flag('strutture_muratura', 18), flag('strutture_ca', 19), flag('strutture_ferro', 20), flag('strutture_prefabbricate', 21),
  flag('strutture_altro', 22), AN('strutture_altro_descrizione', 23, 37),
  flag('copertura_terrazza_praticabile', 38), flag('copertura_terrazza_non_praticabile', 39), flag('copertura_tetto', 40),
  flag('tamponature_muratura', 41), flag('tamponature_intercapedine', 42), flag('tamponature_pannelli', 43),
  flag('tamponature_facciata_continua', 44), flag('tamponature_altro', 45), AN('tamponature_altro_descrizione', 46, 60),
  flag('imp_idrico', 61), flag('imp_elettrico', 62), flag('imp_gas', 63), flag('imp_telefonico', 64), flag('imp_fognario', 65),
  flag('imp_riscaldamento_centralizzato', 66), flag('imp_acqua_calda_centralizzata', 67), flag('imp_condizionamento_centralizzato', 68),
  flag('imp_citofonico', 69), flag('imp_videocitofonico', 70), flag('imp_antenna_tv', 71), flag('imp_ascensore', 72),
  flag('imp_montacarichi', 73), flag('imp_altro', 74), flag('imp_energie_alternative', 75),
  N('n_ascensori', 76, 77), AN('imp_altro_descrizione', 78, 92), AN('energie_alternative_descrizione', 93, 107),
  ...['tinteggiatura', 'resino_plastica', 'klinker', 'marmo', 'pannelli', 'legno', 'intonaco', 'altro'].map((k, i) => flag(`fin_principale_${k}`, 108 + i)),
  ...['tinteggiatura', 'resino_plastica', 'klinker', 'marmo', 'pannelli', 'legno', 'intonaco', 'altro'].map((k, i) => flag(`fin_altre_${k}`, 116 + i)),
  AN('fin_altro_descrizione', 124, 138),
  flag('portone_legno', 139), flag('portone_metallo', 140), flag('portone_altro', 141),
  flag('accessi_legno', 142), flag('accessi_metallo', 143), flag('accessi_altro', 144),
  AN('serramenti_altro_descrizione', 145, 159),
  AN('finiture_pregio', 160, 179),
  ...['marmo', 'ceramica', 'moquette', 'plastica', 'legno', 'altro'].map((k, i) => flag(`pav_atrio_${k}`, 180 + i)),
  ...['marmo', 'ceramica', 'moquette', 'plastica', 'legno', 'altro'].map((k, i) => flag(`pav_scale_${k}`, 186 + i)),
  AN('pav_altro_descrizione', 192, 206),
  ...['idropittura', 'resino_plastica', 'smalto', 'laminati', 'legno', 'marmo', 'altro'].map((k, i) => flag(`pareti_atrio_${k}`, 207 + i)),
  ...['idropittura', 'resino_plastica', 'smalto', 'laminati', 'legno', 'marmo', 'altro'].map((k, i) => flag(`pareti_scale_${k}`, 214 + i)),
  AN('pareti_altro_descrizione', 221, 235),
  flag('rec_muratura', 236), flag('rec_metalli', 237), flag('rec_maglie', 238), flag('rec_prefabbricati', 239), flag('rec_altro', 240),
  AN('rec_altro_descrizione', 241, 255),
  flag('vincolo_storico', 257),
  AN('vincolo_descrizione', 258, 272),
]);

/** Record tipo H — modello 1N parte II, u.i.u. gruppi A/B (identificativo "U"). Per il gruppo C i campi 106-246 sono ridefiniti (vedi REC_H_GRUPPO_C). */
export const REC_H = rec('H', '1N parte II - u.i.u.', [
  ...identificativo('id1', 18), ...identificativo('id2', 38), ...identificativo('id3', 58), ...identificativo('id4', 78),
  N('anno_costruzione', 98, 101),
  N('anno_ristrutturazione', 102, 105),
  N('tipo_categoria', 106, 106, '0 = gruppo A, 1 = gruppo B'),
  N('vani_principali_n', 107, 111), N('vani_principali_sup', 112, 116),
  N('acc_diretti_bagni_n', 117, 118), N('acc_diretti_bagni_sup', 119, 123),
  N('acc_diretti_altri_n', 124, 125), N('acc_diretti_altri_sup', 126, 130),
  N('sup_lorda_principali_accessori', 131, 135),
  N('acc_indiretti_n', 136, 139), N('acc_indiretti_sup', 140, 144),
  N('dip_balconi_sup', 145, 149),
  N('dip_terrazzo_coperto_sup', 150, 154),
  N('pert_scoperte_sup', 155, 159),
  AN('pert_altra_descrizione', 160, 174), N('pert_altra_sup', 175, 179),
  N('pert_sup_lorda', 180, 185),
  N('posti_auto', 186, 189),
  N('altezza_media_cm', 190, 192),
  N('sup_altezza_inferiore_230', 193, 197),
  N('b_piani_fuori_terra', 202, 203), N('b_mc_fuori_terra', 204, 209),
  N('b_piani_entro_terra', 210, 211), N('b_mc_entro_terra', 212, 217),
  AN('categoria', 247, 249),
  flag('dot_riscaldamento', 250), flag('dot_acqua_calda', 251), flag('dot_condizionamento', 252), flag('dot_citofono', 253),
  flag('dot_videocitofono', 254), flag('dot_ascensore_esclusivo', 255), flag('dot_ascensore', 256), flag('dot_ascensore_servizio', 257),
  flag('dot_montacarichi', 258), N('dot_n_ascensori', 259, 261), AN('dot_altre', 262, 276),
  ...['marmo', 'ceramica', 'scaglie', 'moquette', 'gomma', 'parquet', 'altro'].map((k, i) => flag(`pav_camere_${k}`, 296 + i)),
  ...['marmo', 'ceramica', 'scaglie', 'moquette', 'gomma', 'parquet', 'altro'].map((k, i) => flag(`pav_cucina_${k}`, 303 + i)),
  ...['marmo', 'ceramica', 'scaglie', 'moquette', 'gomma', 'parquet', 'altro'].map((k, i) => flag(`pav_accessori_${k}`, 310 + i)),
  AN('pav_altro_descrizione', 317, 331),
  AN('categoria_alfabetica', 332, 332),
]);

/** Ridefinizione dei campi 106-246 del record H per le u.i.u. del gruppo C. */
export const REC_H_GRUPPO_C_FIELDS: FieldDef[] = [
  AN('c_princ1_piano', 106, 108), N('c_princ1_lorda', 109, 113), N('c_princ1_utile', 114, 118),
  AN('c_princ2_piano', 119, 121), N('c_princ2_lorda', 122, 126), N('c_princ2_utile', 127, 131),
  AN('c_accd1_piano', 132, 134), N('c_accd1_lorda', 135, 139), N('c_accd1_utile', 140, 144),
  AN('c_accd2_piano', 145, 147), N('c_accd2_lorda', 148, 152), N('c_accd2_utile', 153, 157),
  AN('c_acci1_piano', 158, 160), N('c_acci1_lorda', 161, 165), N('c_acci1_utile', 166, 170),
  AN('c_acci2_piano', 171, 173), N('c_acci2_lorda', 174, 178), N('c_acci2_utile', 179, 183),
  N('c_dip_balconi', 184, 188), N('c_dip_coperte', 189, 193),
  N('c_pert_sup', 214, 218), N('c_posti_auto', 219, 222),
  flag('c_accesso_carrabile', 229),
  N('c_altezza_media_cm', 231, 233),
  N('c_sup_altezza_inferiore_230', 234, 238),
  flag('c_posto_auto_scoperto', 244),
];

/** Record tipo I — modello 1N parte II, infissi e destinazione (identificativo "U", trascinato 00001). */
export const REC_I = rec('I', '1N parte II - infissi e destinazione', [
  // 18-37: nei file reali contiene l'identificativo (graffato) della u.i.u., non filler
  ...identificativo('id', 18),
  flag('porta_ingresso_legno', 45), flag('porta_ingresso_tamburato', 46), flag('porta_ingresso_metallo', 47), flag('porta_ingresso_altro', 48),
  flag('porte_interne_legno', 49), flag('porte_interne_tamburato', 50), flag('porte_interne_metallo', 51), flag('porte_interne_altro', 52),
  AN('infissi_altro_descrizione', 53, 67),
  AN('destinazione_uso', 199, 248),
  AN('categoria_appartenenza', 260, 260, 'A, B o C'),
]);

/** Record tipo 9 di continuazione: le annotazioni oltre i primi 68 caratteri usano tutta l'area 18-262. */
export const REC_9_CONTINUAZIONE_FIELD: FieldDef = AN('annotazioni_continuazione', 18, 262);

/** Elenco subalterni / elaborato planimetrico (EPVnnn.DAT): record da 500 byte + CRLF. */
export const ELENCO_SUBALTERNI: FieldDef[] = [
  N('numero_ditta', 1, 3),
  AN('codice_comune', 4, 8),
  ...identificativo('uiu', 9),
  AN('indirizzo', 29, 78),
  AN('civico', 79, 84),
  AN('piano_1', 85, 88), AN('piano_2', 89, 92), AN('piano_3', 93, 96),
  AN('scala', 97, 98), AN('interno', 99, 101),
  AN('descrizione', 102, 401),
  N('numero_tipo_mappale', 402, 409), N('data_tipo_mappale', 410, 417),
  N('flag_inserimento', 418, 418, '0 letto dal documento, 1 inserito, 2 importato'),
  AN('tipo', 419, 419, 'U u.i.u., B b.c.n.c.'),
  AN('categoria', 420, 422, 'nei file reali: categoria o " 00"'),
  AN('entita_1', 423, 425), AN('entita_2', 426, 428), AN('entita_3', 429, 431), AN('entita_4', 432, 434), AN('entita_5', 435, 437),
  AN('versione_x', 438, 438), AN('versione_f', 439, 439, 'F'),
  AN('versione', 499, 500, 'D3'),
];
export const ELENCO_SUBALTERNI_LENGTH = 500;

/** Record tipo L — modello 1N parte II, osservazioni (identificativo "U", trascinato 00002-00003). */
export const REC_L = rec('L', '1N parte II - osservazioni', [AN('osservazioni', 18, 317)]);


/** Record tipo M — modello 2N parte I, testata (identificativo "W"). */
export const REC_M = rec('M', '2N parte I - riferimenti e azienda', [
  AN('ct_sezione', 18, 20), AN('ct_foglio', 21, 24), AN('ct_numero', 25, 29), N('ct_denominatore', 30, 33),
  AN('ct_numero_2', 34, 38), N('ct_denominatore_2', 39, 42),
  AN('ceu_sezione', 43, 45), AN('ceu_foglio', 46, 49), AN('ceu_numero', 50, 54), N('ceu_denominatore', 55, 58), AN('ceu_subalterno', 59, 62),
  N('anno_costruzione', 63, 66), N('anno_ristrutturazione', 67, 70),
  AN('descrizione_azienda', 71, 130),
  N('numero_fabbricati', 131, 132), N('numero_unita_ordinarie', 133, 135),
  flag('coll_ferroviario', 136), flag('coll_autostrada', 137), N('coll_distanza_autostrada', 138, 139), flag('coll_svincolo', 140),
  flag('coll_strade_principali', 141), N('coll_distanza_strade', 142, 143), flag('coll_scalo_marittimo', 144), flag('coll_scalo_aeroportuale', 145),
  AN('coll_altro', 146, 185),
  flag('imp_pesa_ponte', 186), N('imp_pesa_carico', 187, 189), flag('imp_depurazione', 190), flag('imp_depurazione_azienda', 191),
  flag('imp_depurazione_consortile', 192), flag('imp_abbattimento_fumi', 193), flag('imp_antincendio', 194), flag('imp_uscite_sicurezza', 195),
  flag('imp_scale_emergenza', 196), flag('imp_antintrusione', 197), AN('imp_antintrusione_descrizione', 198, 212),
  // nei file reali: descrizione "altro impianto" 213-251 e flag "altro" a 252 (il tracciato dà 213-252 come testo)
  AN('imp_altro_descrizione', 213, 251), flag('imp_altro_flag', 252),
  AN('pav_piazzali', 253, 292), AN('pav_parcheggi', 293, 331),
  AN('categoria_alfabetica', 332, 332),
]);

/** Record tipo N — modello 2N parte I, sistemazioni esterne e dati metrici (identificativo "W", trascinato 00001). */
export const REC_N = rec('N', '2N parte I - dati metrici', [
  AN('spazi_verde', 18, 57), N('recinzioni_h_cm', 58, 61), AN('recinzioni_materiale', 62, 121),
  AN('accesso_custodito', 122, 161), AN('altro', 162, 201),
  N('area_totale_lorda', 202, 207), N('area_coperta', 208, 213), N('tettoie', 214, 219), N('depositi_vasche', 220, 225),
  N('passaggi_piazzali', 226, 231), N('parcheggi_mq', 232, 237), N('parcheggi_posti', 238, 240), N('spazi_verde_mq', 241, 246),
  N('volume_totale', 247, 252),
  N('anno_epoca_censuaria', 253, 256),
  // importi: nei file reali (euro) sono a 13 cifre in centesimi; il tracciato 4.00.3 descrive ancora il formato in lire a 9 cifre
  N('valore_stima_comparativa', 257, 269, 'centesimi di euro'),
  N('valore_stima_sommaria', 270, 282, 'centesimi di euro'), N('valutazione_attribuita', 283, 295, 'centesimi di euro'),
  N('saggio_intero', 296, 296), N('saggio_decimale', 297, 300),
  N('rendita_catastale', 301, 313, 'centesimi di euro'), N('rendita_catastale_tonda', 314, 326, 'centesimi di euro'),
]);

/** Record tipo O — modello 2N parte I, stima (identificativo "W", trascinato 00002-00007). */
export const REC_O = rec('O', '2N parte I - stima', [
  N('tipo_stima', 18, 18, '0 comparativa, 1 altro tipo'),
  // nei file reali ogni blocco è di 52 byte (destinazione a 20 caratteri + 1 byte "0" finale), non 50 come nel tracciato
  ...Array.from({ length: 6 }, (_, i) => {
    const b = 19 + i * 52;
    return [AN(`stima${i + 1}_corpo`, b, b + 2), AN(`stima${i + 1}_tipologia`, b + 3, b + 10), AN(`stima${i + 1}_destinazione`, b + 11, b + 30),
      // importi in euro: valore unitario 7 cifre in centesimi, valore complessivo 8 cifre in centesimi
      N(`stima${i + 1}_consistenza`, b + 31, b + 36), N(`stima${i + 1}_valore_unitario`, b + 37, b + 43, 'centesimi di euro'), N(`stima${i + 1}_valore`, b + 44, b + 51, 'centesimi di euro')];
  }).flat(),
]);
/** Ridefinizione del record O per "altro tipo di stima" (testo libero 19-318). */
export const REC_O_ALTRO_FIELDS: FieldDef[] = [AN('altro_tipo_stima', 19, 318)];

/** Record tipo P — modello 2N parte II, corpo di fabbrica (identificativo "W"; 12-14 progressivo immobile, 15-16 trascinato). */
export const REC_P = rec('P', '2N parte II - corpo di fabbrica', [
  AN('riferimento_planimetria_generale', 18, 22), AN('numero_planimetria', 23, 37),
  ...identificativo('id1', 38), ...identificativo('id2', 58),
  AN('destinazione_principale', 78, 107),
  N('anno_costruzione', 108, 111), N('anno_ristrutturazione', 112, 115),
  flag('str_muratura', 116), flag('str_ca', 117), flag('str_ferro', 118), flag('str_prefabbricati_leggeri', 119), flag('str_prefabbricati_pesanti', 120),
  AN('str_altro', 121, 140),
  flag('cop_tetto', 141), flag('cop_piana', 142), flag('cop_shed', 143), flag('cop_volta', 144), flag('cop_ferro', 145), flag('cop_ca', 146),
  flag('cop_mista_laterizi', 147), flag('cop_legno', 148), AN('cop_altro', 149, 178),
  AN('solai', 179, 198), AN('tamponature', 199, 218), AN('finestre_porte', 219, 238), AN('pavimentazione', 239, 258),
  AN('rifinitura_esterna', 259, 278), AN('servizi_igienici', 279, 298),
  N('sup_ricovero_operai', 299, 302), N('sup_pronto_soccorso', 303, 306), N('sup_direzione_tecnica', 307, 310), N('sup_direzione_amministrativa', 311, 314),
  N('sup_mensa', 315, 318), N('sup_locali_ritrovo', 319, 322), N('sup_custodia', 323, 326), N('sup_altro', 327, 330),
]);

/** Record tipo Q — modello 2N parte II, dati metrici del corpo (identificativo "W"). */
export const REC_Q = rec('Q', '2N parte II - dati metrici', [
  N('piani_fuori_terra', 18, 20), N('piani_entro_terra', 21, 22), N('superficie_coperta', 23, 28), N('superficie_sviluppata', 29, 34),
  N('volume_totale', 35, 41), AN('notizie_particolari', 42, 291),
]);

/** Record tipo R — modello 2N parte II, impianti stabilmente infissi (identificativo "W"). */
export const REC_R = rec('R', '2N parte II - impianti', [AN('impianti_infissi', 18, 317)]);

export const SCHEMAS: Record<string, RecordSchema> = Object.fromEntries(
  [REC_1, REC_2, REC_3, REC_4, REC_5, REC_6, REC_8, REC_9, REC_A, REC_B, REC_C, REC_H, REC_I, REC_L, REC_M, REC_N, REC_O, REC_P, REC_Q, REC_R].map((s) => [s.type, s]),
);

export const RECORD_LENGTH = 350;
export const VERSIONE = 'D3';
