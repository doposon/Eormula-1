"""Exercise real menus, all five tracks and eleven team model selections.

Software WebGL validates startup and input, not real-device frame rates or full laps.
Run: python3 tools/smoke.py [--track oval|shanghai|silverstone|spa|singapore]
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import shutil
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    ('oval', 'mclaren', 'redbull'),
    ('shanghai', 'ferrari', 'mercedes'),
    ('silverstone', 'williams', 'alpine'),
    ('spa', 'audi', 'haas'),
    ('singapore', 'racingbulls', 'astonmartin'),
    ('oval', 'cadillac', 'redbull'),
]


class QuietServer(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def run_case(p, url, case, results_dir):
    track, player, ghost = case
    name = f'{track}-{player}'
    report = {'case': name, 'player': player, 'ghost': ghost, 'passed': False,
              'page_errors': [], 'console': [], 'failed_requests': [], 'dialogs': []}
    browser = p.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
        headless=True,
        args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 960, 'height': 540})
    page.set_default_timeout(120000)
    page.on('pageerror', lambda e: report['page_errors'].append(str(e)))
    page.on('console', lambda m: report['console'].append({'type': m.type, 'text': m.text[:1200]}))
    page.on('requestfailed', lambda r: report['failed_requests'].append(r.url))
    page.on('dialog', lambda d: (report['dialogs'].append(d.message), d.dismiss()))
    try:
        print(f'START {name}', flush=True)
        page.goto(url, wait_until='load')
        page.wait_for_selector('.asset-loading', state='detached')
        page.locator('#practiceMode').click()
        page.locator('#select' + track.title() + 'Track').click()
        page.locator('#teamScreen:not(.hidden)').wait_for(timeout=240000)
        print(f'TRACK READY {name}', flush=True)
        page.locator('#playerTeamSelect').select_option(player)
        page.locator('#npcTeamSelect').select_option(ghost)
        page.locator('#confirmTeamSelection').click()
        page.wait_for_function("document.querySelector('#teamLoadStatus').textContent.includes('CARS READY')", timeout=240000)
        page.locator('#startLights.hidden').wait_for(state='attached')
        page.keyboard.down('w')
        try:
            page.wait_for_function("parseInt(document.querySelector('.speedline').textContent, 10) > 0", timeout=30000)
            page.wait_for_timeout(800)
        finally:
            page.keyboard.up('w')
        report['telemetry'] = page.locator('#telemetry').inner_text()
        report['timing'] = page.locator('#practiceTiming').inner_text()
        report['webgl_active'] = page.evaluate("!document.querySelector('canvas').getContext('webgl').isContextLost()")
        assert report['webgl_active'], 'Lost WebGL context'
        assert not report['page_errors'], report['page_errors']
        assert not report['failed_requests'], report['failed_requests']
        assert not report['dialogs'], report['dialogs']
        fatal = [m for m in report['console'] if m['type'] == 'error' and 'favicon' not in m['text'] and '404 (File not found)' not in m['text']]
        assert not fatal, fatal
        assert re.search(r'LAP\s+1', report['timing']), report['timing']
        check_pause_resume(page)
        page.screenshot(path=str(results_dir / (name + '.png')))
        report['passed'] = True
        print(f'PASS {name}: {report["telemetry"].splitlines()[:3]}', flush=True)
    except Exception as error:
        report['failure'] = str(error)
        print(f'FAIL {name}: {error}', flush=True)
        try:
            page.screenshot(path=str(results_dir / (name + '-failed.png')), timeout=10000)
        except Exception:
            pass
    finally:
        browser.close()
        (results_dir / (name + '.json')).write_text(json.dumps(report, indent=2))
    return report


def check_pause_resume(page):
    page.keyboard.press('Space')
    page.wait_for_function("document.querySelector('#pauseTitle').textContent === 'PAUSED' && document.querySelector('#pauseTitle').parentElement.parentElement.style.display === 'flex'")
    page.keyboard.press('Space')
    page.wait_for_function("document.querySelector('#pauseTitle').parentElement.parentElement.style.display === 'none'")


def check_loading_failure(p, url):
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), headless=True, args=['--no-sandbox'])
    try:
        page = browser.new_page()
        page.route('**/assets/*.bin', lambda route: route.fulfill(status=503, body='Test resource unavailable'))
        page.goto(url)
        page.locator('.asset-loading[role="alert"]').wait_for()
        assert 'Unable to load the game' in page.locator('.asset-loading').inner_text()
        print('PASS: unavailable assets show a visible loading error', flush=True)
    finally:
        browser.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--track', choices=sorted({case[0] for case in CASES}))
    parser.add_argument('--failure-only', action='store_true')
    args = parser.parse_args()
    results_dir = ROOT / 'test-results'
    results_dir.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietServer, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            url = f'http://127.0.0.1:{server.server_port}/index.html'
            check_loading_failure(p, url)
            if args.failure_only:
                return 0
            cases = [c for c in CASES if not args.track or c[0] == args.track]
            reports = [run_case(p, url, c, results_dir) for c in cases]
        (results_dir / 'summary.json').write_text(json.dumps(reports, indent=2))
        print(f'{sum(r["passed"] for r in reports)} / {len(reports)} scenarios passed', flush=True)
        return 0 if all(r['passed'] for r in reports) else 1
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    raise SystemExit(main())
