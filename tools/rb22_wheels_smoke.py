"""Load the actual separated model and verify wheel animation reaches draw uniforms."""
from functools import partial
from http.server import ThreadingHTTPServer
import threading
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'src/game.js').read_text().replace('function drawCustomCar(viewProj){', '''window.rbTest=()=>({started:gameStarted,spin:wheelSpin,steer:frontWheelSteer,axes:npcCarAsset?.wheelAxes,centers:npcCarAsset?.wheelCenters,groups:npcCarAsset?.batches.map(b=>b.group)});
function drawCustomCar(viewProj){''')
source=source.replace('gl.uniform1f(carLoc.spin,spin);gl.uniform1f(carLoc.steer,steer);\n    gl.uniform1f(carLoc.wheelLift', '''gl.uniform1f(carLoc.spin,spin);gl.uniform1f(carLoc.steer,steer);
    if(asset===npcCarAsset){window.rbDraw??={};window.rbDraw[group]={spin:gl.getUniform(carProg,carLoc.spin),steer:gl.getUniform(carProg,carLoc.steer),front:gl.getUniform(carProg,carLoc.front),axis:Array.from(gl.getUniform(carProg,carLoc.axis)),center:Array.from(gl.getUniform(carProg,carLoc.center))};}
    gl.uniform1f(carLoc.wheelLift''')
errors=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':960,'height':540});page.set_default_timeout(180000)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.locator('.asset-loading').wait_for(state='detached')
  page.locator('#audioSetupSkip').click();page.locator('#practiceMode').click();page.locator('#selectOvalTrack').click();page.locator('#playerTeamSelect').select_option('redbull');page.locator('#confirmTeamSelection').click()
  page.wait_for_function('rbTest().started');data=page.evaluate('rbTest()');assert set(data['groups'])=={0,1,2,3,4};assert len(data['groups'])==41
  page.keyboard.down('w');page.keyboard.down('a');page.wait_for_function('Math.abs(rbTest().spin)>.1 && Math.abs(rbTest().steer)>.03')
  draws=page.evaluate('rbDraw');assert set(draws)=={'0','1','2','3','4'}
  for i in range(1,5):
   d=draws[str(i)];assert all(abs(a-b)<1e-5 for a,b in zip(d['axis'],data['axes'][i]));assert abs(d['spin'])>.1;assert d['front']==(1 if i<3 else 0);assert all(abs(a-b)<1e-5 for a,b in zip(d['center'],data['centers'][i]))
  page.keyboard.up('w');page.keyboard.up('a');page.keyboard.press('Escape')
  out=ROOT/'test-results';out.mkdir(exist_ok=True);page.screenshot(path=str(out/'rb22-wheels.png'))
  assert not errors,errors
  browser.close();print('PASS all 41 model parts, four wheel pivots, wheel spin and front-only steering uniforms')
finally:server.shutdown()
