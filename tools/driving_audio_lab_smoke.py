from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import threading,tempfile,subprocess,json
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT
fixture=Path(tempfile.gettempdir())/'driving-audio.wav'
subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=300:duration=4','-y',str(fixture)],check=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'sound-lab/v7/lab.js').read_text().replace('let last=performance.now();','window.driveTest=()=>({running,state:driver?.timeline.phase,gear:driver?.timeline.gear,elapsed:driver?.timeline.elapsed,banks:Object.fromEntries(keys.map(k=>[k,editors[k].snapshot()]))});let last=performance.now();')
errors=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);page=b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/v7/lab.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/sound-lab/');page.locator('#file').set_input_files(str(fixture));page.wait_for_function('!document.querySelector("#apply").disabled')
  for key in ['acceleration','braking','coast']:
   page.locator(f'#{key} .range').click();wave=page.locator(f'#{key} canvas');wave.scroll_into_view_if_needed();r=wave.bounding_box();lo,hi=(.1,.9) if key!='coast' else (.3,.4);page.mouse.move(r['x']+r['width']*lo,r['y']+80);page.mouse.down();page.mouse.move(r['x']+r['width']*hi,r['y']+80,steps=8);page.mouse.up()
  assert page.locator('#acceleration .marker-row button').count()==6;assert page.locator('#braking .marker-row button').count()==6;assert page.locator('#coast .marker-row button').count()==2
  page.locator('#apply').click();page.locator('#start').click();page.wait_for_function('driveTest().state==="silent"')
  page.keyboard.down('w');page.wait_for_function('driveTest().state==="acceleration" && driveTest().gear>=3');page.keyboard.up('w');page.wait_for_function('driveTest().state==="silent"');page.keyboard.down('s');page.wait_for_function('driveTest().state==="braking" && driveTest().gear===2');page.keyboard.up('s');page.wait_for_function('driveTest().state==="coast"');page.wait_for_function('driveTest().state==="silent"')
  page.locator('#auto').uncheck();page.locator('#up').click();g=page.evaluate('driveTest().gear');page.keyboard.down('w');page.wait_for_function('driveTest().state==="acceleration" && driveTest().elapsed>1.1');assert page.evaluate('driveTest().gear')==g;page.keyboard.up('w');page.locator('#stop').click();assert not page.evaluate('driveTest().running')
  with page.expect_download() as info:page.locator('#export').click()
  out=ROOT/'test-results/driving-audio-lab';out.mkdir(parents=True,exist_ok=True);info.value.save_as(str(out/'markers.json'));d=json.loads((out/'markers.json').read_text());assert d['version']==6 and len(d['banks']['coast']['nodes'])==2
  page.locator('#import').set_input_files(str(out/'markers.json'));page.wait_for_function('document.querySelector("#applied").textContent.includes("标记已载入")');assert not errors,errors;page.screenshot(path=str(out/'lab.png'),full_page=True);b.close();print('PASS three independent waveforms, conditional one-shot coast, W/S switching, complete-segment automatic shifts, manual gear hold and marker round-trip')
finally:server.shutdown()
