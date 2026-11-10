"""Genera src/lib/core/dati/cap.generated.ts da Cap.dat (archivio distribuito con Docfa 4).
Uso: python3 tools/genera-cap.py <percorso Cap.dat> [data AAAA-MM-GG del file]
Cap.dat (Micro Focus, record di 9 caratteri): codice catastale del comune (4) + C.A.P. (5), uno per comune.
Per le città con più C.A.P. Docfa usa quello generico (Firenze 50100): il programma fa lo stesso."""
import re, sys, os, datetime
src = sys.argv[1]
b = open(src, 'rb').read()
cap = {}
for m in re.finditer(rb'@\t([A-Z][0-9]{3})([0-9]{5})\x00', b):
    cap[m.group(1).decode()] = m.group(2).decode()
righe = [f'{k}{v}' for k, v in sorted(cap.items())]
data = sys.argv[2] if len(sys.argv) > 2 else datetime.date.fromtimestamp(os.path.getmtime(src)).isoformat()
out = os.path.join(os.path.dirname(__file__), '..', 'src', 'lib', 'core', 'dati', 'cap.generated.ts')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// GENERATO da tools/genera-cap.py a partire da Cap.dat di Docfa 4.00.5 (dati pubblici dell\'Agenzia delle Entrate).\n')
    f.write('// Formato: codice catastale (4) + C.A.P. (5), separati da spazio. Un C.A.P. per comune, generico per le città\n')
    f.write('// con più C.A.P., come in Docfa.\n')
    f.write(f"export const DATA_CAP_INCORPORATI = '{data}';\n")
    f.write("export const CAP_INCORPORATI = '" + ' '.join(righe) + "';\n")
print(len(righe), 'C.A.P. ->', out)
