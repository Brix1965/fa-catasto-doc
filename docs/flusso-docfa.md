# Flusso di Docfa 4 (dall'help ufficiale) e gap di Fa.Catasto.Doc

Fonte: 77 pagine HTML dell'help di Docfa 4 (rev. gen 2016, novità fino a 4.00.5). Analisi del 28/10/2026.

## Regole di interazione Docfa
- OK = conferma, controllo formale e passaggio alla finestra successiva; Annulla/ESC = indietro senza salvare; F1 = help.
- Ctrl+lettera sottolineata attiva pulsanti/menù (Ctrl+N Nuovo, Ctrl+O OK); Tab tra i campi; frecce nelle tabelle.
- Ordine obbligato: Modello D → Elaborati grafici e poligoni → 1N/2N → Elenco subalterni.
- Nei modelli 1N/2N: campi obbligatori in fucsia, pallino verde sui quadri completi, OK salta al prossimo quadro obbligatorio.

## Sequenza delle schermate
1. File → Nuovo: Accatastamento/Variazione, progressivo proposto, descrizione.
2. Scelta Comune (dagli archivi caricati; codice digitabile).
3. Quadro A (accatastamento): tipo mappale protocollo+data obbligatori (G0175); ditta nuova/in atti CEU/in atti CT; u.i. ordinarie/speciali (almeno una); causale NC o Afferenti; tipologia documento 1–6.
4. Quadro B (variazione): soppresse/variate/costituite (almeno una; variate+costituite = derivate); derivate ordinarie/speciali/bcnc; causale Variazione (data completamento + caselle 1–8, Planimetrica con DIV FRZ FUS AMP DET DEP VSI RST FRF) o Afferenti; compatibilità G0154; tipologia documento 1–8.
5. Quadro I (ditta da intestare): persone fisiche/giuridiche, titolo codificato, quote a 1000/1000 (E0400–E0406).
6. Quadro U per ogni unità: operazione (C/R o V/C/S), identificativi (foglio+numero obbligatori, propone fg/part della precedente), BCC associati, indirizzo da stradario (1–4, civico obbligatorio), piano (almeno uno), scala/interno/lotto/edificio; classamento: zona (non per F), categoria da tendina, classe/consistenza (non D/E/F), superficie catastale automatica dai poligoni, rendita calcolata non modificabile.
7. Quadro D (bcnc, max 20) + Note/Relazione tecnica (max 380 car.) + Estremi del titolo giustificativo. In variazione: finestra Note.
8. Dati del Dichiarante: tecnico (da tendina dei tecnici memorizzati) + dichiarante (civico "SNC"), attestazione per invio telematico → Selezione quadri modello D.
9. Elaborati grafici: associazione planimetria (scala 1:200 proposta, A3/A4, più schede), poligoni (stato da calcolare / Va da validare / Ok, G0209), copia/incolla poligoni, elaborato con "pagine da eliminare".
10. Modelli 1N/2N: 1N I quadri A–M; 1N II quadri A-B (spessore muri obbligatorio), C/1, D (dotazioni, ascensori obbligatori anche 0), E, F (destinazione d'uso obbligatoria); copia/incolla 1N II tra unità (lorde escluse).
11. Classamento automatico → Validazione classamento (Convalida, Automatico su Proposto).
12. Elenco subalterni: Aggiorna/Importa; descrizione dalla destinazione 1N/2N; corpi di fabbrica CF1–CF9, AL, AC, CI, CS obbligatori in accatastamento (non per unica u.i. sulla particella).
13. Controllo formale (errori G/E/W) → Stampa di presentazione (codice di riscontro) → Esporta PDF/A (NCAnnn / NCVnnn).

## Gap di Fa.Catasto.Doc (priorità)
1. Manca l'accatastamento (quadro A, quadro I intestati, quadro D bcnc, estremi giustificativi, nome NCA).
2. Manca "Tipologia di documento".
3. Causale da riorganizzare come Docfa (Variazione/Afferenti + caselle 1–8 + tipologie planimetriche) con compatibilità G0154 e obbligatorietà collegate.
4. Manca il riepilogo soppresse/variate/costituite.
5. Ordine delle sezioni diverso da Docfa (Comune come schermata, 1N I dopo planimetrie, classamento nel quadro U).
6. Tastiera: OK/avanti, Esc, Ctrl+lettera, evidenziazione obbligatori e quadri completi.
7. Superficie catastale automatica dai poligoni (criteri R/P/T completi: tetto ½(a), quintuplo R/2, A2 al 50%).
8. Poligoni: area dichiarata ±5%, stato "da validare", G0212 bloccante, copia/incolla.
9. Elenco subalterni come modulo a sé con corpi di fabbrica codificati.
10. Quadro U: civico obbligatorio, piano obbligatorio, fino a 4 indirizzi, BCC associati, operazione R, categoria A/3 da tendina, rendita non modificabile, controlli D/E/F.
11. Classamento automatico e validazione.
12. Tecnici memorizzati, SNC, tendine provincia/comune, albo dipendenti pubblici.
13. 1N II: quadri A–F, spessore muri, destinazione d'uso e altezza media obbligatori, copia/incolla.
14. 1N I: quadri A–M e controlli "almeno uno".
15. 2N, selezione quadri, stampa di presentazione, controllo formale come funzione, multi-scheda.
16. Terminologia Docfa (Quadro A/B, Quadro U, Note e Relazione tecnica max 380, Tecnico compilatore).

## Regole sulle superfici (citate dall'help)
- Altezza < 1,50 m: non computata, ma i poligoni vanno comunque disegnati; dividente virtuale tratteggiata per altezze variabili.
- Area dichiarata modificabile entro ±5% di quella calcolata.
- Colori DXF: A=1, A2=8, B=2, C=3, D=4, E=5, F=6, G=7; A2 solo per C/1 e C/6. Un livello di poligoni annidati (interno sottratto).
- Scale/ascensori interni: proiezione orizzontale una volta sola. Muri fino a 50 cm per intero, comuni al 50% fino a 25 cm.
- Gruppo R: indiretti 50%/25%; balconi 30%/10% (comunicanti) o 15%/5%; aree scoperte 10% fino ad (a), 2% oltre (R/2 solo oltre il quintuplo); pertinenze+indiretti max ½(a); R/4 accessori diretti 50%.
- Gruppo P: balconi 10%, aree scoperte non computate. Gruppo T: balconi 10%, aree scoperte 10% (20% T/1), accessori diretti T/1 50%.
- Ascensori: obbligatori anche "0" nel 1N I (quadro G) e 1N II (quadro D).
