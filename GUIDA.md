# Fa.Catasto.Doc — Guida all'uso

Fa.Catasto.Doc compila i documenti di aggiornamento del Catasto Fabbricati (accatastamenti e variazioni)
e produce il **PDF/A da firmare e inviare con Sister**, nello stesso formato di Docfa 4.00.5.

> Fa.Catasto.Doc non è un software dell'Agenzia delle Entrate né di Sogei. È software libero (GPL-3.0),
> fornito così com'è e senza garanzia: il professionista resta responsabile dei documenti che presenta.
> Prima della presentazione si consiglia di importare il documento nel Docfa ufficiale e di eseguirne il
> controllo formale.

---

## Perché usarlo al posto di Docfa

Docfa 4 è il programma ufficiale, ma la sua base tecnica è ferma da anni: funziona solo su Windows,
ha bisogno di un Java di vecchia generazione e di altri programmi installati a parte, e ha limiti che
fanno perdere tempo ogni giorno. Fa.Catasto.Doc produce **lo stesso PDF da presentare** (i file dati sono
identici byte per byte a quelli di Docfa 4.00.5) ma è costruito con tecnologie attuali ed è pensato per
far sbagliare meno il tecnico.

### I problemi tecnici di Docfa che qui non ci sono

| Docfa 4 | Fa.Catasto.Doc |
|---|---|
| Per produrre il PDF usa un modulo Java: il Leggimi richiede il runtime Java 1.5 (Java 5, uscito nel 2004, senza aggiornamenti di sicurezza dal 2009), da installare a 32 bit. Con le versioni di Java recenti l'esportazione può fallire (errore 163). | **Nessun Java.** Il PDF/A viene generato direttamente dal programma. |
| Il modulo Java usa librerie del 2012-2013: PDFBox 1.8.2 e Log4j 1.2.17, una versione di Log4j fuori supporto dal 2015. | Componenti attuali e mantenuti, codice sorgente pubblico e verificabile. |
| Solo Windows: su Mac e Linux serve una macchina virtuale con Windows. | **Windows, macOS e Linux**, con un programma nativo per ciascuno. |
| Per vedere e stampare i documenti serve Acrobat Reader. | Anteprima interna; il PDF si apre con qualsiasi lettore. |
| Le cartelle di installazione, dei documenti e delle immagini non possono contenere spazi nel nome (lo dice il Leggimi). | Cartelle con qualsiasi nome, anche con spazi. |
| Gli archivi si caricano **una provincia alla volta**. | **Tutte le province insieme**, da una sola cartella. |
| Le immagini sono numerate da 1: importando un documento preparato altrove capita «alcune planimetrie non importate» perché il numero è già nell'archivio. | Numerazione che parte da 9000001, lontana da quella di Docfa, e modificabile. |
| Il DXF va salvato in versione R14 o 2000 con il layer dei poligoni spento, altrimenti «archivio DXF non conforme». | Il DXF viene letto anche in altre versioni e **corretto in automatico**, con il resoconto delle correzioni. |
| L'indirizzo con accentate, apostrofo tipografico o «°» viene rifiutato al controllo formale (W0708). | L'indirizzo viene convertito da solo nei caratteri ammessi. |
| Ordine degli schermi obbligato; Annulla/Esc torna indietro senza salvare. | Navigazione libera e **salvataggio automatico** a ogni modifica. |

### Cosa fa in più

**Lavoro più sicuro**
- **Salvataggio automatico**: ogni modifica viene salvata da sola dopo meno di un secondo. Non si perde
  niente chiudendo il programma o cambiando schermo. In alto si vede sempre lo stato: «Salvato»,
  «Modifiche non salvate», «Salvataggio…». Ctrl+S salva subito.
- **Bozza sempre valida**: il documento si può lasciare incompleto e riprendere quando si vuole.
  Gli errori bloccano solo l'esportazione finale, non il lavoro.
- **Conferma della data di ultimazione dei lavori** prima di chiudere la pratica e prima di esportare il PDF,
  con la possibilità di correggerla lì.
- **Conferma prima di sovrascrivere** un PDF già esportato.

**Archivi dell'Agenzia**
- **Tutte le province insieme**: Docfa carica gli archivi di una provincia alla volta. Fa.Catasto.Doc importa
  in un colpo solo una cartella che contiene più province (es. `fi`, `bo`, `po`…) e le tiene tutte caricate:
  stradari, tariffe, zone censuarie e prospetti del classamento automatico.
- Gli archivi sono quelli ufficiali dell'Agenzia, letti così come sono: i dati restano identici a Docfa.
- Ogni provincia si può rimuovere singolarmente; c'è un elenco dei comuni già incorporato, utilizzabile
  subito senza importare nulla.
- I dati del tecnico si possono leggere dal `SETUP.DAT` di Docfa.

**Navigazione libera**
- In Docfa gli schermi vanno percorsi in un ordine obbligato. Qui un albero a sinistra permette di aprire
  **qualsiasi schermo in qualsiasi momento**, anche la singola unità immobiliare.
- **«Avanti» non blocca**: se mancano dati il programma lo dice («mancano ancora N dati») e prosegue.
- **Pallini e contatori** su ogni schermo e su ogni unità: verde = completo, fucsia = dati obbligatori mancanti,
  numero rosso = errori, numero ambra = avvisi.
- **«Cosa manca»**: un'unica pagina con tutto quello che va completato o corretto, raggruppato per schermo.
  Ogni voce porta direttamente al punto da correggere e mostra la spiegazione del codice diagnostico Docfa.

**Planimetrie da DXF**
- **Correzione automatica del DXF** all'importazione, con il resoconto di cosa è stato corretto: disegno in cm
  o mm convertito in metri, riquadro spostato nell'origine, oggetti fuori dal riquadro eliminati, tratteggi,
  immagini e oggetti 3D ignorati, poligoni aperti chiusi, colori ricondotti a quelli ammessi, e altro.
- **Anteprima immediata** della scheda con cartiglio, come verrà stampata, con i poligoni sovrapposti:
  cliccandone uno si evidenzia nella tabella. Il tipo di poligono (A, A2, B…G) si cambia e un poligono
  si elimina senza tornare al CAD.
- **Superfici calcolate in automatico** dai poligoni: dati metrici, superficie catastale DPR 138/98 e superfici
  lorde del modello 1N parte II.
- Planimetrie ed elaborato planimetrico **su più schede**, ognuna dal proprio DXF.
- **Editor del disegno** dentro il programma: linee, testi e poligoni si correggono senza tornare al CAD, con
  aggancio agli spigoli, ortogonale, misura e annulla. Vedi [Modifica il disegno](#modifica-il-disegno-editor).
- **Planimetria in tre passi numerati** (sperimentale): **1 Carica DXF** → **2 Genera poligoni DocFa** (per
  tipologia, sull'anteprima) → **3 Riconosci i vani** (per il quadro C del 1N parte II). Vedi
  [Elaborati grafici](#elaborati-grafici).
- **Riquadro DXF di partenza**: il modello A4/A3 dell'Agenzia alla scala scelta, con i layer già pronti e un
  esempio di locale disegnato come lo vuole il riconoscimento dei vani.
- Numerazione delle immagini che parte da 9000001, lontana da quella di Docfa (che parte da 1): evita il
  messaggio «alcune planimetrie non importate» quando si importa il documento in Docfa.

**Compilazione assistita**
- **Rendita calcolata dalle tariffe**, con la formula mostrata.
- **Classamento proposto e automatico affiancati**: si sceglie quale convalidare e i dati restano modificabili.
- **Codice fiscale calcolato** con il pulsante «Calcola».
- **Tecnici memorizzati** (fino a 20) e riproposti nei documenti successivi.
- **Nuova unità precompilata** con foglio, particella, indirizzo e piano della precedente.
- **Copia del modello 1N parte II** su più unità della stessa categoria in un colpo solo.
- **Vani proposti dalla planimetria** (sperimentale): numero e superfici di vani principali, bagni e accessori
  del quadro C del modello 1N parte II letti dal DXF, da controllare e confermare. Vedi
  [Vani dalla planimetria](#vani-dalla-planimetria-sperimentale).
- **Causali incompatibili disattivate**, con il motivo.
- **Indirizzo del dichiarante sistemato in automatico**: accentate, apostrofi tipografici e «°» vengono
  convertiti nei caratteri ammessi da Docfa.
- **Indirizzi dallo stradario certificato** con ricerca mentre si scrive; se la strada non c'è si può usare
  esplicitamente un indirizzo non certificato.
- Date sempre nel formato gg/mm/aaaa: le barre si inseriscono da sole.

**Importazione da Docfa**
- Un **PDF prodotto da Docfa** si importa e diventa una pratica modificabile, con dati, planimetrie e poligoni.
- L'elenco subalterni si può importare da un PDF Docfa o da un file `EPVnnn.DAT`.

**Aggiornamenti**
- **Avviso di nuova versione**: all'avvio (e ogni 6 ore) il programma controlla se è uscita una versione nuova e
  lo dice con una barra in alto, con le novità e il pulsante «Scarica». Il controllo legge solo la pagina pubblica
  delle release su GitHub: non invia nessun dato.

**Piattaforme**
- Windows, macOS (Apple Silicon) e Linux. Su Windows c'è anche la versione portatile, senza installazione.
- Non serve Java né altro software. Nessun server: i file restano sul computer.

---

## 1. Installazione

Gli eseguibili sono nella pagina [Releases](https://github.com/Brix1965/fa-catasto-doc/releases/latest)
del progetto. Le istruzioni per ogni sistema sono nel [README](README.md#installazione).

## 2. Primo avvio

Si fa una volta sola. Dalla pagina iniziale apri **Impostazioni**.

1. **Tecnico**: compila cognome, nome, codice fiscale, albo, numero e provincia di iscrizione, oppure
   premi **«Leggi SETUP.DAT di Docfa»** e scegli il file `SETUP.DAT` della cartella di Docfa.
   Questi dati vengono proposti in ogni nuova pratica.
2. **Cartella delle pratiche**: premi **«Scegli…»** e indica dove salvare le pratiche.
3. **Archivi dell'Agenzia**: premi **«Importa cartella…»** e scegli la cartella degli archivi scaricati dal
   sito dell'Agenzia. Può essere la cartella di una provincia (es. `fi`) o una cartella che ne contiene
   più d'una: vengono importate tutte. La tabella «Archivi provinciali» mostra per ogni provincia
   stradario, tariffe, zone e prospetti del classamento.

Senza stradario l'indirizzo si scrive a mano; senza tariffe la rendita va inserita a mano; senza prospetti
il classamento automatico non è disponibile.

Le impostazioni si salvano da sole a ogni modifica.

## 3. Le pratiche

Ogni pratica ha una sua sottocartella dentro la cartella delle pratiche, con il file `….catasto.json`
e, dopo l'esportazione, il PDF `NCVnnn.PDF` o `NCAnnn.PDF`.

Nella pagina iniziale:
- **Nuovo documento** (Ctrl+N): scegli Accatastamento o Variazione, il progressivo (viene proposto il primo
  libero) e una descrizione;
- clic su una pratica per aprirla;
- **ricerca** per titolo o comune e filtro Accatastamenti / Variazioni;
- ogni pratica mostra se è in **Bozza** o già **Esportata**;
- il cestino elimina la pratica con tutti i suoi file (chiede conferma).

## 4. Lavorare a una pratica

**L'albero a sinistra** elenca gli schermi del documento. Si può aprire qualsiasi schermo in qualsiasi
momento; Quadro U ed Elaborati grafici si espandono sulle singole unità.

**I comandi sono quelli di Docfa**

| Tasto | Effetto |
|---|---|
| Ctrl+O | Avanti: passa allo schermo (o all'unità) successivo |
| Esc | Annulla: scarta le modifiche fatte nello schermo e torna al precedente |
| F1 | Aiuto dello schermo |
| Ctrl+S | Salva subito (comunque il salvataggio è automatico) |
| Ctrl+N | Nuovo documento (dalla pagina iniziale) |

Su macOS al posto di Ctrl si può usare Cmd.

**Campi obbligatori** con l'etichetta fucsia, l'asterisco e lo sfondo verde (il colore del logo); un bordo ambra indica
un valore non valido. Su una finestra stretta l'elenco degli schermi si apre con il pulsante ☰ in alto a sinistra.

Dentro un modello 1N/2N aperto, Esc chiude il modello (come «Chiudi») senza annullare il resto dello schermo;
nei campi con i suggerimenti (es. la ricerca della strada) Esc chiude solo l'elenco dei suggerimenti.

Il titolo della pratica si modifica cliccandoci sopra.

## 5. Gli schermi

### Comune
Scegli la provincia e cerca il comune (Invio prende il primo dell'elenco), oppure digita direttamente il codice
catastale (es. D612). Il comune scelto compare **in evidenza in alto** («Comune scelto: FIRENZE (FI) D612»), nella
casella di ricerca e in verde nell'elenco; **«Cambia comune»** svuota la ricerca. Doppio clic su un comune = sceglie
e va **avanti**. Il comune amministrativo si compila da solo.

In fondo a ogni schermo il pulsante **«Avanti →»** (Ctrl+O) conferma e passa allo schermo successivo.

### Quadro A (accatastamento) / Quadro B (variazione)
- **Accatastamento**: ditte (anche più d'una), tipo mappale, ditta da intestare (nuova o già in atti),
  data di ultimazione lavori, causale e tipologia di documento.
- **Variazione**: numero di unità soppresse, variate e costituite (proposto dalle unità inserite), causale
  e tipologia di documento. Le causali incompatibili con quelle già scelte sono disattivate.

### Quadro I (accatastamento con ditta nuova)
Soggetti da intestare: persone fisiche (con **«Calcola»** per il codice fiscale), persone giuridiche o beni
comuni censibili; titolo, quota e regime.

### Quadro U
Per ogni unità: tipo di operazione, identificativi catastali (anche graffati), beni comuni censibili
associati, indirizzi (fino a 4, dallo stradario), piani, scala, interno, e il classamento proposto.
La **superficie catastale** viene dai poligoni della planimetria e la **rendita** dalle tariffe: non si scrivono.
«Nuova U.I.U.» propone foglio, particella, indirizzo e piano dell'unità precedente.

**«Da visura»** legge una visura catastale in PDF scaricata da Sister (visura sintetica per soggetto o visura per
immobile, sia a tabella sia nel formato a voci «Visura attuale per immobile», Catasto Fabbricati; della
visura storica si legge la situazione attuale) e mostra gli immobili trovati. Quelli spuntati diventano u.i.u. della pratica (o
aggiornano quelle con lo stesso identificativo) con identificativo, indirizzo, civici e piani; in variazione anche
il **classamento in atti** (variata o soppressa, a scelta riga per riga) e, se spuntato, le **classi più elevate
per categoria** del fabbricato per il classamento automatico. L'indirizzo letto dalla visura non è quello dello
stradario certificato: va confermato. Tutto resta modificabile.

### Quadro D (accatastamento) / Note
Beni comuni non censibili (fino a 20) ed estremi del titolo giustificativo; note e relazione tecnica
(massimo 380 caratteri).

### Dichiarante
Tecnico compilatore (scegliendolo dalla tendina dei tecnici memorizzati) e dichiarante.

### Elaborati grafici
La planimetria si prepara in **tre passi numerati**, in ordine: ogni passo si sblocca quando il precedente è
fatto e, finito, mostra la spunta verde.

- **1 Carica DXF**: il disegno della planimetria (formato e scala si leggono dal riquadro).
- **2 Genera poligoni DocFa**: il programma disegna i poligoni per tipologia (vedi sotto) e li mostra colorati
  sull'anteprima. **Clic su un poligono** per cambiarne il tipo, eliminarlo o **«Modifica la forma»** (si apre
  l'editor con quel poligono selezionato). Se la scheda ha già dei poligoni chiede se sostituirli.
- **3 Riconosci i vani**: si apre la finestra dei vani, colorati sul disegno: clic su un vano per cambiarne il tipo,
  i m² si correggono nella tabella; **«Conferma e inserisci nel quadro C»** porta i totali nel 1N parte II. Solo
  per le unità a destinazione ordinaria (A, B, C), dopo i poligoni.

Poligoni generati: **A** vani e accessori diretti con i loro muri, **B** accessori indiretti comunicanti, **C** locali
staccati dall'abitazione (es. ripostiglio in giardino), **D** balconi, terrazze, logge e portici, **F** giardini,
corti, resedi, aie e orti. Gli spazi **a comune** o di altre unità (vano scale a comune, resede a comune, androne,
«altra u.i.») non entrano mai; una corte o una terrazza senza «a comune» è dell'unità. Sono proposte: i muri in
comune con altre unità sono compresi per intero (il DPR 138/98 ne conta metà): correggi a mano.

Nel dettaglio:
1. Scegli l'unità e premi **«Aggiungi planimetria»**, poi **«1 Carica DXF»**.
2. Il DXF va disegnato su uno dei riquadri dell'Agenzia (A4 o A3, scala 1:100, 1:200 o 1:500) con i poligoni
   sul layer `DOCFA_POLIGONI` (colore 1 = A, 2 = B, 3 = C, 4 = D, 5 = E, 6 = F, 7 = G, 8 = A2).
   Il DXF deve essere in formato testo (ASCII), non binario.
3. Se il DXF aveva problemi compare il riquadro verde **«Corretto automaticamente»** con l'elenco delle correzioni.
4. Controlla l'anteprima e la tabella dei poligoni: tipo, superficie, altezza inferiore a 1,50 m.
   I dati metrici si compilano da soli.
5. Per una planimetria su più fogli usa **«Aggiungi scheda»**.
6. **«Riquadro DXF di partenza»** salva il riquadro dell'Agenzia del formato e della scala scelti (vertice in 0,0),
   con il layer `DOCFA_POLIGONI` già spento, un esempio di locale (layer ESEMPIO, da cancellare) e le istruzioni
   (layer ISTRUZIONI, spento). Partire da qui evita quasi tutti gli errori di importazione.

#### Modifica il disegno (editor)
**«Modifica il disegno»** (o «Modifica la forma» su un poligono) apre il disegno della scheda a tutto schermo.
- Strumenti: **Seleziona** (S), **Linea** (L), **Poligono** (P), **Testo** (T), **Misura** (M). Rotella = zoom,
  trascinare = spostare la vista, F = adatta alla finestra.
- **Aggancio** a estremi, punti medi, centri, vertici dei poligoni e punto più vicino su una linea (quadratino
  verde). **Ortogonale** (casella, tasto O, oppure Maiusc tenuto premuto): segue l'**orientamento dei muri**
  dell'edificio, anche se il disegno è ruotato.
- **Selezione**: se il bordo di un poligono è sopra una linea del disegno, **clic di nuovo nello stesso punto**
  per prendere l'oggetto sotto, oppure **«Seleziona: solo poligoni»** in alto (impostato da solo quando l'editor
  si apre da «Modifica la forma»).
- Oggetto selezionato: per le linee si cambia **tratteggiata/continua** e **muro sezionato** (spessore), si
  spostano gli estremi trascinando i quadratini; per i testi si corregge il testo e l'altezza; per i poligoni si
  cambia il tipo e l'altezza < 1,50 m e se ne corregge la forma:
  - **trascina un vertice** per spostarlo; con **Ortogonale** (o Maiusc) si allinea ai due vertici vicini, così i
    lati restano paralleli ai muri;
  - **«Aggiungi vertici»** (tasto V): poi clic sul bordo, il vertice nuovo si può subito trascinare (anche doppio
    clic sul bordo);
  - **più vertici insieme**: Maiusc+clic sui vertici, oppure Maiusc+trascina sul vuoto per prenderli con un
    riquadro; **«Togli vertice/i»** o Canc li toglie (il poligono resta con almeno 3 vertici);
  - **«Squadra»** (tasto Q): i lati storti di non più di 3° diventano esattamente paralleli o perpendicolari ai
    muri; i lati davvero obliqui restano come sono. Il messaggio dice la superficie prima e dopo;
  - **«Semplifica»**: toglie i vertici doppi o allineati (entro 1 cm), utile per i poligoni con molti vertici;
  - «Squadra tutti» e «Semplifica tutti» (senza nulla selezionato) lavorano su tutti i poligoni della scheda.
  «Elimina il poligono» lo toglie tutto. Ctrl+Z annulla, Ctrl+Y ripete.
- **Muri sezionati (sperimentale)**: «Trova i muri sezionati», poi «Spessore ai muri sezionati» ingrossa le linee
  dei muri tagliati (0,07 a 1:200, in proporzione alle altre scale); «Togli tutti gli spessori» le riporta sottili.
- **«Salva nella scheda»** riscrive il DXF della scheda (formato R12) e i poligoni, e rigenera l'anteprima.
  Il DXF di prima resta conservato: **«DXF originale»** lo ripristina. **«Esporta DXF»** salva una copia da
  riaprire nel CAD.

Il numero immagine si può modificare se coincide con un'immagine già presente in Docfa.

L'**elaborato planimetrico** (con l'indicazione se è obbligatorio e perché) si associa dallo stesso schermo
e può avere più schede.

### Modelli 1N/2N
- **1N parte I**: un modello per il documento; le sigle dei quadri sono verdi quando compilati, fucsia se obbligatori.
- **1N parte II**: uno per unità: si sceglie la riga e si preme **«Compila»** (o doppio clic sulla riga). Le superfici
  lorde vengono dai poligoni. Con **«Copia»** e **«Incolla»** si copia
  il modello su altre unità della stessa categoria.
- **2N**: per le unità a destinazione speciale e particolare (gruppi D ed E), con **«Compila»** come sopra.

«Compila» è grigio quando non ci sono unità per quel modello.

Nell'editor «Avanti (Ctrl+O)» porta al prossimo quadro obbligatorio ancora da compilare.

### Vani dalla planimetria (sperimentale)

> **Attenzione: questo modulo è sperimentale.** Il riconoscimento dei vani può sbagliare. I dati che inserisce
> sono **solo una proposta**: restano tutti modificabili dal professionista, prima e dopo la conferma, e la
> responsabilità di quanto dichiarato resta del tecnico che firma. Controllali sempre sulla planimetria.

**Dove si trova.** Modello 1N parte II dell'unità → quadro C → pulsante **«Proponi i vani dalla planimetria»**.
Serve che l'unità abbia almeno una planimetria caricata da DXF. Il calcolo richiede qualche secondo.

**Cosa si vede.** Una finestra con la planimetria e ogni vano colorato secondo il tipo, con numero e m²:

| Colore | Tipo |
|---|---|
| rosso | vano principale |
| blu | bagno / wc |
| arancio | accessorio a servizio diretto |
| verde | accessorio a servizio indiretto |
| grigio | escluso (non conta) |

Il bordo tratteggiato segnala un locale senza nome, proposto come accessorio diretto **da verificare**.

- **Cambiare tipo**: clic sul vano nel disegno e scelta dal menu (principale, bagno, diretto, indiretto, escluso),
  oppure dal menu a tendina nella tabella sotto il disegno.
- **Correggere la superficie**: nella tabella ogni vano ha i suoi m², modificabili. «Ripristina proposta»
  rimette i valori calcolati.
- **Ingrandire**: rotella del mouse (o i pulsanti + e −), trascinare per spostare la vista, F o il pulsante
  «adatta» per tornare a tutto il disegno.
- **Correggere la forma di un vano**: clic sul vano → **«Modifica la forma»** (o «modifica la forma» nella
  tabella). La vista si porta sul vano e compaiono i suoi vertici: si trascinano (si agganciano agli spigoli dei
  muri; con Ortogonale o Maiusc si allineano ai vertici vicini), **«Aggiungi vertici»** e clic sul bordo ne
  aggiunge, **«Togli vertice»** o Canc toglie quello selezionato. I m² si ricalcolano subito; il vano è segnato
  «forma corretta a mano» e la forma resta anche riaprendo la finestra. **«Forma proposta»** torna a quella del
  programma, **«Fine»** (o Esc) chiude la modifica.
- In fondo ci sono i totali, la consistenza indicativa, l'**altezza media utile** e la **superficie con altezza
  inferiore a 2,30 m** (dai testi «h…» del disegno, media pesata sulla superficie) e, per confronto, i valori già
  presenti nel quadro C.
- **«Conferma e inserisci nel quadro C»** scrive numero e superficie di vani principali, bagni, accessori
  diretti e indiretti, e l'altezza media e la superficie con h < 2,30 m se il disegno ha le altezze scritte. **«Chiudi senza inserire»** non cambia nulla.
- Dopo la conferma i campi del quadro C restano normali campi modificabili. Riaprendo la finestra si
  ritrovano le scelte fatte; «Ricalcola» rilegge il disegno.

**Come conta.**
- Superficie utile netta di ogni vano **misurata fra i muri**: **sguinci delle finestre, stipiti, soglie delle
  porte, archi e nicchie** nello spessore dei muri non contano (il programma taglia lungo il filo del muro e lo
  scrive nella nota del vano, «esclusi … m² di sguinci, soglie o nicchie»).
- Superficie arrotondata al **m² intero** (da 0,5 per eccesso, sotto per difetto,
  come vuole Docfa); i totali sono la somma dei vani già arrotondati.
- Il tipo viene dal **nome scritto nel vano**. Dentro i poligoni B e C i locali sono accessori indiretti.
- Le zone dentro i poligoni G e quelle barrate con una croce (X) non sono vani.
- Una scala interna si conta una volta sola, intera, al piano dell'unità.
- Due locali uniti da un'apertura più grande di 4 m² (larghezza × altezza) contano come un vano solo.
- Un locale chiuso senza nome più grande di 1 m² (cabina armadi, ripostiglio…) non viene scartato: è proposto
  come accessorio diretto da verificare.

#### Come preparare il DXF perché il riconoscimento sbagli meno

Il programma ricostruisce i locali dalle linee dei muri. Più il disegno è pulito e completo, meno correzioni
servono. La regola più importante: **scrivi il nome dentro ogni locale.** Con tutte le destinazioni scritte il
modulo fa molti meno errori; senza nome deve indovinare.

1. **Poligoni**: sul layer `DOCFA_POLIGONI` (A, B, C, G…): dicono dove sta l'unità. Senza poligoni i vani si
   cercano in tutto il riquadro (i locali senza nome sono proposti come principali, da controllare) e i poligoni
   si generano con il passo **2 Genera poligoni DocFa**.
2. **Muri**: linee o polilinee a **tratto continuo**, con le due facce del muro disegnate. I tratti si devono
   toccare negli spigoli; i piccoli distacchi fino a 20 cm vengono chiusi da soli, ma è meglio non averne.
   Non spezzare il contorno del muro con linee tratteggiate.
3. **Porte e passaggi**: due modi riconosciuti, usane uno.
   - il muro interrotto fra le due **spalle** (anche di lunghezza diversa; luce fra 45 cm e 2,60 m), oppure fra
     la testa di un muro e il fianco di un altro (porta vicino a uno spigolo, fino a 1 m);
   - oppure un **segmento tratteggiato** nel vuoto del muro, allineato al muro, con gli estremi sulle spalle
     (lunghezza fra 50 cm e 1,80 m).
   Gli archi di apertura delle porte possono restare: non chiudono i locali.
4. **Nomi dei locali**: un testo (TEXT o MTEXT) **dentro** ogni locale. Nomi riconosciuti:
   - vani principali: camera, letto, soggiorno, pranzo, salotto, sala, studio, cucina (anche **K**), tinello,
     vano, stanza; i locali senza nome sono proposti come principali (la destinazione dei vani principali non è
     obbligatoria);
   - bagni: bagno, wc, w.c., servizio, doccia;
   - accessori diretti: ingresso (ingr.), corridoio, disimpegno (disimp., dis.), ripostiglio (rip.), guardaroba,
     cabina armadi, antibagno, cottura, lavanderia, dispensa, veranda, loggia chiusa, scala, vano scala;
   - accessori indiretti: cantina, soffitta, sottotetto, locale tecnico, centrale termica, lavatoio, sgombero,
     deposito, garage, autorimessa, magazzino;
   - non sono vani ma sono dell'unità: balcone, terrazzo, terrazza, loggia, portico (poligono D); giardino, corte,
     cortile, resede, aia, orto, area scoperta (poligono F);
   - non sono dell'unità (mai calcolati): tutto ciò che è **a comune** (anche scritto su due righe, «vano scale» e
     «a comune»), condominiale, androne, parti comuni, altra proprietà, altra u.i.; cavedio e vuoto non contano.
   Maiuscole e minuscole non contano; vale anche l'abbreviazione col punto. Un locale con un nome diverso
   viene proposto «da verificare».
5. **Altezze**: un testo nel locale come `h260`, `h=2,40`, `hmin 220` (cm o m). Le zone di altezza diversa dello
   stesso locale si separano con una **linea tratteggiata**: non divide il vano (se però i due lati hanno
   ciascuno il proprio nome, la linea tratteggiata è letta come porta e i vani restano due).
   I retini (HATCH) vengono ignorati. Una linea tratteggiata separa invece terrazza e giardino (o un locale e
   la terrazza) quando ciascuno ha il suo nome.
   Frecce d'ingresso, croci sulle finestre e altri simboli staccati dal disegno non disturbano: vengono ignorati,
   come le linee disegnate due volte (frequenti nei DXF esportati dai programmi BIM).
6. **Zone che non sono vani** (cavedi, vuoti, parti di altre unità): poligono G oppure una croce (X) disegnata
   nella zona con due linee continue che si incrociano a metà. I locali più stretti di 60 cm sono presi per
   muri e non contano.
7. **Scale interne**: disegna i gradini (almeno 8 alzate uguali) e scrivi «scala» nel vano scala; viene contata
   una volta sola, al piano dell'unità.
8. Una scheda per piano o più piani nella stessa scheda vanno bene entrambi: il riconoscimento lavora su tutte le
   schede DXF dell'unità.

Anche con un DXF ben preparato, **controlla sempre** la proposta prima di confermarla.

### Classamento
Per ogni unità ordinaria, **classamento proposto** e **classamento automatico** affiancati: si sceglie quale
convalidare. Scegliendo l'automatico i suoi dati passano nel proposto, dove si possono ancora modificare.
In variazione, la sezione «Dati per il classamento automatico» chiede il classamento in atti delle unità
variate o soppresse e le categorie presenti nel fabbricato con la classe più elevata.

### Elenco subalterni
**«Aggiorna»** riporta le unità del documento (e i b.c.n.c. in accatastamento) con la descrizione dal modello 1N,
conservando le righe inserite a mano. **«Importa»** legge l'elenco da un PDF Docfa o da un file `EPVnnn.DAT`.

### Cosa manca
Oltre ai controlli di Docfa, due confronti fra dichiarato e calcolato (avvisi, non bloccano):
il **quadro C** diverso dai vani confermati dal disegno, e la **consistenza** del classamento (gruppo A) diversa
di oltre il 10% da quella che risulta dal quadro C (principali + accessori diretti ⅓ + indiretti ¼).

Tutto quello che va completato o corretto, con il codice diagnostico di Docfa e la sua spiegazione.
Un clic porta al punto da correggere. Quando non manca niente: «Non manca niente: il documento si può esportare.»

### Esporta
Riepilogo, controlli e il pulsante **«Esporta NCVnnn.PDF»**, attivo quando non ci sono errori.
Il programma chiede di confermare la data di ultimazione dei lavori, poi scrive il PDF/A nella cartella
della pratica. Alla fine si può aprire il PDF o la cartella.

Il PDF si firma digitalmente e si invia con Sister, come quello di Docfa.

## 6. Importare un documento fatto con Docfa

Dalla pagina iniziale premi **«Importa da PDF Docfa»** e scegli il PDF prodotto da Docfa (accatastamento NCA o variazione NCV). Il programma mostra
un riepilogo (comune, tecnico, dichiarante, unità, planimetrie) ed eventuali avvisi; premi
**«Crea pratica»**. Le planimetrie importate vengono riusate tali e quali nel PDF.

Si importano solo i PDF prodotti da Docfa (non i file DC3 né i PDF cifrati).

## 7. Il consiglio per la presentazione

Finché l'Agenzia non si pronuncia sui file prodotti da software diversi da Docfa, la strada sicura è:
preparare la pratica con Fa.Catasto.Doc, importare il PDF nel Docfa ufficiale, eseguirne il controllo formale
e presentare.

## 8. Sostieni il progetto

Fa.Catasto.Doc è gratuito e lo resterà. Se ti è utile puoi contribuire con una donazione:
[PayPal](https://paypal.me/lombardoconsulting).
