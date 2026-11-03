import { describe, expect, it } from 'vitest';
import { confronta } from '../aggiornamenti';

const app = { versione: '0.4.0', commit: '995daec', data: '2026-11-02T18:40:00Z' };
const body = (commit: string) => `<!-- fa-catasto-doc versione=0.4.1 commit=${commit} -->\nUltima versione…\n\n## Novità\n\n- Avviso di nuova versione\n- Correzioni\n\n## Installazione\n…`;

describe('avviso di nuova versione', () => {
  it('release nuova: avviso con versione, data e novità', () => {
    const n = confronta({ name: 'Fa.Catasto.Doc 0.4.1 – ultima versione', body: body('abc1234'), html_url: 'https://x/rel', published_at: '2026-11-03T09:20:00Z' }, app);
    expect(n).toMatchObject({ versione: '0.4.1', commit: 'abc1234', quando: '03/11/2026 10:20', novita: ['Avviso di nuova versione', 'Correzioni'], url: 'https://x/rel' });
  });
  it('stessa build: nessun avviso', () => {
    expect(confronta({ body: body('995daec'), published_at: '2026-11-02T18:56:00Z' }, app)).toBeNull();
  });
  it('release vecchia (solo «dal commit») o anteriore alla build: nessun avviso', () => {
    expect(confronta({ body: 'generata … dal commit 236026c.', published_at: '2026-11-02T16:13:00Z' }, app)).toBeNull();
  });
  it('release del vecchio formato più recente: avviso anche senza marcatore', () => {
    expect(confronta({ name: 'Fa.Catasto.Doc – ultima versione', body: 'generata … dal commit 1234567.', published_at: '2026-11-04T08:00:00Z' }, app)).toMatchObject({ commit: '1234567', versione: '' });
  });
  it('build senza commit (sviluppo): nessun avviso', () => {
    expect(confronta({ body: body('abc1234'), published_at: '2026-11-03T09:20:00Z' }, { ...app, commit: '' })).toBeNull();
  });
});
