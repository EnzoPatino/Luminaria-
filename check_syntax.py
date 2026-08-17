import re, sys

files = ['js/app.js', 'js/mqtt-client.js']
ok = True
for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        s = fp.read()
    # Quitar strings y comentarios para contar llaves reales
    s2 = re.sub(r'//.*', '', s)
    s2 = re.sub(r'/\*.*?\*/', '', s2, flags=re.DOTALL)
    s2 = re.sub(r"'(?:\\.|[^'\\])*'", '', s2)
    s2 = re.sub(r'"(?:\\.|[^"\\])*"', '', s2)
    s2 = re.sub(r'`(?:\\.|[^`\\])*`', '', s2)
    b = s2.count('{') - s2.count('}')
    p = s2.count('(') - s2.count(')')
    k = s2.count('[') - s2.count(']')
    status = 'OK' if b == 0 and p == 0 and k == 0 else 'MISMATCH'
    if status == 'MISMATCH':
        ok = False
    print(f'{f}: braces={b} parens={p} brackets={k} -> {status}')

sys.exit(0 if ok else 1)
