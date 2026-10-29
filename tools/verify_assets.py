"""Verify every asset, then reconstruct the original HTML in memory byte for byte."""
from pathlib import Path
import base64
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def check():
    manifest = json.loads((ROOT / 'assets/manifest.json').read_text())
    baseline = json.loads((ROOT / 'docs/baseline.json').read_text())
    replacements = {}
    for entry in manifest['assets']:
        data = (ROOT / entry['path']).read_bytes()
        assert len(data) == entry['bytes'], entry['path']
        assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']
        replacements[entry['id']] = entry['quote'] + base64.b64encode(data).decode('ascii') + entry['quote']
        assert len(data) < 50 * 1024 * 1024, 'Asset exceeds project per-file size budget'
    game = (ROOT / 'src/game.js').read_text()
    prefix = 'export default function startGame(__embeddedAssets) {\n'
    suffix = '\n}\n'
    assert game.startswith(prefix) and game.endswith(suffix)
    game = game[len(prefix):-len(suffix)]
    game = re.sub(r'__embeddedAssets\["(asset-\d+)"\]', lambda m: replacements[m[1]], game)
    style = (ROOT / 'src/styles.css').read_text()
    assert hashlib.sha256(game.encode()).hexdigest() == baseline['script_sha256'], 'Original game logic changed'
    assert hashlib.sha256(style.encode()).hexdigest() == baseline['styles_sha256'], 'Original styles changed'
    html = (ROOT / 'index.html').read_text()
    html = html.replace('<link rel="stylesheet" href="src/styles.css">\n<link rel="stylesheet" href="src/ui.css">', '<style>' + style + '</style>')
    html = html.replace('<script type="module" src="src/main.js"></script>', '<script>' + game + '</script>')
    assert hashlib.sha256(html.encode()).hexdigest() == baseline['html_sha256'], 'Baseline reconstruction differs'
    print(f"PASS: {len(replacements)} assets verified; reconstructed HTML matches original SHA-256.")


if __name__ == '__main__':
    check()
