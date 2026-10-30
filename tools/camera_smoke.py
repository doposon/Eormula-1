"""Browser camera regression: RB22/SF26 cockpits, five circuits, four-view cycling.

Test-only routing can omit the player's draw call for a pixel comparison. No
debug controls or hooks are shipped in the production game.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from io import BytesIO
import argparse
import json
from pathlib import Path
import threading
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
from smoke import QuietServer, ROOT

TEAMS = ['mclaren','redbull','ferrari','mercedes','williams','alpine','audi','haas','racingbulls','astonmartin','cadillac']


def frame(page):
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--team', choices=['redbull','ferrari'], help='Only check this team on Oval')
    args = parser.parse_args()
    output = ROOT / 'test-results/cameras'
    output.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietServer, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    errors, dialogs, results = [], [], []
    source = (ROOT / 'src/game.js').read_text()
    needle = "if(!['frontwing','rear'].includes(cameraMode)&&!drawCustomCar(mvp))"
    assert source.count(needle) == 1
    source = source.replace(needle, "if(!window.__testHidePlayer&&!['frontwing','rear'].includes(cameraMode)&&!drawCustomCar(mvp))")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            page = browser.new_page(viewport={'width':1280,'height':720})
            page.set_default_timeout(180000)
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('dialog', lambda d: (dialogs.append(d.message), d.dismiss()))
            page.route('**/src/game.js', lambda route: route.fulfill(body=source, content_type='application/javascript'))
            page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
            page.wait_for_selector('.asset-loading', state='detached')
            page.locator('#audioSetupSkip').click();page.locator('#practiceMode').click()
            scenarios = [('oval','redbull'),('oval','ferrari'),('shanghai','ferrari'),('silverstone','redbull'),('spa','ferrari'),('singapore','redbull')]
            if args.team:
                scenarios = [('oval', args.team)]
            for track, team in scenarios:
                print(f'START camera {track}/{team}', flush=True)
                # Expose the existing selection dialog between scenarios; this
                # avoids downloading all resources fifteen times just for setup.
                page.evaluate("document.querySelector('#trackScreen').classList.remove('hidden')")
                page.locator('#select'+track.title()+'Track').click()
                page.locator('#teamScreen:not(.hidden)').wait_for(timeout=240000)
                page.locator('#playerTeamSelect').select_option(team)
                page.locator('#confirmTeamSelection').click()
                page.locator('#teamScreen.hidden').wait_for(state='attached')
                page.locator('#startLights.hidden').wait_for(state='attached')
                page.locator('#settingsToggle').click()
                page.locator('[data-view=cockpit]').click()
                frame(page)
                visible = page.screenshot(path=str(output / f'{track}-{team}-cockpit.png'))
                page.evaluate('window.__testHidePlayer=true')
                frame(page)
                hidden = page.screenshot()
                page.evaluate('window.__testHidePlayer=false')
                frame(page)
                # Exclude animated HUD/timers; nearby car geometry must visibly
                # occupy this lower-central viewport, rather than just the road.
                roi = (190, 325, 995, 700)
                diff = ImageChops.difference(Image.open(BytesIO(visible)).convert('RGB').crop(roi), Image.open(BytesIO(hidden)).convert('RGB').crop(roi))
                changed = sum(max(pixel)>25 for pixel in diff.get_flattened_data()) / (diff.width*diff.height)
                assert changed>.10, f'{team} cockpit contains too little visible body: {changed:.3f}'
                for mode in ['halo','frontwing','rear','chase','cockpit']:
                    page.keyboard.press('v')
                    assert page.locator('.camera-choice.selected').get_attribute('data-view') == mode
                    frame(page)
                    if track=='oval':
                        page.screenshot(path=str(output/f'oval-{team}-{mode}.png'))
                assert page.evaluate("!document.querySelector('canvas').getContext('webgl').isContextLost()")
                page.keyboard.down('w')
                try:
                    page.wait_for_function("parseInt(document.querySelector('.speedline').textContent,10)>0",timeout=30000)
                finally:
                    page.keyboard.up('w')
                assert not errors, errors
                assert not dialogs, dialogs
                results.append({'track':track,'team':team,'body_pixel_fraction':round(changed,3),'passed':True})
                print(f'PASS camera {track}/{team}: visible body {changed:.1%}', flush=True)
            browser.close()
        assert len(results)==len(scenarios)
    finally:
        report_name = f'results-{args.team}.json' if args.team else 'results.json'
        (output/report_name).write_text(json.dumps({'scenarios':results,'errors':errors,'dialogs':dialogs},indent=2))
        server.shutdown()
        server.server_close()


if __name__=='__main__':
    main()
