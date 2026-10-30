from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import threading,tempfile,subprocess
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT
fixture=Path(tempfile.gettempdir())/'game-audio-fixture.wav'
subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=220:duration=75.392','-y',str(fixture)],check=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'src/game.js').read_text().replace('function updateGameAudio(dt){','window.audioTest=()=>({rpm:audioState.rpm,cut:audioState.cut,gear:displayGear,nodes:gameAudioEngine?.nodes.length,volume:gameAudioEngine?.master.gain.value,started:gameStarted,paused:gamePaused});function updateGameAudio(dt){')
errors=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']);page=b.new_page();page.set_default_timeout(180000);page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/game.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.locator('.asset-loading').wait_for(state='detached')
  assert page.locator('#audioSetup').is_visible();page.locator('#audioSetupSkip').click();assert page.locator('#audioSetup').is_hidden();page.locator('#modeScreen button').filter(has_text='ENGINE SOUND').click();page.locator('#engineAudioFile').set_input_files(str(fixture))
  page.wait_for_function('audioTest().nodes===4');assert page.evaluate('audioTest().volume')<.001
  page.locator('#audioSetupContinue').click();assert page.locator('#audioSetup').is_hidden();page.locator('#practiceMode').click();page.locator('#selectOvalTrack').click();page.locator('#confirmTeamSelection').click();page.wait_for_function('audioTest().started')
  page.keyboard.down('w');page.wait_for_function('audioTest().rpm>6000 && audioTest().volume>.01');page.keyboard.up('w')
  page.keyboard.press('Escape');page.wait_for_function('audioTest().paused && audioTest().volume<.001');assert not errors,errors
  b.close();print('PASS game audio loads, follows throttle and mutes on pause')
finally:server.shutdown()
