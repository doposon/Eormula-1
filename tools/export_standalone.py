"""Export the maintained sources as one offline HTML for double-click play.

The large generated file must remain outside Git. No model resampling occurs.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def export(destination, engine_source=None):
    assets = {}
    manifest = json.loads((ROOT/'assets/manifest.json').read_text())
    for entry in manifest['assets']:
        raw = (ROOT/entry['path']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry['sha256']:
            raise ValueError('Resource checksum mismatch: '+entry['path'])
        assets[entry['id']] = entry['quote']+base64.b64encode(raw).decode('ascii')+entry['quote']
    camera = (ROOT/'src/camera.mjs').read_text().replace('export ', '')
    game = (ROOT/'src/game.js').read_text()
    statement = "import { DRIVING_CAMERAS, carBodyFrame, cockpitCamera } from './camera.mjs';"
    if game.count(statement)!=1:
        raise ValueError('Update exporter for the changed camera import')
    game = game.replace(statement,'').replace('export default function startGame', 'function startGame')
    game = game.replace("import { MarkedAudio, APPROVED_AUDIO } from './marked-audio.mjs?v=weather10';", '')
    marked_audio = (ROOT/'src/marked-audio.mjs').read_text().replace('export ', '')
    game = re.sub(r'__embeddedAssets\["(asset-\d+)"\]', lambda m:assets[m[1]], game)
    engine_path = engine_source or ROOT/'assets/engine-source.mp4'
    engine = base64.b64encode(engine_path.read_bytes()).decode('ascii') if engine_path.exists() else None
    script = "(()=>{\n'use strict';\n"+camera+'\n'+marked_audio+'\n'+game+'\nstartGame({engineAudio:'+json.dumps(engine)+'});\n})();'
    if re.search(r'</script', script, re.I):
        raise ValueError('Inline script contains an HTML closing tag')
    html = (ROOT/'index.html').read_text().replace('id="downloadOffline"', 'id="downloadOffline" hidden')
    html = re.sub(r'<div id="studioSplash"[^>]*>[\s\S]*?</div>', '', html)
    for name in ['styles','ui']:
        html = html.replace(f'<link rel="stylesheet" href="src/{name}.css">', '<style>\n'+(ROOT/f'src/{name}.css').read_text()+'\n</style>')
    html = html.replace('<script type="module" src="src/main.js?v=loading11"></script>', '<script>\n'+script+'\n</script>')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('x', encoding='utf-8', newline='\n') as output:
        output.write(html)
    print(f'Exported {destination} ({destination.stat().st_size} bytes)')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('output', type=Path, help='New output HTML path (will not overwrite a file)')
    parser.add_argument('--engine-source', type=Path, help='Original 75-second engine MP4/audio to embed')
    args=parser.parse_args()
    if args.engine_source and not args.engine_source.is_file(): parser.error('Engine source does not exist')
    export(args.output, args.engine_source)
