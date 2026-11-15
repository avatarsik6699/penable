"""Check current Markdown links and the preserved historical change archive."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]


def check():
    errors = []
    archive = ROOT / 'docs/changes/archive'
    manifest = json.loads((archive / 'index.json').read_text())
    entries = manifest['entries']
    assert [e['number'] for e in entries] == list(range(1, 35))
    with zipfile.ZipFile(archive / manifest['archive']) as historical:
        assert set(historical.namelist()) == {e['file'] for e in entries}
        for entry in entries:
            data = historical.read(entry['file'])
            if hashlib.sha256(data).hexdigest() != entry['sha256']:
                errors.append(f"Archive hash mismatch: {entry['file']}")
    tracked = subprocess.check_output(
        ['git', 'ls-files', '--cached', '--others', '--exclude-standard'], cwd=ROOT,
        text=True,
    ).splitlines()
    documents = sorted({ROOT / name for name in tracked if name.endswith('.md')})
    checked = 0
    for path in documents:
        if not path.exists():
            continue
        source = re.sub(r'(?ms)^(```|~~~).*?^\1[^\n]*$', '', path.read_text())
        for target in re.findall(r'\]\(([^\s)]+)(?:\s+"[^"\n]*")?\)', source):
            target = target.strip('<>')
            if re.match(r'^(?:[a-z]+:|#|/)', target, re.I):
                continue
            target = unquote(target.split('#', 1)[0])
            if not target or any(c in target for c in ('[', ']', '{', '}')):
                continue
            checked += 1
            if not (path.parent / target).exists():
                errors.append(f"{path.relative_to(ROOT)}: missing {target}")
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f'Documentation: {checked} local links and {len(entries)} ZIP entries verified.')


if __name__ == '__main__':
    check()
