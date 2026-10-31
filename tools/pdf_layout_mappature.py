# -*- coding: utf-8 -*-
"""
Mappatura campo → posizione per le pagine dei modelli 1N e 2N (eseguito da pdf_layout_extract.py).

Convenzioni (vedi src/lib/core/pdf/layout.ts per l'interpretazione):
  T(id, x, y, len, rec=..., fmt=...)   testo: il valore del campo `id` del record `rec` stampato in grassetto 9 pt.
       len  = larghezza in caratteri su cui il numero è allineato a destra (come fa Docfa: spazi + cifre senza zeri)
       fmt  = 'int' (default per i numerici: zero → vuoto) | 'an' (alfanumerico, allineato a sinistra)
              | 'id' (identificativo catastale alfanumerico: zeri iniziali tolti, allineato a destra)
              | 'migliaia' (1.234) | 'dec1' (÷10, una cifra decimale) | 'dec2' (÷100, due decimali)
              | 'cent1' (centesimi mostrati con una cifra decimale) | 'saggio' (intero,decimali)
       gruppo = 'AB' | 'C': solo per le u.i.u. dei gruppi A/B oppure del gruppo C (modello 1N parte II)
       righe = numero massimo di righe, passo = interlinea, larghezza = caratteri per riga (testo a capo per parole)
  F(id, casella, rec=..., uguale=n | positivo=True | nonVuoto=True)   "X" nella casella n-esima (ordine di lettura)
       senza opzioni la X compare quando il campo numerico vale 1.
  anno: T(..., fmt='anno', xAntec=...)   anno di costruzione: "antec. 1942" (a xAntec) se vale 1900, altrimenti l'anno.
Le posizioni osservate nei PDF reali sono esatte; quelle contrassegnate "stimata" derivano dall'inizio dei trattini.
"""

MAPPATURE['1N-I-1'] = [
    # A | riferimenti catastali del fabbricato (record B)
    T('ct_sezione', 85.0, 694.488, 3, rec='B', fmt='an'),  # stimata
    T('ct_foglio', 133.228, 694.488, 4, rec='B', fmt='id'),
    T('ct_numero', 181.417, 694.488, 10, rec='B', fmt='id'),
    T('ct_numero_2', 240.945, 694.488, 10, rec='B', fmt='id'),
    T('ceu_sezione', 85.0, 680.315, 3, rec='B', fmt='an'),  # stimata
    T('ceu_foglio', 133.228, 680.315, 4, rec='B', fmt='id'),
    T('ceu_numero', 181.417, 680.315, 10, rec='B', fmt='id'),
    T('ceu_numero_2', 240.945, 680.315, 10, rec='B', fmt='id'),
    # B | riferimenti temporali
    T('anno_costruzione', 93.543, 623.622, 4, rec='B', fmt='anno', xAntec=93.543),
    T('anno_ristrutturazione', 246.614, 623.622, 4, rec='B'),  # stimata
    # C | elementi descrittivi
    F('posizione_fabbricato', 8, rec='B', uguale=1),
    F('posizione_fabbricato', 9, rec='B', uguale=2),
    F('posizione_fabbricato', 10, rec='B', uguale=3),
    F('complesso_immobiliare', 11, rec='B', uguale=0),
    F('complesso_immobiliare', 12, rec='B', uguale=1),
    T('numero_edifici', 265.0, 524.409, 4, rec='B'),  # stimata
    F('n_abitazioni', 18, rec='B', positivo=True), T('n_abitazioni', 127.559, 467.717, 3, rec='B'),
    F('n_negozi', 19, rec='B', positivo=True), T('n_negozi', 263.622, 467.717, 2, rec='B'),
    F('n_laboratori', 21, rec='B', positivo=True), T('n_laboratori', 127.559, 453.543, 2, rec='B'),  # stimata
    F('n_magazzini', 22, rec='B', positivo=True), T('n_magazzini', 263.622, 453.543, 3, rec='B'),
    F('n_uffici', 24, rec='B', positivo=True), T('n_uffici', 127.559, 439.37, 2, rec='B'),  # stimata
    F('n_box', 25, rec='B', positivo=True), T('n_box', 263.622, 439.37, 3, rec='B'),
    F('n_autorimesse', 26, rec='B', positivo=True), T('n_autorimesse', 263.622, 425.197, 2, rec='B'),  # stimata
    F('n_impianti_sportivi', 27, rec='B', positivo=True), T('n_impianti_sportivi', 263.622, 411.024, 2, rec='B'),  # stimata
    F('n_uiu_cat_b', 28, rec='B', positivo=True), T('n_uiu_cat_b', 263.622, 396.85, 2, rec='B'),
    T('n_scale', 204.094, 368.504, 3, rec='B'),
    F('tipo_accesso', 29, rec='B', uguale=1), F('tipo_accesso', 30, rec='B', uguale=2), F('tipo_accesso', 31, rec='B', uguale=3),
    T('piani_fuori_terra', 113.386, 269.291, 3, rec='B'),
    T('piani_fuori_terra_min', 189.0, 269.291, 3, rec='B'),  # stimata
    T('piani_fuori_terra_max', 253.5, 269.291, 3, rec='B'),  # stimata
    T('piani_entro_terra', 113.386, 255.118, 3, rec='B'),
    T('piani_entro_terra_min', 189.0, 255.118, 3, rec='B'),  # stimata
    T('piani_entro_terra_max', 253.5, 255.118, 3, rec='B'),  # stimata
    T('densita_ft_int', 257.0, 198.425, 5, rec='B', fmt='densita', decimali='densita_ft_dec'),  # stimata
    T('densita_et_int', 257.0, 184.252, 5, rec='B', fmt='densita', decimali='densita_et_dec'),  # stimata
    T('corpi_1_ft', 144.567, 127.559, 2, rec='B'), T('corpi_2_ft', 184.252, 127.559, 2, rec='B'),  # stimate
    T('corpi_3_ft', 223.937, 127.559, 2, rec='B'), T('corpi_4_ft', 263.622, 127.559, 2, rec='B'),
    T('corpi_1_et', 144.567, 113.386, 2, rec='B'), T('corpi_2_et', 184.252, 113.386, 2, rec='B'),
    T('corpi_3_et', 223.937, 113.386, 2, rec='B'), T('corpi_4_et', 263.622, 113.386, 2, rec='B'),
    F('cortile_interno', 67, rec='B', uguale=0), F('cortile_interno', 68, rec='B', uguale=1),
    # D | destinazione degli spazi coperti / scoperti
    F('coperti_guardiola', 0, rec='B'), F('coperti_alloggio_custode', 1, rec='B'),
    F('coperti_sala_riunioni', 2, rec='B'), T('sup_sala_riunioni', 447.874, 651.968, 4, rec='B'),
    F('coperti_atrio', 3, rec='B'), T('sup_atrio', 447.874, 637.795, 3, rec='B'),
    F('coperti_porticato', 4, rec='B'), T('sup_porticato', 447.874, 623.622, 4, rec='B'),
    F('coperti_lavatoio', 5, rec='B'), T('sup_lavatoio', 447.874, 609.449, 4, rec='B'),
    F('coperti_piscina', 6, rec='B'), T('sup_piscina_coperta', 447.874, 595.276, 4, rec='B'),
    F('coperti_altro', 7, rec='B'), T('coperti_altro_descrizione', 402.0, 581.102, rec='B', fmt='an'),  # stimata
    F('scoperti_terrazza', 13, rec='B'), T('sup_terrazza', 447.874, 538.583, 4, rec='B'),
    F('scoperti_cortile', 14, rec='B'), T('sup_cortile', 447.874, 524.409, 4, rec='B'),
    F('scoperti_verde', 15, rec='B'), T('sup_verde', 447.874, 510.236, 4, rec='B'),
    F('scoperti_parcheggio', 16, rec='B'), T('n_posti_auto', 452.0, 496.063, 4, rec='B'),  # stimata
    F('scoperti_tennis', 17, rec='B'), T('n_campi_tennis', 449.0, 481.89, 4, rec='B'),  # stimata
    F('scoperti_piscine', 20, rec='B'), T('sup_piscina_scoperta', 447.874, 467.717, 4, rec='B'),
    F('scoperti_altro', 23, rec='B'), T('scoperti_altro_descrizione', 402.0, 453.543, rec='B', fmt='an'),  # stimata
    # E | posizione del fabbricato: 9 righe × 4 facciate
    *[F(f'facciata{f}_{k}', base + f - 1, rec='B')
      for k, base in [('strada_larga', 32), ('strada_stretta', 36), ('piazza', 40), ('distacco_abitazioni', 44),
                      ('distacco_altro', 48), ('verde_pubblico', 52), ('verde_privato', 56), ('altro', 60)]
      for f in (1, 2, 3, 4)],
    F('facciata2_aderenza', 64, rec='B'), F('facciata3_aderenza', 65, rec='B'), F('facciata4_aderenza', 66, rec='B'),
    T('affaccio_altro_descrizione', 311.811, 155.906, rec='B', fmt='an'),
]

MAPPATURE['1N-I-2'] = [
    # F | caratteristiche costruttive (record C)
    F('strutture_muratura', 0, rec='C'), F('strutture_ca', 3, rec='C'), F('strutture_ferro', 6, rec='C'),
    F('strutture_prefabbricate', 9, rec='C'), F('strutture_altro', 12, rec='C'),
    T('strutture_altro_descrizione', 130.0, 623.622, rec='C', fmt='an'),  # stimata
    F('copertura_terrazza_praticabile', 17, rec='C'), F('copertura_terrazza_non_praticabile', 20, rec='C'), F('copertura_tetto', 23, rec='C'),
    F('tamponature_muratura', 24, rec='C'), F('tamponature_intercapedine', 27, rec='C'), F('tamponature_pannelli', 30, rec='C'),
    F('tamponature_facciata_continua', 33, rec='C'), F('tamponature_altro', 34, rec='C'),
    T('tamponature_altro_descrizione', 130.0, 488.976, rec='C', fmt='an'),  # stimata
    # G | dotazioni di impianti
    F('imp_idrico', 35, rec='C'), F('imp_elettrico', 36, rec='C'), F('imp_gas', 37, rec='C'), F('imp_telefonico', 40, rec='C'),
    F('imp_fognario', 43, rec='C'), F('imp_riscaldamento_centralizzato', 46, rec='C'), F('imp_acqua_calda_centralizzata', 49, rec='C'),
    F('imp_condizionamento_centralizzato', 52, rec='C'), F('imp_citofonico', 55, rec='C'), F('imp_videocitofonico', 56, rec='C'),
    F('imp_antenna_tv', 57, rec='C'),
    # "Ascensore" segnato solo con numero di impianti > 0 (il flag imp_ascensore vale 1 anche con 0 impianti nei file reali)
    F('n_ascensori', 60, rec='C', positivo=True), T('n_ascensori', 136.063, 283.465, 2, rec='C'),
    F('imp_montacarichi', 63, rec='C'), F('imp_altro', 66, rec='C'), T('imp_altro_descrizione', 65.0, 255.118, rec='C', fmt='an'),  # stimata
    F('imp_energie_alternative', 69, rec='C'), T('energie_alternative_descrizione', 144.0, 240.945, rec='C', fmt='an'),  # stimata
    # H | recinzioni
    F('rec_muratura', 76, rec='C'), F('rec_metalli', 77, rec='C'), F('rec_maglie', 78, rec='C'), F('rec_prefabbricati', 81, rec='C'),
    F('rec_altro', 82, rec='C'), T('rec_altro_descrizione', 65.0, 136.063, rec='C', fmt='an'),  # stimata
    # I | finiture esterne (facciata principale / altre)
    *[F(f'fin_{col}_{k}', base + i, rec='C')
      for k, base in [('tinteggiatura', 1), ('resino_plastica', 4), ('klinker', 7), ('marmo', 10), ('pannelli', 13), ('legno', 15), ('intonaco', 18), ('altro', 21)]
      for i, col in ((0, 'principale'), (1, 'altre'))],
    T('fin_altro_descrizione', 405.0, 572.598, rec='C', fmt='an'),  # stimata
    F('portone_legno', 25, rec='C'), F('accessi_legno', 26, rec='C'), F('portone_metallo', 28, rec='C'), F('accessi_metallo', 29, rec='C'),
    F('portone_altro', 31, rec='C'), F('accessi_altro', 32, rec='C'), T('serramenti_altro_descrizione', 340.0, 507.402, rec='C', fmt='an'),  # stimata
    T('finiture_pregio', 365.0, 464.882, rec='C', fmt='an'),  # stimata
    # L | finiture interne (atrio / scale)
    *[F(f'pav_{col}_{k}', base + i, rec='C')
      for k, base in [('marmo', 38), ('ceramica', 41), ('moquette', 44), ('plastica', 47), ('legno', 50), ('altro', 53)]
      for i, col in ((0, 'atrio'), (1, 'scale'))],
    T('pav_altro_descrizione', 405.0, 328.819, rec='C', fmt='an'),  # stimata
    *[F(f'pareti_{col}_{k}', base + i, rec='C')
      for k, base in [('idropittura', 58), ('resino_plastica', 61), ('smalto', 64), ('laminati', 67), ('legno', 70), ('marmo', 72), ('altro', 74)]
      for i, col in ((0, 'atrio'), (1, 'scale'))],
    T('pareti_altro_descrizione', 405.0, 206.929, rec='C', fmt='an'),  # stimata
    # M | vincoli
    F('vincolo_storico', 79, rec='C', uguale=0), F('vincolo_storico', 80, rec='C', uguale=1),
    T('vincolo_descrizione', 300.0, 127.559, rec='C', fmt='an'),  # stimata
]

_ID_ROWS = [680.315, 666.142, 651.968, 637.795]
MAPPATURE['1N-II-1'] = [
    # A | riferimenti catastali (record H, fino a 4 identificativi)
    *[c for k, y in enumerate(_ID_ROWS) for c in (
        T(f'id{k + 1}_sezione', 36.0, y, 3, rec='H', fmt='an'),  # stimata
        T(f'id{k + 1}_foglio', 113.386, y, 4, rec='H', fmt='id'),
        T(f'id{k + 1}_numero', 164.409, y, 10, rec='H', fmt='id'),
        T(f'id{k + 1}_subalterno', 235.276, y, 4, rec='H', fmt='id'))],
    # B | riferimenti temporali
    T('anno_costruzione', 104.882, 581.102, 4, rec='H', fmt='anno', xAntec=93.543),
    T('anno_ristrutturazione', 246.614, 581.102, 4, rec='H'),
    # C/1 | gruppi A e B
    F('tipo_categoria', 0, rec='H', uguale=0, gruppo='AB'), F('tipo_categoria', 1, rec='H', uguale=1, gruppo='AB'),
    T('vani_principali_n', 155.906, 453.543, 5, rec='H', gruppo='AB'), T('vani_principali_sup', 249.449, 453.543, 5, rec='H', gruppo='AB'),
    T('acc_diretti_bagni_n', 158.74, 411.024, 2, rec='H', gruppo='AB'), T('acc_diretti_bagni_sup', 246.614, 411.024, 5, rec='H', gruppo='AB'),
    T('acc_diretti_altri_n', 158.74, 396.85, 2, rec='H', gruppo='AB'), T('acc_diretti_altri_sup', 246.614, 396.85, 5, rec='H', gruppo='AB'),
    T('sup_lorda_principali_accessori', 246.614, 382.677, 5, rec='H', gruppo='AB'),
    T('acc_indiretti_n', 158.74, 325.984, 4, rec='H', gruppo='AB'), T('acc_indiretti_sup', 246.614, 325.984, 5, rec='H', gruppo='AB'),
    T('dip_balconi_sup', 246.614, 283.465, 5, rec='H', gruppo='AB'),
    T('pert_scoperte_sup', 246.614, 240.945, 5, rec='H', gruppo='AB'),
    T('pert_altra_descrizione', 102.0, 226.772, rec='H', fmt='an', gruppo='AB'),  # stimata
    T('pert_altra_sup', 246.614, 226.772, 5, rec='H', gruppo='AB'),
    T('posti_auto', 249.449, 212.598, 4, rec='H', gruppo='AB'),
    T('altezza_media_cm', 255.118, 170.079, 3, rec='H', gruppo='AB'),
    T('sup_altezza_inferiore_230', 246.614, 141.732, 5, rec='H', gruppo='AB'),
    T('b_piani_fuori_terra', 189.921, 85.039, 2, rec='H', gruppo='AB'), T('b_mc_fuori_terra', 246.614, 85.039, 6, rec='H', gruppo='AB'),
    T('b_piani_entro_terra', 189.921, 70.866, 2, rec='H', gruppo='AB'), T('b_mc_entro_terra', 246.614, 70.866, 6, rec='H', gruppo='AB'),
    # C/2 | gruppo C (campi ridefiniti 106-246 del record H)
    *[c for pre, y in (('c_princ1', 629.291), ('c_accd1', 592.441), ('c_acci1', 555.591), ('c_acci2', 541.417)) for c in (
        T(f'{pre}_piano', 340.157, y, rec='H', fmt='id', gruppo='C'),  # "001" → "1" come stampa Docfa
        T(f'{pre}_lorda', 418.11, y, 5, rec='H', gruppo='C'),
        T(f'{pre}_utile', 520.158, y, 5, rec='H', gruppo='C'))],
    T('c_dip_balconi', 520.158, 504.567, 5, rec='H', gruppo='C'),  # stimata
    T('c_pert_sup', 520.158, 467.717, 5, rec='H', gruppo='C'),  # stimata
    T('c_posti_auto', 520.158, 453.543, 4, rec='H', gruppo='C'),  # stimata
    F('c_accesso_carrabile', 2, rec='H', uguale=1, gruppo='C'), F('c_accesso_carrabile', 3, rec='H', uguale=0, gruppo='C'),
    T('c_altezza_media_cm', 520.158, 379.843, 3, rec='H', gruppo='C'),
    T('c_sup_altezza_inferiore_230', 520.158, 351.496, 5, rec='H', gruppo='C'),  # stimata
    # D | dotazioni tecnologiche
    F('dot_riscaldamento', 4, rec='H'), F('dot_acqua_calda', 5, rec='H'), F('dot_condizionamento', 6, rec='H'),
    F('dot_citofono', 7, rec='H'), F('dot_videocitofono', 8, rec='H'), F('dot_ascensore_esclusivo', 9, rec='H'),
    # Docfa segna "Ascensore" solo se il numero di impianti è > 0 (il flag dot_ascensore da solo non basta: NCV081 u.i.u. 5, 8, 10)
    F('dot_n_ascensori', 10, rec='H', positivo=True), T('dot_n_ascensori', 405.354, 141.732, 3, rec='H'),
    F('dot_ascensore_servizio', 11, rec='H'), F('dot_montacarichi', 12, rec='H'),
    F('dot_altre', 13, rec='H', nonVuoto=True), T('dot_altre', 343.0, 82.205, rec='H', fmt='an'),  # stimata
]

MAPPATURE['1N-II-2'] = [
    # E | pavimentazione (camere / cucina / accessori) e infissi
    *[F(f'pav_{col}_{k}', base + i, rec='H')
      for k, base in [('marmo', 0), ('ceramica', 3), ('scaglie', 6), ('moquette', 9), ('gomma', 12), ('parquet', 15), ('altro', 18)]
      for i, col in ((0, 'camere'), (1, 'cucina'), (2, 'accessori'))],
    T('pav_altro_descrizione', 65.0, 487.559, rec='H', fmt='an'),  # stimata
    *[F(f'{col}_{k}', base + i, rec='I')
      for k, base in [('legno', 21), ('tamburato', 23), ('metallo', 25), ('altro', 27)]
      for i, col in ((0, 'porta_ingresso'), (1, 'porte_interne'))],
    T('infissi_altro_descrizione', 65.0, 345.827, rec='I', fmt='an'),  # stimata
    # F | destinazione d'uso e osservazioni
    T('destinazione_uso', 306.142, 651.968, rec='I', fmt='an', righe=2, passo=28.346, larghezza=52),
    T('osservazioni', 306.142, 552.756, rec='L', fmt='an', righe=16, passo=14.173, larghezza=52),
]

MAPPATURE['2N-I-1'] = [
    # A | riferimenti catastali (record M)
    T('ct_sezione', 85.0, 694.488, 3, rec='M', fmt='an'),  # stimata
    T('ct_foglio', 136.063, 694.488, 4, rec='M', fmt='id'), T('ct_numero', 178.583, 694.488, 10, rec='M', fmt='id'),
    T('ct_numero_2', 238.0, 694.488, 10, rec='M', fmt='id'),  # stimata
    T('ceu_sezione', 85.0, 680.315, 3, rec='M', fmt='an'),  # stimata
    T('ceu_foglio', 136.063, 680.315, 4, rec='M', fmt='id'), T('ceu_numero', 178.583, 680.315, 10, rec='M', fmt='id'),
    T('ceu_subalterno', 257.953, 680.315, 4, rec='M', fmt='id'),
    # B | riferimenti temporali
    T('anno_costruzione', 99.213, 623.622, 4, rec='M', fmt='anno', xAntec=93.543),
    T('anno_ristrutturazione', 241.795, 623.622, 4, rec='M'),
    # C | azienda
    T('descrizione_azienda', 34.016, 566.929, rec='M', fmt='an', righe=2, passo=22.7, larghezza=54),
    T('numero_fabbricati', 113.386, 524.409, 2, rec='M'), T('numero_unita_ordinarie', 113.386, 510.203, 3, rec='M'),  # seconda stimata
    # D | collegamenti con infrastrutture
    F('coll_ferroviario', 0, rec='M'), F('coll_autostrada', 1, rec='M'), T('coll_distanza_autostrada', 198.425, 413.858, 2, rec='M'),
    F('coll_svincolo', 2, rec='M'), F('coll_strade_principali', 3, rec='M'), T('coll_distanza_strade', 198.425, 385.503, 2, rec='M'),  # stimata
    F('coll_scalo_marittimo', 4, rec='M'), F('coll_scalo_aeroportuale', 5, rec='M'),
    F('coll_altro', 6, rec='M', nonVuoto=True), T('coll_altro', 76.535, 334.488, rec='M', fmt='an', righe=2, passo=22.7, larghezza=40, xRighe=73.0),
    # E | elementi generali strutturalmente connessi
    F('imp_depurazione', 7, rec='M'), F('imp_depurazione_azienda', 8, rec='M'), F('imp_depurazione_consortile', 9, rec='M'),
    F('imp_abbattimento_fumi', 10, rec='M'), F('imp_antincendio', 11, rec='M'), F('imp_uscite_sicurezza', 12, rec='M'),
    F('imp_scale_emergenza', 13, rec='M'), F('imp_antintrusione', 14, rec='M'),
    T('imp_antintrusione_descrizione', 144.0, 161.603, rec='M', fmt='an'),  # stimata
    F('imp_altro_flag', 15, rec='M'), T('imp_altro_testo', 76.535, 141.703, rec='M', fmt='an', righe=2, passo=17.0, larghezza=40, xRighe=73.0),  # stimata (campi extra, vedi layout.ts)
    # F | sistemazioni esterne (record N)
    T('pav_piazzali', 348.0, 663.303, rec='N', fmt='an', righe=2, passo=17.0, larghezza=40),  # stimata
    T('pav_parcheggi', 348.0, 629.303, rec='N', fmt='an', righe=2, passo=17.0, larghezza=40),  # stimata
    T('spazi_verde', 348.0, 566.903, rec='N', fmt='an', righe=2, passo=17.0, larghezza=40),  # stimata
    T('recinzioni_h_cm', 513.0, 504.503, 4, rec='N'),  # stimata
    T('recinzioni_materiale', 358.0, 487.503, rec='N', fmt='an', righe=2, passo=17.0, larghezza=40, xRighe=348.0),  # stimata
    T('accesso_custodito', 348.0, 425.203, rec='N', fmt='an', righe=2, passo=17.0, larghezza=40),  # stimata
    T('altro', 348.0, 362.803, rec='N', fmt='an', righe=2, passo=17.0, larghezza=40),  # stimata
    # G | dati metrici totali dell'azienda
    T('area_totale_lorda', 518.74, 289.134, 7, rec='N', fmt='migliaia'),
    T('area_coperta', 518.74, 260.787, 7, rec='N', fmt='migliaia'),
    T('tettoie', 518.74, 238.103, 7, rec='N', fmt='migliaia'),  # stimata
    T('depositi_vasche', 518.74, 215.403, 7, rec='N', fmt='migliaia'),  # stimata
    T('passaggi_piazzali', 518.74, 192.703, 7, rec='N', fmt='migliaia'),  # stimata
    T('parcheggi_mq', 445.0, 170.103, 7, rec='N', fmt='migliaia'),  # stimata
    T('parcheggi_posti', 530.0, 170.103, 3, rec='N'),  # stimata
    T('spazi_verde_mq', 518.74, 147.403, 7, rec='N', fmt='migliaia'),  # stimata
    T('volume_totale', 518.74, 119.055, 7, rec='N', fmt='migliaia'),
]

MAPPATURE['2N-I-2'] = [
    # H | stima: tabella dei record O (tipo_stima 0): righe a partire da y0 con passo 14.173 (gestita dal renderer)
    dict(id='tabella_stima', tipo='tabella', rec='O', y0=639.78, passo=14.173, righe=17,
         colonne=[dict(id='corpo', x=36.85, len=3, fmt='id'), dict(id='tipologia', x=70.866, fmt='an'), dict(id='destinazione', x=127.559, fmt='an'),
                  dict(id='consistenza', x=325.984, len=7, fmt='migliaia'), dict(id='valore_unitario', x=385.512, len=9, fmt='dec2'),
                  dict(id='valore', x=467.717, len=10, fmt='migliaia')]),
    # altro tipo di stima (record O con tipo_stima 1): testo libero
    dict(id='altro_tipo_stima', tipo='testoLibero', rec='O', x=34.0, y0=357.103, passo=14.173, righe=9, larghezza=110),
    # totali (campi "extra" del record N in euro, vedi layout.ts)
    T('valore_stima_comparativa_eur', 198.425, 229.606, 12, rec='N', fmt='cent1'),
    T('valutazione_attribuita_eur', 127.559, 171.496, 12, rec='N', fmt='cent1'),
    T('saggio_intero_eur', 223.937, 171.496, rec='N', fmt='saggio', decimali='saggio_decimale_eur'),
    T('rendita_catastale_eur', 303.307, 171.496, 12, rec='N', fmt='cent1'),
    T('rendita_catastale_tonda_eur', 439.37, 171.496, 17, rec='N', fmt='dec2'),
]

MAPPATURE['2N-II'] = [
    # A | riferimenti grafici (record P)
    T('riferimento_planimetria_generale', 33.0, 680.303, rec='P', fmt='an'),  # stimata
    T('numero_planimetria', 33.0, 651.903, rec='P', fmt='an'),  # stimata
    # B | riferimenti di mappa
    *[c for k, y in ((1, 603.78), (2, 589.603)) for c in (
        T(f'id{k}_sezione', 55.0, y, 3, rec='P', fmt='an'),  # stimata
        T(f'id{k}_foglio', 113.386, y, 4, rec='P', fmt='id'), T(f'id{k}_numero', 187.087, y, 10, rec='P', fmt='id'), T(f'id{k}_subalterno', 252.283, y, 4, rec='P', fmt='id'))],
    # C | uso prevalente
    T('destinazione_principale', 31.181, 538.583, rec='P', fmt='an'),
    # D | riferimenti temporali
    T('anno_costruzione', 127.559, 467.717, 4, rec='P', fmt='anno', xAntec=93.543),
    T('anno_ristrutturazione', 246.614, 467.717, 4, rec='P'),
    # E | elementi strutturalmente connessi (record R)
    T('impianti_infissi', 29.764, 425.197, rec='R', fmt='an', righe=7, passo=14.173, larghezza=38),
    # F | notizie particolari (record Q)
    T('notizie_particolari', 29.764, 283.403, rec='Q', fmt='an', righe=5, passo=14.173, larghezza=38),
    # G | caratteristiche costruttive
    F('str_muratura', 0, rec='P'), F('str_prefabbricati_pesanti', 1, rec='P'), F('str_ca', 2, rec='P'),
    F('str_prefabbricati_leggeri', 3, rec='P'), F('str_ferro', 4, rec='P'),
    F('str_altro', 5, rec='P', nonVuoto=True), T('str_altro', 465.0, 649.103, rec='P', fmt='an'),  # stimata
    # H | copertura
    F('cop_tetto', 6, rec='P'), F('cop_ferro', 7, rec='P'), F('cop_piana', 8, rec='P'), F('cop_ca', 9, rec='P'),
    F('cop_shed', 10, rec='P'), F('cop_mista_laterizi', 11, rec='P'), F('cop_volta', 12, rec='P'), F('cop_legno', 13, rec='P'),
    F('cop_altro', 14, rec='P', nonVuoto=True), T('cop_altro', 345.0, 552.703, rec='P', fmt='an'),  # stimata
    # I | altri elementi costruttivi
    T('solai', 428.031, 510.236, rec='P', fmt='an'), T('tamponature', 428.031, 496.063, rec='P', fmt='an'),
    T('finestre_porte', 428.031, 481.89, rec='P', fmt='an'), T('pavimentazione', 428.031, 467.717, rec='P', fmt='an'),
    T('rifinitura_esterna', 428.031, 453.543, rec='P', fmt='an'), T('servizi_igienici', 440.0, 439.303, rec='P', fmt='an'),  # stimata
    # L | locali a peculiari destinazioni
    T('sup_ricovero_operai', 430.0, 385.503, 4, rec='P'), T('sup_mensa', 530.079, 385.512, 4, rec='P'),  # prima stimata
    T('sup_pronto_soccorso', 430.0, 371.303, 4, rec='P'), T('sup_locali_ritrovo', 530.079, 371.303, 4, rec='P'),  # stimate
    T('sup_direzione_tecnica', 430.0, 357.103, 4, rec='P'), T('sup_custodia', 530.079, 357.103, 4, rec='P'),  # stimate
    T('sup_direzione_amministrativa', 430.0, 343.003, 4, rec='P'), T('sup_altro', 530.079, 343.003, 4, rec='P'),  # stimate
    # M | dati metrici (record Q)
    T('piani_fuori_terra', 530.079, 297.638, 3, rec='Q'), T('piani_entro_terra', 531.496, 283.465, 2, rec='Q'),
    T('superficie_coperta', 530.079, 269.291, 6, rec='Q'), T('superficie_sviluppata', 530.079, 255.118, 6, rec='Q'),
    T('volume_totale', 530.079, 240.945, 7, rec='Q'),
]
