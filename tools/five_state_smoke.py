from functools import partial
from http.server import ThreadingHTTPServer
import threading,tempfile,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT
fixture=Path(tempfile.gettempdir())/'five-state.wav'
subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=300:duration=8','-y',str(fixture)],check=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'sound-lab/v5/lab.js').read_text().replace('let last=performance.now();','window.fiveTest=()=>({state:engine?.activeState,shots:engine?.shots.length,loops:engine?.loops.length,playing,gear:drive.gear,id:drive.shiftId});let last=performance.now();')
errors=[]
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required']);page=b.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/v5/lab.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'));page.goto(f'http://127.0.0.1:{server.server_port}/sound-lab/v5/')
  assert not page.locator('#auto').is_checked();page.locator('#file').set_input_files(str(fixture));page.wait_for_function('!document.querySelector("#apply").disabled')
  for k in ['upshift','accelerate','downshift','decelerate','coast']:
   page.locator(f'#{k}-enabled').check();page.locator(f'#{k}-length').fill('.4')
  page.locator('#apply').click();page.wait_for_function('fiveTest().state==="coast"');assert page.evaluate('fiveTest().loops')==3
  page.keyboard.down('w');page.wait_for_function('fiveTest().state==="accelerate"');page.keyboard.up('w');page.keyboard.down('s');page.wait_for_function('fiveTest().state==="decelerate"');page.keyboard.up('s')
  page.locator('#up').click();page.wait_for_function('fiveTest().state==="upshift"');page.wait_for_function('fiveTest().shots===0 && fiveTest().state==="coast"');assert page.evaluate('fiveTest().id')==1
  page.locator('#down').click();page.wait_for_function('fiveTest().state==="downshift"');page.locator('#stop').click();assert not page.evaluate('fiveTest().playing')
  with page.expect_download() as info:page.locator('#export').click()
  out=ROOT/'test-results/five-state';out.mkdir(parents=True,exist_ok=True);info.value.save_as(str(out/'markers.json'));page.locator('#import').set_input_files(str(out/'markers.json'));page.wait_for_function('document.querySelector("#applied").textContent.includes("已载入标记")');page.screenshot(path=str(out/'lab.png'),full_page=True);assert not errors,errors;b.close();print('PASS five independent markers, accelerator/brake/coast, one-shot shifts, stop and marker round-trip')
finally:server.shutdown()
