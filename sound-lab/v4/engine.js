export const LIMITS=[0,65,100,140,180,225,270,310,355];
export class Drive {
 constructor(){this.reset();}
 reset(){this.speed=0;this.gear=1;this.rpm=4000;this.throttle=0;this.brake=0;this.auto=true;this.cooldown=0;this.cut=0;this.blip=0;this.event='怠速';}
 shift(delta){const next=Math.max(1,Math.min(8,this.gear+delta));if(next===this.gear)return;if(delta<0&&this.speed>LIMITS[next]*.98){this.event='转速过高，暂缓降挡';return;}this.gear=next;this.cooldown=.4;if(delta>0){this.cut=.13;this.event='升挡 · 短暂收油';}else{this.blip=.18;this.event='降挡 · 补油';}}
 update(dt){dt=Math.min(.05,Math.max(0,dt));this.cooldown=Math.max(0,this.cooldown-dt);this.cut=Math.max(0,this.cut-dt);this.blip=Math.max(0,this.blip-dt);
 const power=this.cut?0:this.throttle;this.speed=Math.max(0,Math.min(355,this.speed+(power*42/Math.pow(this.gear,.43)-this.brake*90-1.8-this.speed*.018)*dt));
 const target=Math.min(12500,Math.max(4000,4000+this.speed/LIMITS[this.gear]*8500));
 if(this.auto&&!this.cooldown){if(target>11900&&this.throttle>.1)this.shift(1);else if(this.gear>1&&target<6700)this.shift(-1);}
 const desired=Math.min(12800,target+(this.blip?650:0));this.rpm+=(desired-this.rpm)*(1-Math.exp(-dt*15));return this;
 }
}
export function loopBuffer(ctx,source,start,length){const rate=source.sampleRate,offset=Math.round(start*rate),n=Math.min(Math.round(length*rate),source.length-offset);if(n<rate*.15)throw Error('片段太短或超出音频范围');const fade=Math.min(Math.floor(rate*.04),Math.floor(n/5)),size=n-fade;const out=ctx.createBuffer(source.numberOfChannels,size,rate);
 for(let ch=0;ch<source.numberOfChannels;ch++){const input=source.getChannelData(ch),data=out.getChannelData(ch);data.set(input.subarray(offset+fade,offset+n));for(let i=0;i<fade;i++){const t=i/fade;data[size-fade+i]=input[offset+n-fade+i]*(1-t)+input[offset+i]*t;}let mean=0,peak=0;for(const v of data)mean+=v;mean/=size;for(let i=0;i<size;i++){data[i]-=mean;peak=Math.max(peak,Math.abs(data[i]));}const gain=Math.min(2,.65/Math.max(.05,peak));for(let i=0;i<size;i++)data[i]*=gain;}
 return out;
}
// Long marked ranges can contain recorded gear changes. Loop only the steadiest
// short window inside the range, while keeping the original range editable.
export function stableWindow(source,clip){if(clip.length<=.65)return {start:clip.start,length:clip.length};
 const rate=source.sampleRate,data=source.getChannelData(0),length=Math.min(.48,clip.length),frame=Math.floor(length*rate/4),step=Math.max(1,Math.floor(.08*rate));let best=null;
 for(let off=Math.floor(clip.start*rate);off+4*frame<=Math.min(data.length,Math.floor((clip.start+clip.length)*rate));off+=step){const pitch=[],levels=[];
  for(let f=0;f<4;f++){let crossings=0,energy=0,last=data[off+f*frame];for(let i=1;i<frame;i+=4){const v=data[off+f*frame+i];crossings+=(v*last<0);energy+=v*v;last=v;}pitch.push(crossings+1);levels.push(Math.sqrt(energy/Math.max(1,frame/4)));}
  const avg=levels.reduce((a,b)=>a+b,0)/4;if(avg<.008)continue;const mean=pitch.reduce((a,b)=>a+b,0)/4;const variation=pitch.reduce((a,b)=>a+Math.abs(b-mean),0)/(4*mean);const loudness=levels.reduce((a,b)=>a+Math.abs(b-avg),0)/(4*avg);const score=variation+loudness*.4;
  if(!best||score<best.score)best={start:off/rate,length,score};
 }
 return best?{start:best.start,length:best.length}:{start:clip.start,length};
}
// Relative zero-crossing rate is only a coarse candidate selector, not an RPM measurement.
export function candidates(buffer){const data=buffer.getChannelData(0),rate=buffer.sampleRate,window=Math.floor(rate*.6),hop=Math.max(window,Math.floor(data.length/500)),frames=[];
 for(let off=0;off+window<data.length;off+=hop){let energy=0,cross=0,ea=0,eb=0;for(let i=0;i<window;i+=4){const v=data[off+i];energy+=v*v;if(i<window/2)ea+=v*v;else eb+=v*v;if(i&&v*data[off+i-4]<0)cross++;}const rms=Math.sqrt(energy/(window/4));if(rms>.008)frames.push({start:off/rate,length:.6,pitch:cross,stability:Math.abs(ea-eb)/(ea+eb+.0001),rms});}
 if(!frames.length)throw Error('没有检测到足够清晰的声音');const sorted=frames.sort((a,b)=>a.pitch-b.pitch),pick=(a,b)=>sorted.slice(Math.floor(sorted.length*a),Math.max(1,Math.ceil(sorted.length*b))).sort((a,b)=>a.stability-b.stability)[0]||sorted[0];
 return {low:{...pick(0,.3),rpm:4500},mid:{...pick(.3,.7),rpm:8000},high:{...pick(.7,1),rpm:11000},coast:{...pick(.1,.5),rpm:7500}};
}
export class Engine {
 constructor(ctx){this.ctx=ctx;this.nodes=[];this.master=ctx.createGain();this.master.gain.value=0;this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=16000;this.compressor=ctx.createDynamicsCompressor();this.filter.connect(this.compressor);this.compressor.connect(this.master);this.master.connect(ctx.destination);}
 setBank(source,clips){this.disposeNodes();for(const [name,clip] of Object.entries(clips)){const selected=stableWindow(source,clip),node=this.ctx.createBufferSource(),gain=this.ctx.createGain();node.buffer=loopBuffer(this.ctx,source,selected.start,selected.length);node.loop=true;gain.gain.value=0;node.connect(gain);gain.connect(this.filter);node.start();this.nodes.push({name,node,gain,rpm:clip.rpm,selected});}}
 update(drive,volume,view,playing){const t=this.ctx.currentTime,r=drive.rpm;this.master.gain.setTargetAtTime(playing?volume*.6:0,t,.035);this.filter.frequency.setTargetAtTime(view==='cockpit'?4200:15000,t,.1);
 const weights={low:Math.max(0,1-Math.abs(r-4500)/3000),mid:Math.max(0,1-Math.abs(r-8000)/3000),high:Math.max(0,1-Math.abs(r-11500)/3000)};const total=Math.hypot(weights.low,weights.mid,weights.high)||1;const load=.15+.85*drive.throttle;const coast=(1-drive.throttle)*.35;
 for(const x of this.nodes){const w=x.name==='coast'?coast:(weights[x.name]/total)*load;const cut=drive.cut?.25:1;const blip=drive.blip?1.15:1;x.gain.gain.setTargetAtTime(w*cut*blip,t,.035);x.node.playbackRate.setTargetAtTime(Math.max(.5,Math.min(2,r/x.rpm)),t,.05);}}
 disposeNodes(){for(const x of this.nodes){try{x.node.stop();}catch{}x.node.disconnect();x.gain.disconnect();}this.nodes=[];}
}
