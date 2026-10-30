"""Render real Web Audio output to catch silent loops, independently of GPU load."""
from functools import partial
from http.server import ThreadingHTTPServer
import threading
from playwright.sync_api import sync_playwright
from smoke import QuietServer, ROOT
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page();page.goto(f'http://127.0.0.1:{server.server_port}/sound-lab/v7/')
  result=page.evaluate('''async()=>{
   const {MarkedAudio,APPROVED_AUDIO}=await import('/src/marked-audio.mjs?v=audio4');
   const results={};
   for(const mode of ['coast','braking']){
    const ctx=new OfflineAudioContext(1,40*16000,16000),buffer=ctx.createBuffer(1,76*16000,16000),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.sin(i/16000*2*Math.PI*220)*(i/16000>23?.01:.2);
    const engine=new MarkedAudio(ctx,buffer,APPROVED_AUDIO.banks);engine.timeline.gear=7;engine.update({active:true,brake:mode==='braking',volume:.3});
    const checkpoint=ctx.suspend(20),rendering=ctx.startRendering();await checkpoint;engine.update({active:true,brake:mode==='braking',volume:.3});await ctx.resume();const out=(await rendering).getChannelData(0);let minimum=1;
    for(let start=1600;start<out.length-1600;start+=1600){let sum=0;for(let i=start;i<start+1600;i++)sum+=out[i]*out[i];minimum=Math.min(minimum,Math.sqrt(sum/1600));}
    if(minimum<.002)throw Error(mode+' output too quiet: '+minimum);
    results[mode]=minimum;
   }return results;
  }''')
  browser.close();print('PASS real rendered audio stays audible over 40 seconds:',result)
finally:server.shutdown()
