# Fa.Catasto.Doc — Report di controllo qualità (QA)

Data: 03/11/2026 · Ramo esaminato: `prova` (v0.5.0, contiene anche tutto `main` 0.4.2) · Metodo: lettura del
codice modulo per modulo, prove con script e con il browser (Playwright) sui flussi principali, suite di test.

## 1. Sintesi

Il codice è in buona salute dove conta di più: il motore dei record Docfa, il PDF/A, il codec G4 e il TIFF
coincidono byte per byte con i documenti reali di prova e reggono i casi limite provati. I difetti trovati
erano soprattutto ai bordi: **input guasti o insoliti** (DXF con numeri non validi, campi numerici svuotati,
poligoni degeneri), **casi di dati meno frequenti** (u.i.u. soppresse dopo essere state variate, box R/4,
accatastamenti con più ditte) e **gestione dello stato dell'interfaccia** (effetti Svelte che si richiamano,
salvataggi che falliscono senza dirlo).

| | Trovati | Corretti | Non corretti (motivo in § 5) |
|---|---|---|---|
| Critici | 7 | 7 | 0 |
| Maggiori | 25 | 23 | 2 |
| Minori | 33 | 26 | 7 |

Dopo le correzioni: `pnpm check` 0 errori e 0 avvisi; **169 test superati, 0 falliti** (32 saltati perché i
campioni privati non sono presenti in questo ambiente); compilazione di produzione riuscita. Prima: 156
superati e 2 falliti (test che non si saltavano senza il campione TIFF di NCV002).

## 2. Architettura

- **Applicazione desktop** Tauri 2 (Rust, solo registrazione dei plugin dialog, fs, opener) + SvelteKit 5
  (Svelte 5 con le *rune*), TypeScript, Tailwind. Nessun server, nessun database, nessuna autenticazione:
  le pratiche sono file JSON nella cartella scelta dal tecnico, le impostazioni nella cartella dati dell'app.
- **Instradamento**: `/` (elenco pratiche), `/pratica?f=…` (11 schermi del documento), `/importa`
  (PDF di Docfa), `/impostazioni`.
- **Moduli principali** (`src/lib/core`): record Docfa 4 a lunghezza fissa (`compile.ts`, `decompile.ts`,
  `tracciati/`), regole e diagnostici (`regole-docfa.ts`), PDF/A (`pdf/`), DXF, immagine e NTF (`raster/`,
  `ntf.ts`), superfici DPR 138/98 (`superfici.ts`), classamento automatico (`classamento/`), stima 2N,
  archivi dell'Agenzia, riconoscimento dei vani ed editor (`vani/`, `disegno/`), visure (`visura/`).
- **Stato** (`src/lib/stato`): pratica aperta e autosalvataggio, impostazioni e archivi, validazione
  («Cosa manca»).
- **Test**: Vitest (motore, PDF, raster, vani, visure, stato) e prove nel browser con Playwright.
- **Rilascio**: GitHub Actions — `main` → release «ultima versione», `prova` → pre-release di collaudo.

## 3. Funzionalità verificate

| Funzionalità | Stato prima | Stato dopo |
|---|---|---|
| Lettura/scrittura record Docfa (NCV, NMV, ATT, EPV) | Con problemi (S/BCNC, campi vuoti) | Funzionante |
| Importazione documento Docfa (decompilazione) | Con problemi (più ditte, record ignoti) | Funzionante |
| Importazione PDF Docfa | Con problemi (PDF salvati di nuovo, stream danneggiati) | Funzionante |
| PDF/A di presentazione | Funzionante | Funzionante |
| DXF: lettura e correzione automatica | Interrotto su DXF guasti (blocco del programma) | Funzionante |
| Composizione planimetria e TIFF G4 | Interrotto su DXF guasti | Funzionante |
| Superficie catastale DPR 138/98 | Con problemi (R/4) | Funzionante |
| Rendita dalle tariffe | Con problemi (1 centesimo nel 5% dei casi) | Funzionante |
| Classamento automatico | Funzionante (vettori di prova non disponibili per NZCT02-05) | Funzionante |
| Stima 2N | Funzionante | Funzionante |
| Schermi pratica, Quadro U, Quadro I, Modelli 1N | Con problemi (identificativi, anno, comune di nascita) | Funzionante |
| Planimetria (schermo Elaborati grafici) | Interrotto con DXF senza poligoni | Funzionante |
| Salvataggio, chiusura, eliminazione pratiche | Con problemi (perdita dati possibile) | Funzionante |
| Impostazioni | Con problemi (file guasto = impostazioni azzerate) | Funzionante |
| Riconoscimento vani, poligoni, spessori (sperimentale) | Con problemi (poligoni degeneri, indici) | Funzionante |
| Editor del disegno | Con problemi (aggancio, annulla, scorciatoie) | Funzionante |
| Visure PDF | Con problemi (classi del fabbricato) | Funzionante |
| Avviso di nuova versione | Funzionante | Funzionante |
| Pubblicazione (workflow) | Con problemi (tag uguale al ramo, concorrenza) | Funzionante |

## 4. Difetti e correzioni

Righe riferite al codice prima delle correzioni.

### Critici

| # | File | Difetto | Causa | Correzione |
|---|---|---|---|---|
| C1 | `core/superfici.ts:138` | R/4 (box C/6, C/7): superficie catastale dimezzata (18 m² → 9) | al 50% andavano anche i vani principali; il DPR 138/98 dimezza solo gli accessori diretti | `A + A2·50%`; test |
| C2 | `raster/dxf.ts:193`, `bitmap.ts:145` | DXF con coordinate non numeriche (es. «1,5»): programma bloccato | `Number()` senza controllo; Bresenham con NaN non termina | coordinate non finite scartate; `linea()` rifiuta NaN; test |
| C3 | `dxf-correzioni.ts:62`, `bitmap.ts:203`, `vani/riconosci.ts:101`, `disegno/geometria.ts:24` | ARC con angolo enorme: ciclo infinito all'importazione | `while (fine <= inizio) fine += 360` | `ampiezzaArco()` con il modulo; anche ELLIPSE; test |
| C4 | `bitmap.ts:145`, `planimetria.ts` | linee lunghissime o archi enormi: minuti di calcolo / memoria esaurita | nessun ritaglio sul foglio | ritaglio Liang–Barsky, archi fuori foglio saltati, punti limitati; test |
| C5 | `ui/FormPlanimetria.svelte:178` | DXF senza poligoni: schermo bloccato (`effect_update_depth_exceeded`) | l'effetto leggeva e scriveva gli stessi dati (avvisi, poligoni) | lettura con `untrack`, anteprima marcata subito; provato nel browser |
| C6 | `ui/schermi/QuadroU.svelte` | riga «Modifica» rimasta dopo l'eliminazione di unità o graffati: dati scritti nell'unità sbagliata o graffato `null` che fa cadere la pagina a ogni apertura | indice di riga non azzerato | azzeramento e controllo dell'indice; i `null` si ripuliscono all'apertura |
| C7 | `routes/pratica/+page.svelte:158`, `stato/pratica.svelte.ts` | chiudere la pratica con salvataggio fallito (rete, disco pieno) perdeva le modifiche senza avviso | `salva()` non restituiva l'esito | `salva()` restituisce l'esito; alla chiusura si chiede conferma |

### Maggiori (corretti)

| # | File | Difetto e causa | Correzione |
|---|---|---|---|
| M1 | `core/compile.ts:228,352,619` | u.i.u. soppressa dopo essere stata variata (o b.c.n.c.) scritta con categoria, classe, rendita, rif. 1N e dati metrici: Docfa scrive « 00» e campi vuoti (verificato su NCV065, NCV081, BPM) | dati azzerati per S e partita A; niente H/I/L e NMV; test |
| M2 | `compile.ts:631`, `:383` | dati metrici e quadro C del gruppo C con campi svuotati: «undefined», «NaN», record di lunghezza sbagliata | `cifre()`/`intero()`: interi ≥ 0 limitati alla larghezza del campo; test |
| M3 | `core/decompile.ts:159,233` | accatastamento con più ditte: 1N e dati metrici attribuiti all'unità sbagliata | ricerca per progressivo del record 3 |
| M4 | `compile.ts:628`, `superfici.ts:88` | codice tabella 6 importato usato anche dopo il cambio di categoria (A03 → C02 restava R1) | `tipologiaUnita()`: il codice importato vale solo nello stesso gruppo; test |
| M5 | `core/archivi.ts:85` | rendita diversa di 1 centesimo da Docfa in circa il 5% dei casi C e nello 0,2% dei casi A | stessa aritmetica di NZCT06 (euro a 5 decimali, interi); test |
| M6 | `ui/Mod1NParteII.svelte:93`, `CampoRecord.svelte:76` | anno di costruzione non digitabile: alla prima cifra (1) valeva «anteriore al 1942» e il campo si disattivava | valore applicato all'uscita dal campo; provato nel browser |
| M7 | `ui/Mod1NParteII.svelte` (trovato durante la prova) | «Anteriore al 1942» non si poteva togliere: l'anno del 1N parte I veniva rimesso subito | proposta una volta per modello aperto |
| M8 | `stato/pratica.svelte.ts`, `piattaforma.ts` | file della pratica riscritto sul posto: un'interruzione lasciava un JSON troncato, che poi spariva dall'elenco; due scritture insieme possibili | scrittura su file temporaneo + rinomina; salvataggi in coda; file illeggibili mostrati in elenco |
| M9 | `pratica.svelte.ts:115` | stato «Salvato» anche con modifiche arrivate durante la scrittura | «Salvato» solo senza modifiche in attesa |
| M10 | `routes/pratica/+page.svelte` | chiusura della finestra entro 0,8 s dall'ultima modifica: modifiche perse | `onCloseRequested`: salva prima di chiudere o chiede (permesso `core:window:allow-destroy`) |
| M11 | `stato/impostazioni.svelte.ts:72` | file delle impostazioni guasto: tecnico, cartella, archivi e contatore immagini azzerati al primo salvataggio | copia del file guasto, avviso nella pagina iniziale; salvataggi in coda e sicuri |
| M12 | `ui/schermi/QuadroI.svelte:41` | codice fiscale calcolato con il comune scelto per un altro soggetto | comune legato al soggetto; errori del calcolo mostrati |
| M13 | `stato/pratica.svelte.ts:136` | eliminare una pratica cancellava tutta la cartella, anche file del tecnico (firme, ricevute, DXF) | si eliminano solo la pratica e il PDF esportato; la cartella solo se resta vuota |
| M14 | `FormClassamento.svelte:97`, `Classamento.svelte:18` e altri campi numerici | campo svuotato = `null` salvato: lo schermo Classamento cadeva, rendita 0 nel documento senza errore | `numeroCampo()` su tutti i campi numerici; errore «indicare la rendita» |
| M15 | `raster/dxf.ts:491` | blocco ruotato dentro un blocco specchiato: geometria sbagliata | trasformazioni con matrice affine completa; test |
| M16 | `raster/dxf.ts` | entità con estrusione verso il basso (230 = −1) disegnate specchiate e poi eliminate in silenzio | X rovesciata per le entità in coordinate oggetto; test |
| M17 | `raster/dxf.ts:238` | MTEXT con sottolineato (`\L`): spariva il testo fino al «;» successivo (anche i nomi dei locali) | `\L \O \K` trattati come interruttori; test |
| M18 | `pdf/importa.ts:263,350` | PDF salvato di nuovo (aggiornamento incrementale, firma PAdES): dati vecchi letti senza avviso; filtro in array o stream danneggiati: errore fuorviante | vale l'ultima versione degli oggetti; filtri in array/riferimento; stream guasti saltati |
| M19 | `vani/geo.ts:30` | poligono `[a, b, a]` (vertice trascinato su un altro): tutto il riconoscimento dei vani falliva | punti doppi tolti, poligoni degeneri scartati; editor: niente poligoni senza area |
| M20 | `ui/EditorDisegno.svelte` | «Spessore ai muri» applicava indici calcolati prima di una modifica: linee sbagliate ingrossate; cancellava gli spessori messi a mano | controllo della versione del disegno; si aggiungono solo gli spessori proposti |
| M21 | `ui/EditorDisegno.svelte`, `disegno/geometria.ts:111` | trascinando un vertice con l'aggancio, il vertice si agganciava a se stesso (scatti di 10 px) | esclusione per coordinate |
| M22 | `ui/ImportaVisura.svelte` | classi più elevate del fabbricato calcolate su tutta la visura (altri comuni, immobili non scelti) | solo immobili scelti e del comune della pratica |
| M23 | `.github/workflows/build.yml` | release «prova» con tag uguale al ramo: `git push origin prova` ambiguo (verificato in questa sessione) | tag `versione-prova`; pubblicazione in serie (`concurrency`) |

### Minori (corretti)

- `compile.ts:124` unità F contate tra le ordinarie nel record 1 (la validazione le conta tra le speciali): allineato.
- `decompile.ts:57` un record di tipo sconosciuto bloccava l'importazione: ora si segnala e si prosegue.
- `decompile.ts:91` categoria « 00» delle soppresse non riconosciuta (spazio iniziale): `trim()`.
- `decompile.ts:391` atti anteriori al 1951 letti come 20xx: soglia sull'anno corrente.
- `codice-fiscale.ts:39` mese o giorno impossibili davano «undefined» nel codice: errore chiaro; test.
- `compile.ts:436` osservazioni del 1N oltre 600 caratteri dopo la conversione delle accentate: avviso.
- `raster/dxf.ts:248` TEXT «allineato»/«adattato» posizionato male: punto medio.
- `bitmap.ts:318` «°», «²», «³» stampati come «?»: NFKD e «o».
- `pdf/importa.ts:520` file diviso in parti con una parte mancante: errore invece di file corrotto.
- `pdf/importa.ts:603` immagine con dimensioni non valide: saltata con avviso invece di errore.
- `raster/g4.ts` stream G4 troncato: righe mancanti bianche, come da descrizione.
- `ntf.ts:47` poligoni fuori dal riquadro: avviso in «Cosa manca».
- `dxf-scrivi.ts` DXF per il CAD in UTF-8 senza codepage: ora Windows-1252 con `$DWGCODEPAGE`.
- `raster/dxf.ts` MINSERT con righe/colonne enormi: massimo 10000 copie.
- `FormPlanimetria.svelte`, `FormElaborato.svelte` anteprima vecchia rimasta o sovrascritta da una generazione lenta: azzerata e con contatore.
- `routes/+page.svelte` creazione pratica senza gestione dell'errore e numero con decimali accettato; numero riservato anche se la creazione falliva.
- `routes/pratica/+page.svelte` la pratica chiusa si riapriva in memoria; «Annulla» non funzionava nel primo schermo di una pratica appena creata.
- `PannelloEsporta.svelte` PDF prodotto anche se il salvataggio era fallito.
- `Modelli1N2N.svelte` «Incolla» dopo aver eliminato il modello copiato cancellava quello di destinazione.
- `stato/impostazioni.svelte.ts` numero immagine oltre 9999999 (8 cifre).
- `vani/riconosci.ts` solo poligoni D/E/F: nessun vano e vista vuota → si cerca nel riquadro; poligoni «a farfalla» segnalati.
- `vani/poligoni.ts` differenze geometriche non protette.
- `vani/esegui.ts`, `VaniDaDisegno.svelte` calcolo senza tempo massimo; due calcoli insieme si sovrascrivevano; scelte riapplicate anche se non erano del tecnico.
- `EditorDisegno.svelte` Canc/Ctrl+Z durante un trascinamento; un clic su una maniglia contava come modifica; «Esporta DXF» senza gestione degli errori.
- `ImportaVisura.svelte` immobile di un altro comune con lo stesso identificativo considerato «già presente».
- Test `documento.test.ts`, `pratica-file.test.ts` che fallivano senza il campione TIFF di NCV002: ora si saltano.

## 5. Non corretti, con il motivo

| Gravità | File | Punto | Motivo |
|---|---|---|---|
| Maggiore | `src-tauri/capabilities/default.json`, `tauri.conf.json` | permessi file `**`, apertura di qualsiasi percorso, CSP assente | nessun punto di iniezione di codice trovato (niente `{@html}`, testi sempre escapati). Restringere ora rischia di bloccare cartelle scelte dal tecnico dopo il riavvio: da fare con una prova sul desktop (scope persistente o CSP rigida) |
| Maggiore | `pdf/importa.ts:598` | immagini con `BlackIs1 true` forse invertite | non confermato: per lo standard CCITT il flag cambia solo la convenzione dei bit, non il colore delle corse; serve un PDF reale con quel flag |
| Minore | `routes/pratica/+page.svelte:63` | autosalvataggio che serializza tutto a ogni tasto (lento con molte immagini) | prestazioni, non errori; da misurare su pratiche grandi |
| Minore | `piattaforma.ts:298` | nel browser, cartella non più autorizzata: un download a ogni salvataggio | solo in sviluppo (`pnpm dev`), non nell'app |
| Minore | `raster/dxf.ts:134` | spazi iniziali dei testi persi | effetto solo estetico |
| Minore | `raster/dxf.ts:613` | INSERT su layer congelato: le entità annidate su altri layer si vedono | caso raro; da allineare ad AutoCAD con un campione |
| Minore | `pdf/writer.ts` | `stringaPdf` storpia i caratteri non Latin-1 | nessun chiamante passa testo non ASCII |
| Minore | `vani/poligoni.ts` | spessori dei muri: ~80% giusti sul campione | limite dell'automatismo sperimentale, dichiarato nella guida; correzione a mano nell'editor |
| Minore | `classamento/nzct02-05` | non verificabili senza i vettori di prova | ricostruzioni di Docfa; i vettori stanno solo nei campioni privati |

## 6. Prove aggiunte

- `core/__tests__/controllo-qa.test.ts`: R/4, soppressa con dati vecchi, dati metrici con campi vuoti,
  codice tabella 6, codice fiscale.
- `core/__tests__/archivi.test.ts`: rendita identica a NZCT06 nei casi che differivano.
- `raster/__tests__/dxf-robustezza.test.ts`: coordinate non numeriche, angoli enormi, linee lunghissime,
  MTEXT, blocchi annidati specchiati, estrusione.
- Prove nel browser (Playwright): planimetria senza poligoni, anno di costruzione, chiusura della pratica,
  editor (poligoni, spessori, salvataggio), visure, Quadro U.
