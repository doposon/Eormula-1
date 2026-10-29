"""Exercise pause, submenus, quit/restart and the real offline download in Chromium."""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright
from smoke import QuietServer, ROOT

server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
out=ROOT/'test-results/pause';out.mkdir(parents=True,exist_ok=True)
source=(ROOT/'src/game.js').read_text()
# Observe closure state for assertions, without adding production debug hooks.
source=source.replace("const keys=Object.create(null);", "window.pauseTest=()=>({x:carX,z:carZ,paused:gamePaused,resuming:resumeCountdownActive,started:gameStarted,configured:practiceConfigured,camera:cameraMode,lap:lapStartedAt});\nconst keys=Object.create(null);")
errors=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True);page.set_default_timeout(180000)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/game.js',lambda route:route.fulfill(body=source,content_type='application/javascript'))
  base=f'http://127.0.0.1:{server.server_port}/'
  page.goto(base);page.locator('.asset-loading').wait_for(state='detached')
  page.locator('#practiceMode').click();page.locator('#selectOvalTrack').click();page.locator('#playerTeamSelect').select_option('redbull');page.locator('#confirmTeamSelection').click()
  page.wait_for_function('window.pauseTest().started')
  page.keyboard.down('w');page.wait_for_timeout(1200);page.keyboard.press('Escape');page.keyboard.up('w')
  page.locator('#pauseQuit').wait_for(state='visible');a=page.evaluate('pauseTest()');assert a['paused']
  page.wait_for_timeout(600);b=page.evaluate('pauseTest()');assert (a['x'],a['z'])==(b['x'],b['z'])
  page.locator('#pauseTrack').click();assert page.evaluate('pauseTest().camera')=='track';assert page.evaluate('pauseTest().paused')
  page.keyboard.press('Escape');page.locator('#pauseSettings').click();assert page.locator('#settingsPanel').is_visible();assert page.evaluate('pauseTest().paused')
  page.keyboard.press('Escape');page.locator('#pauseQuit').wait_for(state='visible')
  page.keyboard.press('Escape');assert page.evaluate('pauseTest().resuming');page.wait_for_function('!pauseTest().paused')
  c=page.evaluate('pauseTest()');assert c['lap']-a['lap']>=3500
  page.keyboard.press('Escape');page.locator('#pauseQuit').click();assert page.locator('#trackScreen').is_visible();assert not page.evaluate('pauseTest().configured')
  page.locator('#selectOvalTrack').click();page.locator('#playerTeamSelect').select_option('ferrari');page.locator('#confirmTeamSelection').click();page.wait_for_function('pauseTest().started')
  page.keyboard.press('Escape');page.keyboard.press('r');assert page.evaluate('pauseTest().paused');page.keyboard.press('Space');page.wait_for_function('!pauseTest().paused')
  print('PASS pause, frozen position, track/settings, resume timing, quit, new session',flush=True)
  # Download unmodified production sources, not test-instrumented source.
  page.unroute('**/src/game.js')
  with page.expect_download(timeout=180000) as info:page.locator('#downloadOffline').click()
  path=out/'Formula-Racing-2.17.2.html';info.value.save_as(str(path));assert path.stat().st_size>300_000_000
  data=path.read_text();assert '__embeddedAssets["asset-' not in data;assert 'src="src/main.js"' not in data
  offline=browser.new_page();offline.set_default_timeout(180000);offline.on('pageerror',lambda e:errors.append(str(e)))
  # HTTP transport only; file:// is prohibited by this cloud browser's admin policy.
  offline.goto(base+'test-results/pause/Formula-Racing-2.17.2.html',wait_until='domcontentloaded');offline.locator('#practiceMode').click();offline.locator('#selectOvalTrack').click();offline.locator('#confirmTeamSelection').click();offline.locator('#startLights.hidden').wait_for(state='attached');offline.keyboard.press('Escape');offline.locator('#pauseQuit').wait_for(state='visible')
  assert not errors,errors
  print('PASS self-contained HTML download and exported-game pause menu; no JS errors',flush=True)
  browser.close()
finally:server.shutdown()
