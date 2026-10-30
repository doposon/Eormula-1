"""Real-track slope alignment and an adversarial zero-alpha road render check."""
from functools import partial
from http.server import ThreadingHTTPServer
import threading,json
from io import BytesIO
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright
from smoke import QuietServer,ROOT

server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
s=(ROOT/'src/game.js').read_text()
hook='''window.bankTest={
 check(){let count=0,worst=0;const f=venueContacts.spa.road;
 for(let i=0;i<f.triangles.length;i+=53){const t=f.triangles[i],x=(t.a[0]+t.b[0]+t.c[0])/3,z=(t.a[1]+t.b[1]+t.c[1])/3;
 const p=venueContactAt('spa','road',x,z,0,true);
 for(const h of [0,.7,1.57])for(const team of ['redbull','ferrari']){
 const pose=spaGroundPose(x,z,h),frame=carBodyFrame(team,x,pose.y,z,h,pose);
 // Derive shader-transformed model up from the mounted camera's up vector.
 const up=cockpitCamera(frame).up,n=[-p.gradX,1,-p.gradZ],len=Math.hypot(...n);
 const error=1-up.reduce((sum,v,j)=>sum+v*n[j]/len,0);worst=Math.max(worst,error);count++;
 }}return {count,worst};},
 steep(){const h=SPA_SEMANTIC_META.heading,g=SPA_SEMANTIC_META.grid[0].position;
 const target=[g[0]+Math.cos(h)*110,g[2]+Math.sin(h)*110];let best=null,score=Infinity;
 for(const t of venueContacts.spa.road.triangles){const x=(t.a[0]+t.b[0]+t.c[0])/3,z=(t.a[1]+t.b[1]+t.c[1])/3;
 const d=Math.hypot(x-target[0],z-target[1]);if(d>=score)continue;
 if(venueWallHit('spa',x-3,z-3,x+3,z+3)||venueWallHit('spa',x-3,z+3,x+3,z-3))continue;
 if(venueContactAt('spa','road',x+2,z)===null||venueContactAt('spa','road',x-2,z)===null)continue;
 best={x,z};score=d;}
 if(!best)throw Error('No visible main-road probe');
 carX=best.x;carZ=best.z;carHeading=h;carSpeed=0;resetSpaRideFilter(playerSpaRideFilter);
 for(let i=0;i<120;i++)updateRideHeights(1/60);cameraMode='orbit';distance=7;pitch=.3;yaw=-h;
 if(venueWallHit('spa',carX,carZ,carX+Math.sin(yaw)*7,carZ+Math.cos(yaw)*7))yaw+=Math.PI;},
 roadTest(mode){const a=importedTracks.singapore;
 if(!this.saved){this.saved=a.draws;this.road=a.draws.filter(d=>d.material===182);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([120,120,120,0]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);this.zero=this.road.map(d=>({...d,tex}));}
 a.draws=mode==='empty'?[]:mode==='zero'?this.zero:this.saved;
 return this.road.map(d=>({opaque:d.forceOpaque,blended:d.blended}));}
};'''
s=s.replace('const keys=Object.create(null);',hook+'\nconst keys=Object.create(null);')
errors=[];out=ROOT/'test-results/bank-opacity';out.mkdir(parents=True,exist_ok=True)
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=b.new_page(viewport={'width':1280,'height':720});page.set_default_timeout(240000);page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/game.js',lambda route:route.fulfill(body=s,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.locator('.asset-loading').wait_for(state='detached');page.locator('#practiceMode').click();page.locator('#selectSpaTrack').click();page.locator('#teamScreen:not(.hidden)').wait_for()
  result=page.evaluate('bankTest.check()');assert result['count']>1000 and result['worst']<1e-9,result;print('PASS Spa source planes',result,flush=True)
  page.locator('#playerTeamSelect').select_option('redbull');page.locator('#confirmTeamSelection').click();page.locator('#teamScreen.hidden').wait_for(state='attached');page.locator('#startLights.hidden').wait_for(state='attached')
  page.keyboard.press('Escape');page.locator('#pauseTrack').click();page.evaluate('bankTest.steep()');page.wait_for_timeout(200);page.screenshot(path=str(out/'spa-banked.png'))
  page.locator('#pauseBack').click();page.locator('#pauseQuit').click();page.locator('#selectSingaporeTrack').click();page.locator('#teamScreen:not(.hidden)').wait_for();page.locator('#confirmTeamSelection').click();page.locator('#teamScreen.hidden').wait_for(state='attached');page.locator('#startLights.hidden').wait_for(state='attached')
  page.keyboard.press('Escape');page.locator('#pauseTrack').click();page.locator('#settingsToggle').click();page.locator('[data-view=halo]').click();page.wait_for_timeout(200);page.screenshot(path=str(out/'singapore-road.png'))
  states=page.evaluate('bankTest.roadTest("zero")');assert states and all(x['opaque'] and not x['blended'] for x in states),states
  page.wait_for_timeout(200);zero=page.screenshot(path=str(out/'singapore-zero-alpha-road.png'))
  page.evaluate('bankTest.roadTest("empty")');page.wait_for_timeout(200);empty=page.screenshot()
  diff=ImageChops.difference(Image.open(BytesIO(zero)).convert('RGB'),Image.open(BytesIO(empty)).convert('RGB')).crop((0,280,1280,620))
  fraction=sum(max(v)>20 for v in diff.get_flattened_data())/(diff.width*diff.height);assert fraction>.01,fraction
  print('PASS Singapore road remains visible even with zero-alpha texture:',round(fraction,3),flush=True)
  page.evaluate('bankTest.roadTest("restore")');assert not errors,errors;b.close()
  (out/'results.json').write_text(json.dumps({'spa':result,'zero_alpha_road_pixel_fraction':fraction,'errors':errors},indent=2))
finally:server.shutdown()
