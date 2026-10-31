from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
hook='''window.checkReplay=async()=>{await coreModelLoadPromise;await gameAudioContext.resume();gameStarted=true;gamePaused=true;weatherKey='heavy';const t=performance.now();const a=makePlayerLapSample(0),b={...a,t:10000,x:a.x+10};a.audio={gear:3,phase:'acceleration',intent:'acceleration',elapsed:.2};b.audio={...a.audio};recordedLaps=[{duration:10000,samples:[a,b]}];chooseReplayLap();replayView.last=t;drawReplayFrame(t+100,.016);updateGameAudio(.016);const lensVisible=lensRain.style.display==='block';const first={rain:rainClock,active:gameAudioEngine.active,nodes:gameAudioEngine.nodes.length,gear:gameAudioEngine.timeline.gear};drawReplayFrame(t+300,.016);updateGameAudio(.016);const second=rainClock;replayView.playing=false;drawReplayFrame(t+500,.016);updateGameAudio(.016);const paused={rain:rainClock,active:gameAudioEngine.active,nodes:gameAudioEngine.nodes.length};replayView.time=5000;drawReplayFrame(t+600,.016);updateGameAudio(.016);const seek=rainClock;closeReplay();const image=lensCtx.getImageData(0,0,lensRain.width,lensRain.height).data;const droplets=image.some((v,i)=>i%4===3&&v>0);return {lensVisible,droplets,first,second,paused,seek,error:gl.getError()}};'''
source=(root/'src/game.js').read_text().replace('function makePlayerLapSample(t){',hook+'\nfunction makePlayerLapSample(t){').replace('requestAnimationFrame(loop);','')
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
  page=browser.new_page(device_scale_factor=.25);page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('window.checkReplay && window.__engineSourceBase64')
  result=page.evaluate('checkReplay()');print(result,flush=True)
  assert result['lensVisible'] and result['droplets']
  assert result['first']['active'] and result['first']['nodes']>0 and result['first']['gear']==3
  assert result['second']>result['first']['rain'] and result['paused']['rain']==result['second']
  assert not result['paused']['active'] and result['paused']['nodes']==0 and result['seek']==5
  assert result['error']==0 and not errors,errors
  print('PASS real game replay: audio sources play while game paused, pause mutes, rain animates/freezes/seeks with replay clock')
  browser.close()
finally:server.shutdown()
