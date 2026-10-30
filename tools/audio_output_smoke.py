"""Render real Web Audio output and check widening silent gaps and quieter clips."""
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
   const {MarkedAudio,APPROVED_AUDIO,markedSegment,brakeRepeatStart}=await import('/src/marked-audio.mjs?v=sound5');
   const results={};
   for(const mode of ['coast','braking']){
    const ctx=new OfflineAudioContext(1,40*16000,16000),buffer=ctx.createBuffer(1,76*16000,16000),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.sin(i/16000*2*Math.PI*220)*.2;
    const engine=new MarkedAudio(ctx,buffer,APPROVED_AUDIO.banks);engine.timeline.gear=1;engine.update({active:true,brake:mode==='braking',volume:.3});
    const checkpoint=ctx.suspend(20),rendering=ctx.startRendering();await checkpoint;engine.update({active:true,brake:mode==='braking',volume:.3});await ctx.resume();const out=(await rendering).getChannelData(0);let peak=0;for(const value of out)peak=Math.max(peak,Math.abs(value));
    const duration=markedSegment(APPROVED_AUDIO.banks,mode,1).duration,rms=(from,to)=>{let sum=0,n=0;for(let i=Math.floor(from*16000);i<Math.floor(to*16000);i++){sum+=out[i]*out[i];n++;}return Math.sqrt(sum/n);};
    let checked=0;
    for(let i=0;;i++){const start=brakeRepeatStart(i,duration),next=brakeRepeatStart(i+1,duration),end=start+duration;if(next>=40)break;
     if(rms(start+duration*.3,start+duration*.7)<.0001)throw Error('Missing replay '+mode+' '+i);
     if(rms(end+(next-end)*.3,end+(next-end)*.7)>1e-8)throw Error('Gap filled with sound '+mode+' '+i);checked++;
    }
    if(peak>.035||checked<10)throw Error('Volume/replay count incorrect '+mode);
    results[mode]={peak,checked};
   }return results;
  }''')
  browser.close();print('PASS real rendered audio has quieter clips and widening silent gaps over 40 seconds:',result)
finally:server.shutdown()
