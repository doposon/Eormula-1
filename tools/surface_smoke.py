"""Validate real GLB road/kerb contacts and four-wheel suspension in Chromium."""
from functools import partial
from http.server import ThreadingHTTPServer
import json,subprocess,threading
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT

server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'src/game.js').read_text()
old=subprocess.check_output(['git','show','83a6f74:src/game.js'],cwd=ROOT,text=True)
raw=old[old.index('function spaPreciseHeightAt('):old.index('// Continuous local terrain plane')].replace('function spaPreciseHeightAt','function oldRasterHeight')
hook='''
window.surfaceTest={contacts:venueContacts,sample:venueContactAt,pose:spaGroundPose,old:oldRasterHeight,
 kerb(x,z,speed=150){const st=makeKerbSuspension();for(let i=0;i<90;i++)updateKerbSuspension(st,x,z,0,speed,1/60);return st;},
 ride(x,z,heading=0){carX=x;carZ=z;carHeading=heading;carSpeed=20;updateRideHeights(1/60);return {y:playerRideY,...playerVisualSuspension};}};
'''
source=source.replace('const keys=Object.create(null);',raw+hook+'\nconst keys=Object.create(null);')
errors=[];results={}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':1280,'height':720});page.set_default_timeout(240000);page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/game.js',lambda route:route.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.locator('.asset-loading').wait_for(state='detached');page.locator('#audioSetupSkip').click();page.locator('#practiceMode').click()
  for track in ['silverstone','singapore','spa']:
   page.evaluate("document.querySelector('#trackScreen').classList.remove('hidden');document.querySelector('#teamScreen').classList.add('hidden')")
   button=page.locator('#select'+track.title()+'Track');button.wait_for(state='visible')
   # Locator click waits for enabled status while Silverstone loads in the background.
   button.click();page.locator('#teamScreen:not(.hidden)').wait_for()
   result=page.evaluate('''track=>{
    const t=surfaceTest,kind=track==='spa'?'road':'kerb',field=t.contacts[track]?.[kind];
    if(!field?.triangles.length)throw Error(track+' has no contact geometry');
    let hits=0,maxError=0,active=0,roll=0,maxY=0,examples=[];
    for(let i=0;i<field.triangles.length;i+=Math.max(1,Math.floor(field.triangles.length/350))){
     const tri=field.triangles[i],x=(tri.a[0]+tri.b[0]+tri.c[0])/3,z=(tri.a[1]+tri.b[1]+tri.c[1])/3,y=(tri.a[2]+tri.b[2]+tri.c[2])/3;
     const contact=t.sample(track,kind,x,z,y);if(contact===null)continue;hits++;
     if(Math.abs(contact-y)>1e-3)throw Error('Triangle height mismatch');
     if(track==='spa'){
      maxError=Math.max(maxError,Math.abs(t.old(x,z)-y));
      const pose=t.pose(x,z,0);if(!Number.isFinite(pose.y)||pose.y<y-.01)throw Error('Spa clipping/invalid pose');
      maxY=Math.max(maxY,Math.abs(y));
     }else{
      // Place the front left tyre at an actual kerb centroid.
      const st=t.kerb(x-1.30,z+.67);if(st.active){active++;roll=Math.max(roll,Math.abs(st.roll));if(examples.length<3)examples.push({x:x-1.30,z:z+.67});}
     }
    }
    if(hits<10)throw Error('Too few contacts');
    if(track!=='spa'){
     if(!active||roll<.001)throw Error('Missing independent wheel/body response');
     const clear=t.kerb(99999,99999);if(clear.active||clear.heave!==0)throw Error('False kerb rumble away from kerbs');
     for(const pos of examples){const st=t.ride(pos.x,pos.z);if(!st.active||!Number.isFinite(st.heave))throw Error('Kerb not connected to ride update');}
    }
    return {triangles:field.triangles.length,hits,active,maxRoll:roll,maxOldRasterError:maxError,maxTerrainHeight:maxY};
   }''',track)
   results[track]=result;print(track,json.dumps(result),flush=True)
  assert not errors,errors
  out=ROOT/'test-results/surfaces';out.mkdir(parents=True,exist_ok=True);(out/'results.json').write_text(json.dumps(results,indent=2))
  browser.close();print('PASS real road heights, kerb footprints, independent wheel response and ride integration; no JS errors',flush=True)
finally:server.shutdown()
