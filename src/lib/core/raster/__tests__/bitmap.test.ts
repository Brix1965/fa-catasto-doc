import { describe, it, expect } from 'vitest';
import { Bitmap } from '../bitmap';
import { glifoHershey, HERSHEY_SIMPLEX_JHF } from '../hershey';

describe('Bitmap', () => {
  it('impacchetta i pixel MSB-first con 1 = nero', () => {
    const bm = new Bitmap(10, 2);
    bm.setPixel(0, 0);
    bm.setPixel(9, 1);
    expect(bm.rowBytes).toBe(2);
    expect(Array.from(bm.data)).toEqual([0x80, 0x00, 0x00, 0x40]);
    expect(bm.getPixel(0, 0)).toBe(true);
    expect(bm.getPixel(1, 0)).toBe(false);
    expect(bm.getPixel(9, 1)).toBe(true);
    expect(bm.getPixel(10, 1)).toBe(false); // fuori dai bordi
    bm.setPixel(0, 0, false);
    expect(bm.getPixel(0, 0)).toBe(false);
  });

  it('linea sottile e linea spessa', () => {
    const bm = new Bitmap(20, 20);
    bm.linea(2, 10, 17, 10);
    expect(bm.contaNeri()).toBe(16);
    const sp = new Bitmap(20, 20);
    sp.linea(2, 10, 17, 10, 3);
    // 3 righe piene (9..11) più gli estremi arrotondati
    for (let x = 2; x <= 17; x++) for (let y = 9; y <= 11; y++) expect(sp.getPixel(x, y), `${x},${y}`).toBe(true);
    expect(sp.getPixel(10, 8)).toBe(false);
    expect(sp.getPixel(10, 12)).toBe(false);
  });

  it('rettangolo, poligono pieno e cerchio', () => {
    const bm = new Bitmap(30, 30);
    bm.rettangolo(5, 5, 24, 24);
    expect(bm.contaNeri()).toBe(400);
    bm.rettangolo(10, 10, 19, 19, false);
    expect(bm.contaNeri()).toBe(300);
    const pg = new Bitmap(30, 30);
    pg.poligonoPieno([[0, 0], [30, 0], [30, 30], [0, 30]]);
    expect(pg.contaNeri()).toBe(900);
    const tri = new Bitmap(40, 40);
    tri.poligonoPieno([[0, 0], [40, 0], [0, 40]]);
    expect(tri.contaNeri()).toBeGreaterThan(780);
    expect(tri.contaNeri()).toBeLessThan(840);
    const c = new Bitmap(50, 50);
    c.cerchio(25, 25, 20);
    expect(c.getPixel(45, 25)).toBe(true);
    expect(c.getPixel(5, 25)).toBe(true);
    expect(c.getPixel(25, 5)).toBe(true);
    expect(c.getPixel(25, 45)).toBe(true);
    expect(c.getPixel(25, 25)).toBe(false);
    // arco da 0 a 90 gradi: solo il quadrante in alto a destra
    const a = new Bitmap(50, 50);
    a.arco(25, 25, 20, 0, 90);
    expect(a.getPixel(45, 25)).toBe(true);
    expect(a.getPixel(25, 5)).toBe(true);
    expect(a.getPixel(5, 25)).toBe(false);
    expect(a.getPixel(25, 45)).toBe(false);
  });

  it('font Hershey: 95 glifi, altezza e avanzamenti coerenti', () => {
    expect(HERSHEY_SIMPLEX_JHF.length).toBe(95);
    const H = glifoHershey('H'.charCodeAt(0));
    expect(H.tratti.length).toBe(3);
    // la H va da y = -12 (cima) a y = 9 (base)
    const ys = H.tratti.flat().map((p) => p[1]);
    expect(Math.min(...ys)).toBe(-12);
    expect(Math.max(...ys)).toBe(9);
    expect(glifoHershey(' '.charCodeAt(0)).tratti.length).toBe(0);
    expect(glifoHershey(' '.charCodeAt(0)).avanzamento).toBe(16);
    expect(glifoHershey(1000)).toBe(glifoHershey('?'.charCodeAt(0)));
  });

  it('testo: altezza, allineamento e rotazione', () => {
    const bm = new Bitmap(200, 100);
    bm.testo(10, 60, 'H', { altezza: 30 });
    const b = bm.bboxNeri();
    expect(b).not.toBeNull();
    if (b) {
      expect(b.y1).toBe(60); // linea di base
      expect(b.y0).toBe(30); // cima delle maiuscole
      expect(b.x0).toBeGreaterThanOrEqual(10);
    }
    // centrato: il baricentro orizzontale sta sul punto di inserimento
    const c = new Bitmap(200, 100);
    c.testo(100, 60, 'HHHH', { altezza: 20, allineamentoH: 'centro' });
    const bc = c.bboxNeri();
    if (bc) expect(Math.abs((bc.x0 + bc.x1) / 2 - 100)).toBeLessThanOrEqual(2);
    // allineamento in alto: la cima sta sul punto
    const t = new Bitmap(200, 100);
    t.testo(10, 20, 'H', { altezza: 30, allineamentoV: 'alto' });
    expect(t.bboxNeri()?.y0).toBe(20);
    // ruotato di 90°: il testo sale verso l'alto a sinistra del punto
    const r = new Bitmap(200, 200);
    r.testo(100, 150, 'HHH', { altezza: 20, rotazione: 90 });
    const br = r.bboxNeri();
    if (br) {
      expect(br.y1).toBeLessThanOrEqual(150);
      expect(br.y0).toBeLessThan(110);
      expect(br.x0).toBeGreaterThanOrEqual(80);
      expect(br.x1).toBeLessThanOrEqual(100);
    }
    // monospazio: larghezza = caratteri × passo
    expect(Bitmap.larghezzaTesto('abc', { altezza: 15, passo: 14 })).toBe(42);
    const m = new Bitmap(200, 50);
    m.testo(10, 30, 'iiii', { altezza: 15, passo: 14 });
    const bmono = m.bboxNeri();
    if (bmono) expect(bmono.x1 - bmono.x0).toBeGreaterThan(40);
  });

  it('dilatazione e bbox', () => {
    const bm = new Bitmap(10, 10);
    bm.setPixel(5, 5);
    const d = bm.dilata(2);
    expect(d.contaNeri()).toBe(25);
    expect(d.bboxNeri()).toEqual({ x0: 3, y0: 3, x1: 7, y1: 7 });
    expect(new Bitmap(4, 4).bboxNeri()).toBeNull();
  });
});
