from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import threading,tempfile,subprocess,json
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT
fixture=Path(tempfile.gettempdir())/'waveform-gears.wav'
subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','aevalsrc=(0.1+0.7*t/8)*sin(2*PI*300*t):s=22050:d=8','-y',str(fixture)],check=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'sound-lab/v6/lab.js').read_text().replace('drawBase();render();','window.waveTest=()=>({banks,applied,audition:audition?{offset:audition.offset,end:audition.end,factor:audition.factor,rate:audition.node.playbackRate.value}:null,peaks:peaks.length});drawBase();render();')
errors=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);page=b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/v6/lab.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/sound-lab/');page.locator('#file').set_input_files(str(fixture));page.wait_for_function('!document.querySelector("#range").disabled');assert page.evaluate('waveTest().peaks')>1000
  page.locator('#gearCount').select_option('7');page.locator('#range').click();box=page.locator('#wave').bounding_box();x=box['x'];y=box['y']+100;w=box['width'];page.mouse.move(x+w*.05,y);page.mouse.down();page.mouse.move(x+w*.95,y,steps=12);page.mouse.up();assert page.locator('#segments div').count()==7
  page.locator('#markers button').nth(1).click();page.locator('#markerTime').fill('1.5');page.locator('#markerTime').dispatch_event('change');assert page.evaluate('waveTest().banks.acceleration[1]')==1.5
  page.locator('#apply').click();assert page.locator('#run').is_enabled();page.locator('#run').click();page.wait_for_function('waveTest().audition!==null');page.locator('#stop').click();assert page.evaluate('waveTest().audition') is None
  page.locator('#mode').select_option('braking');page.locator('#range').click();box=page.locator('#wave').bounding_box();page.mouse.move(box['x']+w*.1,box['y']+100);page.mouse.down();page.mouse.move(box['x']+w*.9,box['y']+100,steps=10);page.mouse.up();assert '7 挡' in page.locator('#segments div').first.inner_text();assert '1 挡' in page.locator('#segments div').last.inner_text()
  assert page.locator('#markers button').count()==6
  assert '沿用 5 挡' in page.locator('#segments div').first.inner_text()
  page.locator('#segments button').first.click();page.wait_for_function('waveTest().audition?.factor===1.5');assert page.evaluate('waveTest().audition.rate')==1;page.locator('#stop').click()
  page.locator('#zoom').fill('2');page.locator('#zoom').dispatch_event('input');assert page.evaluate('document.querySelector("#wave").width>document.querySelector("#waveScroll").clientWidth')
  page.locator('#markers button').nth(1).click();page.locator('#markerTime').fill('999');page.locator('#markerTime').dispatch_event('change');a=page.evaluate('waveTest().banks.braking');assert a[1]<a[2];assert page.locator('#run').is_disabled()
  page.locator('#all').click();page.locator('#mode').select_option('coast');assert page.locator('#gearCount').is_disabled();page.locator('#range').click();box=page.locator('#wave').bounding_box();page.mouse.move(box['x']+w*.2,box['y']+100);page.mouse.down();page.mouse.move(box['x']+w*.3,box['y']+100);page.mouse.up();assert page.locator('#markers button').count()==2;assert page.locator('#segments div').count()==1
  for mode in ['upshift','downshift']:
   page.locator('#mode').select_option(mode);page.locator('#range').click();box=page.locator('#wave').bounding_box();page.mouse.move(box['x']+w*.4,box['y']+100);page.mouse.down();page.mouse.move(box['x']+w*.45,box['y']+100);page.mouse.up();assert page.locator('#markers button').count()==2
  with page.expect_download() as info:page.locator('#export').click()
  out=ROOT/'test-results/waveform';out.mkdir(parents=True,exist_ok=True);info.value.save_as(str(out/'markers.json'));d=json.loads((out/'markers.json').read_text());assert d['version']==5 and len(d['acceleration'])==8 and len(d['braking'])==6 and len(d['coast'])==2;assert d['extensions']['braking']['7']['sourceGear']==5
  assert len(d['upshift'])==len(d['downshift'])==2
  page.locator('#import').set_input_files(str(out/'markers.json'));page.wait_for_function('document.querySelector("#applied").textContent.includes("标记已载入")');page.locator('#apply').click();page.locator('#segments button').first.click();page.wait_for_function('waveTest().audition!==null');page.wait_for_function('waveTest().audition===null',timeout=10000)
  page.locator('#all').click();page.screenshot(path=str(out/'waveform.png'),full_page=True);assert not errors,errors;b.close();print('PASS full waveform, acceleration/braking ranges, precise markers, zoom, bounded nodes, exact segment playback and JSON round-trip')
finally:server.shutdown()
