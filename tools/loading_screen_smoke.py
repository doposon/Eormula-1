from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('/workspace/Eormula-1')
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1280,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/assets/*.bin',lambda r:None)
 held=[];page.route('**/assets/loading/06-hamilton.png',lambda r:held.append(r))
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
 page.wait_for_function('document.querySelector(".loading-story-image")?.alt==="Fernando Alonso"')
 names=['Fernando Alonso','Kimi Räikkönen','Sebastian Vettel','Max Verstappen','Michael Schumacher','Lewis Hamilton','Jenson Button','Charles Leclerc','Daniel Ricciardo','Carlos Sainz']
 for i,name in enumerate(names):
  if i:
   page.locator('.loading-story-card').click()
   if i==5:
    assert page.locator('.loading-story-image').get_attribute('alt')=='Michael Schumacher'
    assert 'Michael Schumacher' in page.locator('.loading-story-fact').inner_text()
    assert held;held[0].continue_()
  page.wait_for_function('(name)=>document.querySelector(".loading-story-image")?.alt===name',arg=name)
  assert name.split(' ')[-1] in page.locator('.loading-story-fact').inner_text()
  for width,height in [(1280,800),(390,650)]:
   page.set_viewport_size({'width':width,'height':height})
   result=page.evaluate('''()=>{const i=document.querySelector('.loading-story-image'),v=i.parentElement.getBoundingClientRect(),b=document.querySelector('.loading-story-card').getBoundingClientRect();return {fit:getComputedStyle(i).objectFit,complete:i.complete&&i.naturalWidth>0,inside:v.y>=b.y&&v.bottom<=b.bottom,width:v.width,height:v.height}}''')
   assert result['fit']=='contain' and result['complete'] and result['inside'] and result['height']>0,result
 assert not errors,errors
 page.unroute('**/assets/*.bin');b.close()
server.shutdown();print('PASS ten complete images at desktop/mobile sizes; delayed Hamilton image retains Schumacher photo AND text until atomic replacement; no JS errors')
