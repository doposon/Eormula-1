from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading
from playwright.sync_api import sync_playwright
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory='/workspace/Eormula-1'));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1280,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/assets/*.bin',lambda r:None)
 page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
 assert page.locator('#studioSplash').is_visible()
 page.locator('.loading-story-card').wait_for()
 seen=[]
 for i in range(10):
  page.wait_for_function('document.querySelector(".loading-story-image").naturalWidth>0')
  seen.append(page.locator('.loading-story-fact').inner_text());page.locator('.loading-story-card').click()
 assert len(set(seen))==10
 box=page.locator('.loading-story-footer').bounding_box();assert box['y']+box['height']>=799
 assert not errors,errors
 b.close()
server.shutdown();print('PASS Studio first, 10 original photos and facts, click cycling, bottom progress and no JS errors')
