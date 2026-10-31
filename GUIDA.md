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
- **OK non blocca**: se mancano dati il programma lo dice («mancano ancora N dati») e prosegue.
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
- Numerazione delle immagini che parte da 9000001, lontana da quella di Docfa (che parte da 1): evita il
  messaggio «alcune planimetrie non importate» quando si importa il documento in Docfa.

**Compilazione assistita**
- **Rendita calcolata dalle tariffe**, con la formula mostrata.
- **Classamento proposto e automatico affiancati**: si sceglie quale convalidare e i dati restano modificabili.
- **Codice fiscale calcolato** con il pulsante «Calcola».
- **Tecnici memorizzati** (fino a 20) e riproposti nei documenti successivi.
- **Nuova unità precompilata** con foglio, particella, indirizzo e piano della precedente.
- **Copia del modello 1N parte II** su più unità della stessa categoria in un colpo solo.
- **Causali incompatibili disattivate**, con il motivo.
- **Indirizzo del dichiarante sistemato in automatico**: accentate, apostrofi tipografici e «°» vengono
  convertiti nei caratteri ammessi da Docfa.
- **Indirizzi dallo stradario certificato** con ricerca mentre si scrive; se la strada non c'è si può usare
  esplicitamente un indirizzo non certificato.
- Date sempre nel formato gg/mm/aaaa: le barre si inseriscono da sole.

**Importazione da Docfa**
- Un **PDF prodotto da Docfa** si importa e diventa una pratica modificabile, con dati, planimetrie e poligoni.
- L'elenco subalterni si può importare da un PDF Docfa o da un file `EPVnnn.DAT`.

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
| Ctrl+O | OK: passa allo schermo (o all'unità) successivo |
| Esc | Annulla: scarta le modifiche fatte nello schermo e torna al precedente |
| F1 | Aiuto dello schermo |
| Ctrl+S | Salva subito (comunque il salvataggio è automatico) |
| Ctrl+N | Nuovo documento (dalla pagina iniziale) |

Su macOS al posto di Ctrl si può usare Cmd.

**Campi obbligatori** in fucsia con l'asterisco; un bordo ambra indica un valore non valido.

> **Attenzione nei modelli 1N/2N**: per chiudere un modello usa **«OK»** o **«Chiudi»**. Esc annulla
> le modifiche dell'intero schermo Modelli.

Il titolo della pratica si modifica cliccandoci sopra.

## 5. Gli schermi

### Comune
Scegli la provincia e cerca il comune, oppure digita direttamente il codice catastale (es. D612).
Il comune amministrativo si compila da solo.

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

### Quadro D (accatastamento) / Note
Beni comuni non censibili (fino a 20) ed estremi del titolo giustificativo; note e relazione tecnica
(massimo 380 caratteri).

### Dichiarante
Tecnico compilatore (scegliendolo dalla tendina dei tecnici memorizzati) e dichiarante.

### Elaborati grafici
1. Scegli l'unità e premi **«Aggiungi planimetria»**, poi **«Carica DXF»**.
2. Il DXF va disegnato su uno dei riquadri dell'Agenzia (A4 o A3, scala 1:100, 1:200 o 1:500) con i poligoni
   sul layer `DOCFA_POLIGONI` (colore 1 = A, 2 = B, 3 = C, 4 = D, 5 = E, 6 = F, 7 = G, 8 = A2).
   Il DXF deve essere in formato testo (ASCII), non binario.
3. Se il DXF aveva problemi compare il riquadro verde **«Corretto automaticamente»** con l'elenco delle correzioni.
4. Controlla l'anteprima e la tabella dei poligoni: tipo, superficie, altezza inferiore a 1,50 m.
   I dati metrici si compilano da soli.
5. Per una planimetria su più fogli usa **«Aggiungi scheda»**.

Il numero immagine si può modificare se coincide con un'immagine già presente in Docfa.

L'**elaborato planimetrico** (con l'indicazione se è obbligatorio e perché) si associa dallo stesso schermo
e può avere più schede.

### Modelli 1N/2N
- **1N parte I**: un modello per il documento; le sigle dei quadri sono verdi quando compilati, fucsia se obbligatori.
- **1N parte II**: uno per unità. Le superfici lorde vengono dai poligoni. Con **«Copia»** e **«Incolla»** si copia
  il modello su altre unità della stessa categoria.
- **2N**: per le unità a destinazione speciale e particolare (gruppi D ed E).

Nell'editor «OK (Ctrl+O)» porta al prossimo quadro obbligatorio ancora da compilare.

### Classamento
Per ogni unità ordinaria, **classamento proposto** e **classamento automatico** affiancati: si sceglie quale
convalidare. Scegliendo l'automatico i suoi dati passano nel proposto, dove si possono ancora modificare.
In variazione, la sezione «Dati per il classamento automatico» chiede il classamento in atti delle unità
variate o soppresse e le categorie presenti nel fabbricato con la classe più elevata.

### Elenco subalterni
**«Aggiorna»** riporta le unità del documento (e i b.c.n.c. in accatastamento) con la descrizione dal modello 1N,
conservando le righe inserite a mano. **«Importa»** legge l'elenco da un PDF Docfa o da un file `EPVnnn.DAT`.

### Cosa manca
Tutto quello che va completato o corretto, con il codice diagnostico di Docfa e la sua spiegazione.
Un clic porta al punto da correggere. Quando non manca niente: «Non manca niente: il documento si può esportare.»

### Esporta
Riepilogo, controlli e il pulsante **«Esporta NCVnnn.PDF»**, attivo quando non ci sono errori.
Il programma chiede di confermare la data di ultimazione dei lavori, poi scrive il PDF/A nella cartella
della pratica. Alla fine si può aprire il PDF o la cartella.

Il PDF si firma digitalmente e si invia con Sister, come quello di Docfa.

## 6. Importare un documento fatto con Docfa

Dalla pagina iniziale premi **«Importa da PDF Docfa»** e scegli il PDF prodotto da Docfa. Il programma mostra
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
