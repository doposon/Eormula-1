from functools import partial
from http.server import ThreadingHTTPServer
import threading
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'src/game.js').read_text().replace('function makePlayerLapSample(t){', '''window.replayTest={seed(){for(let i=0;i<2;i++){const now=performance.now();lapStartedAt=now-10000;playerLapDistance=1000;const a=makePlayerLapSample(0);currentPlayerLapSamples=[a,{...a,t:5000,x:a.x+10}];finishRecordedPlayerLap(now);}},state(){return {x:carX,z:carZ,speed:carSpeed,tyres:[...tyreHealth],paused:gamePaused,started:gameStarted,laps:recordedLaps.length,replay:!!replayView,camera:cameraMode,time:replayView?.time}},lock(v){tireLocked=v}};
function makePlayerLapSample(t){''')
errors=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=browser.new_page(viewport={'width':1280,'height':800});page.set_default_timeout(180000);page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.locator('.asset-loading').wait_for(state='detached');page.locator('#audioSetupSkip').click();page.locator('#practiceMode').click();page.locator('#selectOvalTrack').click();page.locator('#confirmTeamSelection').click();page.wait_for_function('replayTest.state().started')
  page.evaluate('replayTest.seed()');page.keyboard.press('Escape');before=page.evaluate('replayTest.state()');assert before['laps']==2
  page.evaluate('replayTest.lock(true)');page.locator('#lockupAlert').wait_for(state='visible');page.evaluate('replayTest.lock(false)');page.locator('#lockupAlert').wait_for(state='hidden')
  page.locator('#pauseReplay').click();assert page.locator('#replayLap option').count()==2;page.locator('#replayPlay').click()
  page.locator('#replayLap').select_option('1');page.locator('#replayPlay').click();page.locator('#replaySeek').fill('500');page.locator('#replaySeek').dispatch_event('input')
  for camera in ['chase','cockpit','halo','frontwing','rear','orbit','track']:
   page.locator('#replayCamera').select_option(camera);assert page.evaluate('replayTest.state().camera')==camera
  page.locator('#replayCamera').select_option('orbit');page.mouse.move(600,300);page.mouse.down();page.mouse.move(650,330);page.mouse.up()
  page.wait_for_timeout(200);after=page.evaluate('replayTest.state()');assert after['x']==before['x'] and after['z']==before['z'] and after['tyres']==before['tyres'];assert after['time']==5000
  page.keyboard.press('Escape');assert page.locator('#replayPanel').is_hidden();assert not page.evaluate('replayTest.state().replay');assert page.evaluate('replayTest.state().paused')
  assert not errors,errors
  browser.close();print('PASS all completed laps retained, seven cameras, seek, lock-up warning and paused live-state preservation')
finally:server.shutdown()
