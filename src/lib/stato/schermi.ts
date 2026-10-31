/**
 * Sequenza degli schermi della pratica, nell'ordine di Docfa: prima il modello D (scelta comune, quadro A o B,
 * quadro I, quadro U, quadro D/note, dichiarante), poi elaborati grafici, modelli 1N/2N, classamento, elenco
 * subalterni, controllo formale ed esportazione.
 */
import type { Pratica } from '$lib/core/model';
import type { SezionePratica } from './validazione';

export interface Schermo {
  id: SezionePratica;
  titolo: string;
  breve: string;
  gruppo: 'Modello D' | 'Funzioni';
  icona: 'mappa' | 'file' | 'persona' | 'unita' | 'elenco' | 'edificio' | 'immagine' | 'calcolo' | 'scudo' | 'pdf';
  aiuto: string;
}

export function schermiPratica(p: Pratica): Schermo[] {
  const acc = p.tipoDocumento === 'accatastamento';
  const conIntestati = acc && (p.quadroA?.ditte.some((d) => d.intestazione === 'nuova') ?? true);
  const s: (Schermo | false)[] = [
    { id: 'comune', titolo: 'Scelta comune', breve: 'Comune', gruppo: 'Modello D', icona: 'mappa',
      aiuto: "Collega il documento al comune dell'immobile. Si sceglie dalla lista dei comuni della provincia di cui sono caricati gli archivi, oppure si digita il codice catastale. Per caricare tariffe, stradari e prospetti usare «Caricamento archivi»." },
    acc
      ? { id: 'generali', titolo: 'Quadro A – Dichiarazione di fabbricato urbano', breve: 'Quadro A', gruppo: 'Modello D', icona: 'file',
        aiuto: "Per ogni ditta: tipo mappale (protocollo e data, obbligatori), ditta da intestare (nuova con intestati, oppure già in atti al C.E.U. o al C.T. indicando un identificativo con la stessa intestazione), numero delle unità ordinarie e speciali (le F tra le speciali), causale (nuova costruzione o unità afferenti) e tipologia di documento." }
      : { id: 'generali', titolo: 'Quadro B – Denuncia di variazione', breve: 'Quadro B', gruppo: 'Modello D', icona: 'file',
        aiuto: "Tipo mappale (facoltativo, ma con protocollo e data), unità soppresse/variate/costituite e unità derivate (le variate più le costituite devono essere uguali alle derivate), causale di presentazione: variazione (data di realizzazione e almeno una causale; le causali incompatibili tra loro sono disattivate) oppure unità afferenti. Infine la tipologia di documento." },
    conIntestati && { id: 'intestati', titolo: 'Quadro I – Ditta da intestare', breve: 'Quadro I', gruppo: 'Modello D', icona: 'persona',
      aiuto: "I titolari dei diritti reali: persona fisica (cognome, nome, data e comune di nascita, sesso, codice fiscale – con «Calcola»), persona giuridica (denominazione, sede, codice fiscale) o bene comune censibile. Per ognuno il titolo codificato, la quota se il titolo la prevede, il regime e, in comunione legale, l'intestato di riferimento. Le quote devono quadrare a 1000/1000." },
    { id: 'unita', titolo: 'Quadro U – Unità immobiliari', breve: 'Quadro U', gruppo: 'Modello D', icona: 'unita',
      aiuto: "Una schermata per unità: tipo operazione, identificativi (foglio e numero obbligatori; gli altri sono graffati), beni comuni censibili associati, ubicazione (fino a 4 indirizzi dallo stradario certificato, civico obbligatorio – SNC se manca – e almeno un piano) e classamento proposto. La superficie catastale si calcola dai poligoni, la rendita dalle tariffe." },
    { id: 'quadroD', titolo: acc ? 'Quadro D – B.c.n.c., note ed estremi' : 'Note relative al documento', breve: acc ? 'Quadro D' : 'Note', gruppo: 'Modello D', icona: 'elenco',
      aiuto: acc ? "Beni comuni non censibili (fino a 20, con identificativo e piani), note relative al documento e relazione tecnica (380 caratteri) ed estremi del titolo giustificativo dell'intestazione, solo se l'intestazione è discontinua rispetto alla storia catastale." : 'Note relative al documento e relazione tecnica: testo libero (380 caratteri).' },
    { id: 'dichiarante', titolo: 'Dati del dichiarante', breve: 'Dichiarante', gruppo: 'Modello D', icona: 'persona',
      aiuto: "In alto il tecnico compilatore (richiamabile dall'elenco dei tecnici memorizzati; per i dipendenti pubblici niente provincia e numero di iscrizione), in basso il dichiarante: tutti i dati sono obbligatori tranne la PEC; se manca il civico si scrive SNC." },
    { id: 'elaborati', titolo: 'Elaborati grafici', breve: 'Elaborati grafici', gruppo: 'Funzioni', icona: 'immagine',
      aiuto: "Per ogni unità si associa la planimetria (DXF vettoriale: formato e scala dal riquadro). I poligoni del layer Docfa_Poligoni (colori 1-8 = A, B, C, D, E, F, G, A2) danno le superfici per i dati metrici e la superficie catastale. Qui si associa anche l'elaborato planimetrico." },
    { id: 'modelli', titolo: 'Modelli 1N/2N', breve: 'Modelli 1N/2N', gruppo: 'Funzioni', icona: 'edificio',
      aiuto: "1N parte I per il fabbricato, 1N parte II per ogni unità ordinaria, 2N per le unità speciali. In ogni modello i quadri obbligatori sono in fucsia e il pallino diventa verde quando sono compilati; OK passa al successivo quadro obbligatorio. Il 1N parte II si può copiare tra unità della stessa categoria (le superfici lorde non si copiano)." },
    { id: 'classamento', titolo: 'Classamento', breve: 'Classamento', gruppo: 'Funzioni', icona: 'calcolo',
      aiuto: 'Validazione del classamento proposto delle unità ordinarie, con la rendita calcolata dalle tariffe del comune.' },
    { id: 'elenco', titolo: 'Elenco subalterni', breve: 'Elenco subalterni', gruppo: 'Funzioni', icona: 'elenco',
      aiuto: "Va compilato per ultimo. «Aggiorna» riporta le unità del documento (la descrizione riprende la destinazione d'uso dei modelli 1N/2N) e lascia le righe inserite a mano; «Importa» aggiunge un elenco esterno. In accatastamento i corpi di fabbrica sono obbligatori (tranne le F/1 e l'unica unità sulla particella)." },
    { id: 'controllo', titolo: 'Cosa manca – controllo formale', breve: 'Cosa manca', gruppo: 'Funzioni', icona: 'scudo',
      aiuto: "Elenco di tutto quello che manca o va corretto, schermo per schermo e unità per unità, con le regole del controllo formale di Docfa: errori di struttura (G), errori (E) e avvertimenti (W). Cliccando una voce si va al punto da completare. Il documento si salva sempre in bozza: gli errori bloccano solo l'esportazione." },
    { id: 'esporta', titolo: 'Esporta', breve: 'Esporta', gruppo: 'Funzioni', icona: 'pdf',
      aiuto: 'Produce il PDF/A da firmare digitalmente e presentare (NCAnnn.PDF o NCVnnn.PDF), con il documento, i dati metrici, l’elenco subalterni e le immagini.' },
  ];
  return s.filter(Boolean) as Schermo[];
}
