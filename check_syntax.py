import subprocess
import sys

files = [
    'js/app.js',
    'js/auth.js',
    'js/config.js',
    'js/mqtt-client.js',
    'js/theme-bootstrap.js',
]
ok = True
for f in files:
    result = subprocess.run(['node', '--check', f], capture_output=True, text=True)
    status = 'OK' if result.returncode == 0 else 'MISMATCH'
    if result.returncode != 0:
        ok = False
        print(f'{f}: {result.stderr.strip()}')
    else:
        print(f'{f}: {status}')

sys.exit(0 if ok else 1)
