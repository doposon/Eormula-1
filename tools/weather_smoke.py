"""Browser checks for five weather states, wet braking/grip, persistence and audio restore."""
from functools import partial
from http.server import ThreadingHTTPServer
import threading, tempfile, wave
from pathlib import Path
from playwright.sync_api import sync_playwright
from smoke import QuietServer, ROOT
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'src/game.js').read_text().replace('function makePlayerLapSample(t){', '''window.weatherTest={async ready(){await coreModelLoadPromise;return gl.getError()},frame(){draw(performance.now(),.016);return gl.getError()},start(){updateStartLights(performance.now()+10000)},state(){return {key:weatherKey,grip:tyreGripAt(0),audio:!!gameAudioEngine,started:gameStarted,glError:gl.getError()}},brake(){tyreWearEnabled=false;tyreHealth.fill(100);travelHeading=0;tireRecovery=0;steeringInput=0;carX=-20;carZ=0;carHeading=0;carSpeed=15;brakePressure=0;brakeHoldTime=0;tireLocked=false;clearDriveKeys();keys.s=true;for(let i=0;i<10;i++)update(.04);clearDriveKeys();return carSpeed;}};
function makePlayerLapSample(t){''')
source=source.replace('requestAnimationFrame(loop);','')
errors=[]
try:
 with sync_playwright() as p, tempfile.TemporaryDirectory() as tmp:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':1280,'height':800},device_scale_factor=.25);page.set_default_timeout(180000)
  page.on('console',lambda e:print('CONSOLE',e.text[:1400],flush=True) if e.type=='error' else None)
  page.on('pageerror',lambda e:(errors.append(str(e)),print('BROWSER ERROR',str(e),flush=True)))
  page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.locator('.asset-loading').wait_for(state='detached')
  page.wait_for_function('!!window.weatherTest');assert page.evaluate('weatherTest.ready()')==0;page.locator('#audioSetupSkip').click()
  print('startup ready',flush=True);page.locator('#practiceMode').click();page.locator('#selectOvalTrack').click()
  grip=[];braking=[]
  for key in ['sunny','cloudy','light','medium','heavy']:
   page.locator('#practiceWeather').select_option(key)
   assert page.locator('#settingsWeather').input_value()==key
   assert page.evaluate('weatherTest.frame()')==0;state=page.evaluate('weatherTest.state()');grip.append(state['grip']);assert state['glError']==0,state
   braking.append(page.evaluate('weatherTest.brake()'))
  print('weather checked',flush=True);assert grip[0]==grip[1] and all(grip[i]>grip[i+1] for i in range(1,4)),grip
  assert braking[0]==braking[1] and all(braking[i]<braking[i+1] for i in range(1,4)),braking
  page.locator('#confirmTeamSelection').click();page.wait_for_function("document.querySelector('#startLights').classList.contains('hidden')===false");page.evaluate('weatherTest.start()');page.wait_for_function('weatherTest.state().started')
  page.keyboard.press('Escape');page.locator('#pauseSettings').click();page.locator('#settingsWeather').select_option('light')
  assert page.locator('#practiceWeather').input_value()=='light'
  print('reloading',flush=True);page.reload();page.locator('.asset-loading').wait_for(state='detached');page.wait_for_function('!!window.weatherTest')
  assert page.locator('#practiceWeather').input_value()=='light'
  # A generated silent recording verifies decoding/cache lifecycle, not source sound quality.
  wav=Path(tmp)/'engine.wav'
  with wave.open(str(wav),'wb') as f:
   f.setparams((1,2,8000,0,'NONE','not compressed'));f.writeframes(b'\0\0'*round(75.392*8000))
  print('uploading audio fixture',flush=True);page.locator('#engineAudioFile').set_input_files(str(wav));page.wait_for_function('weatherTest.state().audio')
  page.wait_for_function("document.querySelector('#engineAudioStatus').textContent.includes('saved')")
  print('reloading',flush=True);page.reload();page.locator('.asset-loading').wait_for(state='detached');page.wait_for_function('weatherTest.state().audio')
  assert page.locator('#audioSetup').is_hidden()
  assert page.evaluate('window.__engineSourceBase64.length')>1000
  assert not errors,errors
  browser.close()
  print('PASS five presets, synchronized menus, decreasing wet grip, longer braking, persistence, audio cache and WebGL shaders; grip=',grip,'braking=',braking)
finally:server.shutdown()
