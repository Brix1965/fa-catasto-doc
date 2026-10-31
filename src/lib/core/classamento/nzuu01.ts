/**
 * NZUU01YN di Docfa 4, funzione '1': divide i tre piani dell'unità (4 caratteri ciascuno) sul trattino
 * ("1-3" → "1", "3") e li elenca in al più 6 posizioni.
 * Area (0x26 caratteri): [0] funzione / indice del piano in errore, [1..12] tre piani, [0x0d] flag di errore
 * ('1' se un piano ha più di un trattino o una parte vuota), [0x0e..0x25] sei piani risultanti.
 */
export function nzuu01(buf: string): string {
  const b = buf.split('');
  for (let k = 0; k < 6; k++) for (let j = 0; j < 4; j++) b[0x0e + 4 * k + j] = ' ';
  let i = 1;
  let n = 0;
  b[0x0d] = '0';
  const scrivi = (s: string) => {
    n = (n + 1) % 10;
    for (let j = 0; j < 4; j++) b[0x0e + 4 * (n - 1) + j] = s[j];
  };
  while (i <= 3 && b[0x0d] === '0') {
    const p = b.slice(1 + 4 * (i - 1), 5 + 4 * (i - 1)).join('');
    if (p !== '    ') {
      const trattini = p.split('-').length - 1;
      if (trattini > 1) {
        b[0] = String(i);
        b[0x0d] = '1';
      } else {
        let w178 = '    ';
        let w180 = '    ';
        let pos = 1;
        let cnt = 0;
        while (pos <= 4) {
          const st = pos;
          let ln = 0;
          while (pos <= 4) {
            if (p[pos - 1] === '-') { pos++; break; }
            pos++; ln++;
          }
          cnt++;
          const s = p.slice(st - 1, st - 1 + ln).padEnd(4, ' ').slice(0, 4);
          if (cnt === 1) w178 = s;
          else { w180 = s; break; }
        }
        if (w178 !== '    ') scrivi(w178);
        else if (trattini === 1) { b[0] = String(i); b[0x0d] = '1'; }
        if (w180 !== '    ') scrivi(w180);
        else if (trattini === 1) { b[0] = String(i); b[0x0d] = '1'; }
      }
    }
    i++;
  }
  return b.join('');
}
