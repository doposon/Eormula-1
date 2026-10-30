"""Sample authored Spa runoff and Singapore slopes using real loaded geometry."""
from functools import partial
from http.server import ThreadingHTTPServer
import threading
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'src/game.js').read_text().replace('const keys=Object.create(null);', '''window.groundTest={fields:venueContacts,sample:venueContactAt,surface:getSurfaceAt,pose:singaporeGroundPose,
 ride(x,z){carX=x;carZ=z;carHeading=.7;carSpeed=20;playerRideY=-100;updateRideHeights(1/60);return {y:playerRideY,pose:singaporeGroundPose(x,z,.7),body:playerBodyFrame()};},
 drive(x,z,speed,throttle){carX=x;carZ=z;carSpeed=speed;keys.w=throttle;keys.s=false;for(let i=0;i<60;i++){carX=x;carZ=z;update(1/60);}keys.w=false;return carSpeed;}};
const keys=Object.create(null);''')
errors=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page();page.set_default_timeout(240000);page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.locator('.asset-loading').wait_for(state='detached');page.locator('#audioSetupSkip').click();page.locator('#practiceMode').click()
  for track in ['spa','singapore']:
   page.evaluate("document.querySelector('#trackScreen').classList.remove('hidden');document.querySelector('#teamScreen').classList.add('hidden')")
   page.locator('#select'+track.title()+'Track').click();page.locator('#teamScreen:not(.hidden)').wait_for()
   result=page.evaluate('''track=>{
    const t=groundTest,f=t.fields[track],points=field=>field.triangles.filter((_,i)=>i%Math.max(1,Math.floor(field.triangles.length/600))===0).map(q=>({x:(q.a[0]+q.b[0]+q.c[0])/3,z:(q.a[1]+q.b[1]+q.c[1])/3}));
    if(track==='spa'){
     const grass=points(f.grass).filter(p=>t.surface(p.x,p.z)==='GRASS');if(grass.length<100)throw Error('Runoff not classified');
     for(const p of points(f.road))if(t.surface(p.x,p.z)!=='ROAD')throw Error('Asphalt incorrectly slowed');
     const p=grass[0],fast=t.drive(p.x,p.z,20,true),slow=t.drive(p.x,p.z,0,true);if(fast>10||slow<=0)throw Error('Runoff drag/recovery incorrect '+fast+' '+slow);
     return {grassTriangles:f.grass.triangles.length,grassSamples:grass.length,speedAfter1sec:fast,recoverySpeed:slow};
    }
    let min=Infinity,max=-Infinity,worst=0;
    for(const p of points(f.road)){
     const contact=t.sample(track,'road',p.x,p.z,47.54),r=t.ride(p.x,p.z);
     min=Math.min(min,contact);max=Math.max(max,contact);worst=Math.max(worst,r.y-contact);
     if(r.y-contact>.156||r.y<contact||Math.abs(r.y-r.pose.y)>1e-7||!Number.isFinite(r.body.y))throw Error('Ride disconnected from mesh');
    }
    if(max-min<1)throw Error('Fixed-height road regression');return {roadTriangles:f.road.triangles.length,min,max,maxClearance:worst};
   }''',track)
   print(track,result,flush=True)
  assert not errors,errors
  browser.close();print('PASS Spa runoff drag and recovery, Singapore road height and immediate chassis contact')
finally:server.shutdown()
