/**
 * Font a tratti "Hershey Simplex" (file futural.jhf del progetto Hershey Fonts), usato per i testi
 * delle planimetrie al posto di un motore di font: somiglia al font vettoriale TXT di AutoCAD.
 *
 * Licenza dei font Hershey (libera, da riportare):
 *   The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the
 *   U. S. National Bureau of Standards. The format of the Font data in this distribution was
 *   originally created by James Hurt, Cognition Inc.
 *   1. The following acknowledgements must be distributed with the font data:
 *      - The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the
 *        U. S. National Bureau of Standards.
 *      - The format of the Font data in this distribution was originally created by
 *        James Hurt, Cognition, Inc.
 *   2. The font data in this distribution may be converted into any other format *EXCEPT* the
 *      format distributed by the U.S. NTIS (which organization holds the rights to the distribution
 *      and use of the font data in that particular format).
 *
 * Formato (JHF): ogni glifo è una sequenza di coppie di caratteri; la prima coppia è
 * (margine sinistro, margine destro), le successive sono vertici (x, y) con origine nel
 * carattere "R" (82); la coppia " R" indica "penna alzata". Asse Y verso il basso: la linea
 * di base è a y = 9, le maiuscole arrivano a y = -12 (altezza delle maiuscole = 21 unità).
 * I 95 glifi corrispondono ai codici ASCII 32..126.
 */

/** Altezza delle maiuscole in unità Hershey. */
export const HERSHEY_ALTEZZA_MAIUSCOLE = 21;
/** Ordinata della linea di base in unità Hershey (asse Y verso il basso). */
export const HERSHEY_BASE = 9;
/** Profondità massima dei discendenti (g, p, q, y...) sotto la linea di base, in unità Hershey. */
export const HERSHEY_DISCENDENTE = 7;

/** Dati grezzi dei 95 glifi (ASCII 32..126) nel formato JHF. */
export const HERSHEY_SIMPLEX_JHF: readonly string[] = [
  'JZ',
  'MWRFRT RRYQZR[SZRY',
  'JZNFNM RVFVM',
  'H]SBLb RYBRb RLOZO RKUYU',
  'H\\PBP_ RTBT_ RYIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX',
  'F^[FI[ RNFPHPJOLMMKMIKIIJGLFNFPGSHVHYG[F RWTUUTWTYV[X[ZZ[X[VYTWT',
  'E_\\O\\N[MZMYNXPVUTXRZP[L[JZIYHWHUISJRQNRMSKSIRGPFNGMIMKNNPQUXWZY[[[\\Z\\Y',
  'MWRHQGRFSGSIRKQL',
  'KYVBTDRGPKOPOTPYR]T`Vb',
  'KYNBPDRGTKUPUTTYR]P`Nb',
  'JZRLRX RMOWU RWOMU',
  'E_RIR[ RIR[R',
  'NVSWRXQWRVSWSYQ[',
  'E_IR[R',
  'NVRVQWRXSWRV',
  'G][BIb',
  'H\\QFNGLJKOKRLWNZQ[S[VZXWYRYOXJVGSFQF',
  'H\\NJPISFS[',
  'H\\LKLJMHNGPFTFVGWHXJXLWNUQK[Y[',
  'H\\MFXFRNUNWOXPYSYUXXVZS[P[MZLYKW',
  'H\\UFKTZT RUFU[',
  'H\\WFMFLOMNPMSMVNXPYSYUXXVZS[P[MZLYKW',
  'H\\XIWGTFRFOGMJLOLTMXOZR[S[VZXXYUYTXQVOSNRNOOMQLT',
  'H\\YFO[ RKFYF',
  'H\\PFMGLILKMMONSOVPXRYTYWXYWZT[P[MZLYKWKTLRNPQOUNWMXKXIWGTFPF',
  'H\\XMWPURRSQSNRLPKMKLLINGQFRFUGWIXMXRWWUZR[P[MZLX',
  'NVROQPRQSPRO RRVQWRXSWRV',
  'NVROQPRQSPRO RSWRXQWRVSWSYQ[',
  'F^ZIJRZ[',
  'E_IO[O RIU[U',
  'F^JIZRJ[',
  'I[LKLJMHNGPFTFVGWHXJXLWNVORQRT RRYQZR[SZRY',
  'E`WNVLTKQKOLNMMPMSNUPVSVUUVS RQKOMNPNSOUPV RWKVSVUXVZV\\T]Q]O\\L[JYHWGTFQFNGLHJJILHOHRIUJWLYNZQ[T[WZYYZX RXKWSWUXV',
  'I[RFJ[ RRFZ[ RMTWT',
  'G\\KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K[',
  'H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV',
  'G\\KFK[ RKFRFUGWIXKYNYSXVWXUZR[K[',
  'H[LFL[ RLFYF RLPTP RL[Y[',
  'HZLFL[ RLFYF RLPTP',
  'H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS',
  'G]KFK[ RYFY[ RKPYP',
  'NVRFR[',
  'JZVFVVUYTZR[P[NZMYLVLT',
  'G\\KFK[ RYFKT RPOY[',
  'HYLFL[ RL[X[',
  'F^JFJ[ RJFR[ RZFR[ RZFZ[',
  'G]KFK[ RKFY[ RYFY[',
  'G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF',
  'G\\KFK[ RKFTFWGXHYJYMXOWPTQKQ',
  'G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]',
  'G\\KFK[ RKFTFWGXHYJYLXNWOTPKP RRPY[',
  'H\\YIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX',
  'JZRFR[ RKFYF',
  'G]KFKULXNZQ[S[VZXXYUYF',
  'I[JFR[ RZFR[',
  'F^HFM[ RRFM[ RRFW[ R\\FW[',
  'H\\KFY[ RYFK[',
  'I[JFRPR[ RZFRP',
  'H\\YFK[ RKFYF RK[Y[',
  'KYOBOb RPBPb ROBVB RObVb',
  'KYKFY^',
  'KYTBTb RUBUb RNBUB RNbUb',
  'JZRDJR RRDZR',
  'I[Ib[b',
  'NVSKQMQORPSORNQO',
  'I\\XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX',
  'H[LFL[ RLPNNPMSMUNWPXSXUWXUZS[P[NZLX',
  'I[XPVNTMQMONMPLSLUMXOZQ[T[VZXX',
  'I\\XFX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX',
  'I[LSXSXQWOVNTMQMONMPLSLUMXOZQ[T[VZXX',
  'MYWFUFSGRJR[ ROMVM',
  'I\\XMX]W`VaTbQbOa RXPVNTMQMONMPLSLUMXOZQ[T[VZXX',
  'I\\MFM[ RMQPNRMUMWNXQX[',
  'NVQFRGSFREQF RRMR[',
  'MWRFSGTFSERF RSMS^RaPbNb',
  'IZMFM[ RWMMW RQSX[',
  'NVRFR[',
  'CaGMG[ RGQJNLMOMQNRQR[ RRQUNWMZM\\N]Q][',
  'I\\MMM[ RMQPNRMUMWNXQX[',
  'I\\QMONMPLSLUMXOZQ[T[VZXXYUYSXPVNTMQM',
  'H[LMLb RLPNNPMSMUNWPXSXUWXUZS[P[NZLX',
  'I\\XMXb RXPVNTMQMONMPLSLUMXOZQ[T[VZXX',
  'KXOMO[ ROSPPRNTMWM',
  'J[XPWNTMQMNNMPNRPSUTWUXWXXWZT[Q[NZMX',
  'MYRFRWSZU[W[ ROMVM',
  'I\\MMMWNZP[S[UZXW RXMX[',
  'JZLMR[ RXMR[',
  'G]JMN[ RRMN[ RRMV[ RZMV[',
  'J[MMX[ RXMM[',
  'JZLMR[ RXMR[P_NaLbKb',
  'J[XMM[ RMMXM RM[X[',
  'KYTBRCQDPFPHQJRKSMSOQQ RRCQEQGRISJTLTNSPORSTTVTXSZR[Q]Q_Ra RQSSUSWRYQZP\\P^Q`RaTb',
  'NVRBRb',
  'KYPBRCSDTFTHSJRKQMQOSQ RRCSESGRIQJPLPNQPURQTPVPXQZR[S]S_Ra RSSQUQWRYSZT\\T^S`RaPb',
  'F^IUISJPLONOPPTSVTXTZS[Q RISJQLPNPPQTTVUXUZT[Q[O',
];

/** Un tratto (polilinea) di un glifo, in unità Hershey. */
export type TrattoGlifo = [number, number][];

export interface Glifo {
  /** margine sinistro (x negativo) */
  sinistra: number;
  /** margine destro */
  destra: number;
  /** avanzamento orizzontale = destra - sinistra */
  avanzamento: number;
  tratti: TrattoGlifo[];
}

const cache = new Map<number, Glifo>();

/** Decodifica il glifo di un codice ASCII (32..126); i caratteri fuori intervallo diventano "?". */
export function glifoHershey(codice: number): Glifo {
  const idx = codice >= 32 && codice <= 126 ? codice - 32 : 63 - 32;
  const c = cache.get(idx);
  if (c) return c;
  const d = HERSHEY_SIMPLEX_JHF[idx];
  const sinistra = d.charCodeAt(0) - 82;
  const destra = d.charCodeAt(1) - 82;
  const tratti: TrattoGlifo[] = [];
  let corrente: TrattoGlifo = [];
  for (let i = 2; i < d.length; i += 2) {
    if (d[i] === ' ' && d[i + 1] === 'R') {
      if (corrente.length) tratti.push(corrente);
      corrente = [];
    } else {
      corrente.push([d.charCodeAt(i) - 82, d.charCodeAt(i + 1) - 82]);
    }
  }
  if (corrente.length) tratti.push(corrente);
  const g: Glifo = { sinistra, destra, avanzamento: destra - sinistra, tratti };
  cache.set(idx, g);
  return g;
}
