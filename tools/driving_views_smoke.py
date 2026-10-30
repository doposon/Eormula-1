"""Visual regression for Spa ride height, low chase, Halo camera and driver HUD."""
from functools import partial
from http.server import ThreadingHTTPServer
import threading,json
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT

server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'src/game.js').read_text()
hook='''window.drivingTest={
 state(){return {x:carX,z:carZ,y:playerRideY,ground:spaPreciseHeightAt(carX,carZ),pose:spaGroundPose(carX,carZ,carHeading),bottom:playerBodyFrame().y+(selectedPlayerTeam==='redbull'?0:-.498330444),eye:activeCarCameraPosition,heading:carHeading};},
 freeze(){gamePaused=true;},
 menu(){gamePaused=true;resumeCountdownActive=false;pauseStartedAt=performance.now();pauseCameraMode=cameraMode;showPauseMenu();},
 speed(kmh){carSpeed=kmh<0?kmh/3.6:kmh/MAX_DASH_SPEED*MAX_WORLD_SPEED;},
 side(){cameraMode='orbit';distance=6.5;pitch=.12;yaw=-carHeading;syncCameraChoice();},
 flatProbe(){const field=venueContacts.spa.road;for(const t of field.triangles){
 const x=(t.a[0]+t.b[0]+t.c[0])/3,z=(t.a[1]+t.b[1]+t.c[1])/3;
 const p=spaGroundPose(x,z,0);if(Math.abs(p.pitch)<.005&&Math.abs(p.roll)<.005&&Math.abs(p.y-p.rawY)<.02){return {x,z,...p};}}throw Error('No flat Spa probe');}
};'''
source=source.replace('const keys=Object.create(null);',hook+'\nconst keys=Object.create(null);')
errors=[];out=ROOT/'test-results/driving-views';out.mkdir(parents=True,exist_ok=True)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':1280,'height':720});page.set_default_timeout(240000);page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/game.js',lambda route:route.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.locator('.asset-loading').wait_for(state='detached');page.locator('#practiceMode').click();page.locator('#selectSpaTrack').click();page.locator('#teamScreen:not(.hidden)').wait_for()
  for team in ['redbull','ferrari']:
   if team=='ferrari':
    page.locator('#pauseQuit').click();page.locator('#selectSpaTrack').click()
   page.locator('#playerTeamSelect').select_option(team);page.locator('#confirmTeamSelection').click();page.locator('#teamScreen.hidden').wait_for(state='attached');page.locator('#startLights.hidden').wait_for(state='attached')
   page.evaluate('drivingTest.freeze()');page.wait_for_timeout(250)
   flat=page.evaluate('drivingTest.flatProbe()');assert .0<=flat['y']-flat['rawY']<.025,flat
   state=page.evaluate('drivingTest.state()');assert state['bottom']-state['ground']<.08,state
   page.evaluate('drivingTest.side()');page.wait_for_timeout(200);page.screenshot(path=str(out/f'spa-{team}-side.png'))
   page.locator('#settingsToggle').click();page.locator('[data-view=chase]').click();page.wait_for_timeout(500)
   state=page.evaluate('drivingTest.state()');assert state['eye'][1]-state['y']<3.3,state
   page.screenshot(path=str(out/f'spa-{team}-chase.png'))
   page.locator('#settingsToggle').click();page.locator('[data-view=cockpit]').click();page.wait_for_timeout(100)
   for mode in ['halo','frontwing','rear','chase','cockpit']:
    page.keyboard.press('v');assert page.locator('.camera-choice.selected').get_attribute('data-view')==mode
    if mode=='halo':page.screenshot(path=str(out/f'spa-{team}-halo.png'))
   for speed,gear in [(0,'N'),(50,'1'),(125,'3'),(280,'7'),(-7.2,'R')]:
    page.evaluate('(speed)=>drivingTest.speed(speed)',speed);page.wait_for_function('(gear)=>document.querySelector("#hudGear").textContent===gear',arg=gear)
    assert page.locator('#hudGear').inner_text()==gear,(speed,page.locator('#hudGear').inner_text())
    assert int(page.locator('#hudSpeed').inner_text())==round(abs(speed))
   page.evaluate('drivingTest.speed(0)')
   # Return to normal pause state, then quit through the actual UI for the second team.
   page.evaluate('drivingTest.menu()');page.locator('#pauseQuit').wait_for(state='visible')
   print('PASS',team,'Spa tyre clearance, lower chase, Halo, V cycle, HUD N/1/3/7/R',flush=True)
  assert not errors,errors
  browser.close();print('PASS no uncaught browser exceptions',flush=True)
finally:server.shutdown()
