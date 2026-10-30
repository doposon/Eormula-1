from functools import partial
from http.server import ThreadingHTTPServer
import threading,subprocess,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT
fixture=Path(tempfile.gettempdir())/'sound-lab-fixture.mp4'
subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=black:s=160x90:r=10:d=8','-f','lavfi','-i','aevalsrc=0.25*sin(2*PI*(180*t+15*t*t))+0.12*sin(2*PI*(360*t+30*t*t)):s=44100:d=8','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',str(fixture)],check=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'sound-lab/lab.js').read_text().replace('let last=performance.now();', '''window.labTest={state:()=>({playing,gear:drive.gear,rpm:drive.rpm,speed:drive.speed,nodes:engine?.nodes.length}),meter(){if(!this.a){this.a=ctx.createAnalyser();engine.master.connect(this.a);}const v=new Float32Array(this.a.fftSize);this.a.getFloatTimeDomainData(v);return Math.sqrt(v.reduce((s,x)=>s+x*x,0)/v.length);}};let last=performance.now();''')
errors=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);page=b.new_page(viewport={'width':1280,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/sound-lab/lab.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/sound-lab/');assert page.locator('#start').is_disabled()
  page.locator('#file').set_input_files(str(fixture));page.wait_for_function('!document.querySelector("#start").disabled',timeout=30000)
  assert page.locator('#clips div').count()==4
  page.locator('#start').click();page.keyboard.down('w');page.wait_for_function('labTest.state().speed>20');page.keyboard.up('w');assert page.evaluate('labTest.state().nodes')==4
  page.evaluate('labTest.meter()');page.wait_for_function('labTest.meter()>.001');page.locator('#high').click();page.wait_for_function('labTest.state().gear===7');page.locator('#stop').click();page.wait_for_function('labTest.meter()<.0001');assert not page.evaluate('labTest.state().playing')
  page.locator('#clipStart').fill('1');page.locator('#clipLength').fill('.4');page.locator('#apply').click();assert '1.00–1.40' in page.locator('#clips').inner_text()
  page.locator('#start').click();page.locator('#preview').click();assert not page.evaluate('labTest.state().playing')
  with page.expect_download() as info:page.locator('#export').click()
  out=ROOT/'test-results/sound-lab';out.mkdir(parents=True,exist_ok=True);info.value.save_as(str(out/'markers.json'))
  page.locator('#import').set_input_files(str(out/'markers.json'));page.wait_for_function('document.querySelector("#status").textContent.includes("已恢复")')
  matched=Path(tempfile.gettempdir())/'屏幕录制 2026-10-30 091321.mp4'
  subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=black:s=160x90:r=10:d=75.392','-f','lavfi','-i','aevalsrc=0.25*sin(2*PI*(180*t+15*t*t)):s=44100:d=75.392','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',str(matched)],check=True)
  page.locator('#file').set_input_files(str(matched));page.wait_for_function('document.querySelector("#status").textContent.includes("已套用")',timeout=30000)
  assert '16.00–19.00' in page.locator('#clips').inner_text()
  assert '23.00–24.00' in page.locator('#clips').inner_text()
  page.screenshot(path=str(out/'lab-preset.png'),full_page=True);assert not errors,errors;b.close();print('PASS MP4/AAC decode, audio output/silence, controls, marker round-trip and exact user preset auto-match')
finally:server.shutdown()
