"""Verify current resource bytes; optionally reconstruct the immutable import commit."""
from pathlib import Path
import base64
import hashlib
import json
import re
import argparse
import subprocess

ROOT = Path(__file__).resolve().parents[1]


BASELINE_COMMIT = '855a67879d5c3d76fadb51a48671048c3bff7b06'


def check(reconstruct_baseline=False):
    manifest = json.loads((ROOT / 'assets/manifest.json').read_text())
    baseline = json.loads((ROOT / 'docs/baseline.json').read_text())
    replacements = {}
    for entry in manifest['assets']:
        data = (ROOT / entry['path']).read_bytes()
        assert len(data) == entry['bytes'], entry['path']
        assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['path']
        if reconstruct_baseline:
            replacements[entry['id']] = entry['quote'] + base64.b64encode(data).decode('ascii') + entry['quote']
        assert len(data) < 50 * 1024 * 1024, 'Asset exceeds project per-file size budget'
    current_game = (ROOT / 'src/game.js').read_text()
    referenced = set(re.findall(r'__embeddedAssets\["(asset-\d+)"\]', current_game))
    assert referenced == {entry['id'] for entry in manifest['assets']}, 'Missing or unknown resource reference'
    print(f"PASS: {len(manifest['assets'])} resource hashes, sizes and code references verified.")
    if not reconstruct_baseline:
        return
    # Game code intentionally evolves. Verify the unchanged historical import,
    # never replace the user's original hashes to accommodate a new feature.
    def historical(path):
        return subprocess.check_output(['git', 'show', f'{BASELINE_COMMIT}:{path}'], cwd=ROOT).decode()
    game = historical('src/game.js')
    prefix = 'export default function startGame(__embeddedAssets) {\n'
    suffix = '\n}\n'
    assert game.startswith(prefix) and game.endswith(suffix)
    game = game[len(prefix):-len(suffix)]
    game = re.sub(r'__embeddedAssets\["(asset-\d+)"\]', lambda m: replacements[m[1]], game)
    style = historical('src/styles.css')
    assert hashlib.sha256(game.encode()).hexdigest() == baseline['script_sha256'], 'Original game logic changed'
    assert hashlib.sha256(style.encode()).hexdigest() == baseline['styles_sha256'], 'Original styles changed'
    html = historical('index.html')
    html = html.replace('<link rel="stylesheet" href="src/styles.css">\n<link rel="stylesheet" href="src/ui.css">', '<style>' + style + '</style>')
    html = html.replace('<script type="module" src="src/main.js"></script>', '<script>' + game + '</script>')
    assert hashlib.sha256(html.encode()).hexdigest() == baseline['html_sha256'], 'Baseline reconstruction differs'
    print('PASS: historical import reconstructs the original HTML SHA-256.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', action='store_true', help='Also verify historical HTML reconstruction (requires import commit)')
    check(parser.parse_args().baseline)
