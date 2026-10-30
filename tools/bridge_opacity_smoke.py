"""Singapore bridge-deck regression using original material 29 and a zero-alpha texture."""
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
 bridge(){
 const {positions:p,indices:ids}=window.bridgeProbe;let best=null,size=0;
 const point=i=>[p[i*3]*2.1,-p[i*3+2]*2.1,p[i*3+1]*2.1];
 for(let i=0;i<ids.length;i+=3){const a=point(ids[i]),b=point(ids[i+1]),c=point(ids[i+2]);
 const area=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]));
 if(area<size||Math.abs((a[1]+b[1]+c[1])/3-47.54)>1)continue;size=area;best={a,b,c};}
 if(!best)throw Error('Bridge probe not found');const {a,b,c}=best;
 carX=(a[0]+b[0]+c[0])/3;carZ=(a[2]+b[2]+c[2])/3;playerRideY=(a[1]+b[1]+c[1])/3;
 const edges=[[a,b],[b,c],[c,a]].sort((u,v)=>Math.hypot(v[1][0]-v[0][0],v[1][2]-v[0][2])-Math.hypot(u[1][0]-u[0][0],u[1][2]-u[0][2]));
 carHeading=Math.atan2(edges[0][1][2]-edges[0][0][2],edges[0][1][0]-edges[0][0][0]);cameraMode='chase';carSpeed=0;
 return {x:carX,z:carZ,y:playerRideY};},
 roadTest(mode){const a=importedTracks.singapore;
 if(!this.saved){this.saved=a.draws;this.road=a.draws.filter(d=>d.material===29);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([120,120,120,0]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);this.zero=this.road.map(d=>({...d,tex}));}
 a.draws=mode==='empty'?[]:mode==='zero'?this.zero:this.saved;
 return this.road.map(d=>({opaque:d.forceOpaque,blended:d.blended}));}
};'''
s=s.replace("const inds=prim.indices===undefined?null:silverstoneAccessor(doc,bin,prim.indices,true);", "const inds=prim.indices===undefined?null:silverstoneAccessor(doc,bin,prim.indices,true);if(key==='singapore'&&prim.material===29)window.bridgeProbe={positions:p.array,indices:inds.array};")
s=s.replace('const keys=Object.create(null);',hook+'\nconst keys=Object.create(null);')
errors=[];out=ROOT/'test-results/singapore-bridge';out.mkdir(parents=True,exist_ok=True)
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=b.new_page(viewport={'width':1280,'height':720});page.set_default_timeout(240000);page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/src/game.js',lambda route:route.fulfill(body=s,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/');page.locator('.asset-loading').wait_for(state='detached');page.locator('#audioSetupSkip').click();page.locator('#practiceMode').click();page.locator('#selectSingaporeTrack').click();page.locator('#teamScreen:not(.hidden)').wait_for();page.locator('#confirmTeamSelection').click();page.locator('#teamScreen.hidden').wait_for(state='attached');page.locator('#startLights.hidden').wait_for(state='attached')
  page.keyboard.press('Escape');page.locator('#pauseTrack').click();result=page.evaluate('bankTest.bridge()');page.wait_for_timeout(250);page.screenshot(path=str(out/'singapore-bridge.png'))
  states=page.evaluate('bankTest.roadTest("zero")');assert states and all(x['opaque'] and not x['blended'] for x in states),states
  page.wait_for_timeout(200);zero=page.screenshot(path=str(out/'bridge-zero-alpha.png'))
  page.evaluate('bankTest.roadTest("empty")');page.wait_for_timeout(200);empty=page.screenshot()
  diff=ImageChops.difference(Image.open(BytesIO(zero)).convert('RGB'),Image.open(BytesIO(empty)).convert('RGB')).crop((0,280,1280,620))
  fraction=sum(max(v)>20 for v in diff.get_flattened_data())/(diff.width*diff.height);assert fraction>.01,fraction
  print('PASS Singapore road remains visible even with zero-alpha texture:',round(fraction,3),flush=True)
  page.evaluate('bankTest.roadTest("restore")');assert not errors,errors;b.close()
  (out/'results.json').write_text(json.dumps({'bridge':result,'zero_alpha_road_pixel_fraction':fraction,'errors':errors},indent=2))
finally:server.shutdown()
