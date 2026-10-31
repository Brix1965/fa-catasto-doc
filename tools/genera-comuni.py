"""Genera src/lib/core/dati/comuni.generated.ts da Comuni.dat (archivio distribuito con Docfa 4).
Uso: python3 tools/genera-comuni.py <percorso Comuni.dat> [data AAAA-MM-GG del file]
Il risultato è l'elenco dei comuni incorporato nel programma: chi importa un Comuni.dat più recente lo sostituisce."""
import re, sys, os, datetime
src = sys.argv[1]
b = open(src, 'rb').read().decode('cp1252')
righe = []
for m in re.finditer(r'@F(.{5})(.{50})(.{4})(.{2})(.)', b):
    amm, nome, cod, prov = m.group(1).strip(), m.group(2).strip(), m.group(3).strip(), m.group(4).strip()
    if not re.fullmatch(r'[A-Z]\d{3}', cod): continue
    righe.append(f'{cod}|{nome}|{prov}|{amm}')
righe.sort()
data = sys.argv[2] if len(sys.argv) > 2 else datetime.date.fromtimestamp(os.path.getmtime(src)).isoformat()
out = os.path.join(os.path.dirname(__file__), '..', 'src', 'lib', 'core', 'dati', 'comuni.generated.ts')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// GENERATO da tools/genera-comuni.py a partire da Comuni.dat di Docfa 4.00.5 (dati pubblici dell\'Agenzia delle Entrate).\n')
    f.write('// Formato: codice catastale|nome|provincia|codice amministrativo, una riga per comune.\n')
    f.write(f"export const DATA_COMUNI_INCORPORATI = '{data}';\n")
    f.write('export const COMUNI_INCORPORATI = `' + '\n'.join(righe).replace('`', "'") + '`;\n')
print(len(righe), 'comuni ->', out)
