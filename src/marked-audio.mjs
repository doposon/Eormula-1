export const APPROVED_AUDIO = {
 source:'屏幕录制 2026-10-30 091321.mp4',duration:75.392,
 banks:{
  acceleration:{key:'acceleration',count:5,nodes:[10.477813253012048,12.340614457831323,13.50796987951807,14.820801204819276,16.797144578313254,21.25367469879518]},
  braking:{key:'braking',count:5,nodes:[21.53753012048193,21.7468734939759,21.938475903614457,22.10524096385542,22.311036144578313,22.821975903614454]},
  coast:{key:'coast',count:1,nodes:[23.134216867469878,23.371945783132528]}
 }
};
export function markedSegment(banks,state,gear){const b=banks[state];if(!b?.nodes)return null;const coast=state==='coast',source=coast?1:gear>b.count?5:gear,i=coast?0:state==='braking'?b.count-source:source-1;const start=b.nodes[i],end=b.nodes[i+1];return {start,end,duration:(end-start)*(!coast&&gear>b.count?(gear===6?1.25:1.5):1)};}
// Each replay is followed by silence; the gaps grow by 0.15 seconds per replay.
export function brakeRepeatStart(index,duration){return index*duration+.075*index*(index+1);}
// Shared by the lab and game. Vehicle speed never drives this clock.
export class MarkedTimeline {
 constructor(banks){this.banks=banks;this.reset();}
 reset(){this.gear=1;this.phase=this.banks.coast?.nodes?'coast':'silent';this.intent='coast';this.elapsed=0;this.coastArmed=false;this.revision=0;this.manualRevision=0;}
 enter(phase,elapsed=0){this.phase=phase;this.elapsed=elapsed;this.revision++;}
 coast(){this.coastArmed=false;this.enter(this.banks.coast?.nodes?'coast':'silent');}
 shift(delta){const n=Math.max(1,Math.min(7,this.gear+delta));if(n===this.gear)return;this.manualRevision++;this.gear=n;if(this.intent==='coast')this.coast();else this.enter(this.intent);}
 tick(dt,throttle,brake,auto=true){const next=brake?'braking':throttle?'acceleration':'coast';if(next!==this.intent){this.tick(dt,this.intent==='acceleration',this.intent==='braking',auto);this.intent=next;if(next==='acceleration'){this.coastArmed=false;this.enter(next);}else if(next==='braking')this.enter(next);else this.coast();dt=0;}
  if(this.phase==='silent')return;this.elapsed+=Math.max(0,dt);
  for(let safety=0;safety<32;safety++){const s=markedSegment(this.banks,this.phase,this.gear);if(!s){this.enter('silent');break;}if(this.elapsed<s.duration)break;
   const remaining=this.elapsed-s.duration;
   if(this.phase==='coast'||this.phase==='braking'&&this.gear===1)break;
   if(!auto||(this.phase==='acceleration'&&this.gear===7))break;
   if(this.phase==='braking'){this.gear--;this.coastArmed=true;}else this.gear++;
   this.enter(this.phase,remaining);
  }
 }
}
export class MarkedAudio {
 constructor(ctx,buffer,banks){this.ctx=ctx;this.buffer=buffer;this.timeline=new MarkedTimeline(structuredClone(banks));this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);this.levels={coast:.65,braking:.7};this.node=null;this.nodes=[];this.lastTime=null;this.plan=null;this.active=false;}
 connectSource(n,phase){const gain=this.ctx.createGain();gain.gain.value=this.levels[phase]||1;n.connect(gain);gain.connect(this.master);n.levelGain=gain;}
 stopNode(){for(const n of this.nodes){try{n.stop();}catch{}n.disconnect();n.levelGain?.disconnect();}this.nodes=[];this.node=null;this.repeatPlan=null;}
 reset(){this.stopNode();this.timeline.reset();this.lastTime=null;this.plan=null;}
 dispose(){this.stopNode();this.master.disconnect();}
 update({active,throttle=false,brake=false,auto=true,volume=.4,recordedState=null}){const now=this.ctx.currentTime,dt=this.active&&this.lastTime!==null?now-this.lastTime:0;this.lastTime=now;this.active=active;
  if(!active){this.master.gain.cancelScheduledValues(now);this.master.gain.setValueAtTime(0,now);this.stopNode();this.plan=null;return;}
  if(recordedState){
   const t=this.timeline,s=recordedState;
   if(t.gear!==s.gear||t.phase!==s.phase||t.intent!==s.intent||Math.abs(t.elapsed+dt-s.elapsed)>.2)this.plan=null;
   Object.assign(t,s);
  }else this.timeline.tick(dt,throttle,brake,auto);const t=this.timeline;
  this.master.gain.setTargetAtTime(volume*.8*(t.phase==='coast'?(.3+.7*Math.exp(-t.elapsed/6)):1),now,.03);
  const plan=`${t.intent}:${auto}:${t.manualRevision}`;if(this.plan===plan){this.scheduleRepeats(now);return;}this.stopNode();this.plan=plan;if(t.phase==='silent')return;
  // Schedule all subsequent boundaries on the audio clock, even if a heavy
  // track stalls rendering. The visual timeline catches up without skipping audio.
  let phase=t.phase,gear=t.gear,elapsed=t.elapsed,at=now;
  for(let i=0;i<9;i++){const s=markedSegment(t.banks,phase,gear);if(!s)break;if(phase==='coast'||phase==='braking'&&gear===1){this.repeatPlan={base:at-elapsed,spec:s,index:0,phase};break;}const finite=auto&&(phase==='braking'||gear<7),remaining=Math.max(0,s.duration-elapsed),n=this.ctx.createBufferSource();n.buffer=this.buffer;this.connectSource(n,phase);n.playbackRate.value=1;
   {const tail=Math.min(.2,s.end-s.start),loopStart=s.end-tail;const offset=elapsed<s.end-s.start?s.start+elapsed:loopStart+(elapsed-(s.end-s.start))%tail;n.loop=true;n.loopStart=loopStart;n.loopEnd=s.end;n.start(at,offset);if(finite)n.stop(at+remaining);}
   this.nodes.push(n);this.node??=n;n.onended=()=>{n.disconnect();n.levelGain?.disconnect();this.nodes=this.nodes.filter(x=>x!==n);};if(!finite)break;at+=remaining;elapsed=0;gear+=phase==='acceleration'?1:-1;
  }
  this.scheduleRepeats(now);
 }
 scheduleRepeats(now){const p=this.repeatPlan;if(!p)return;const d=p.spec.duration;
  // Jump past old repeats after a long pause without changing gap progression.
  p.index=Math.max(p.index,Math.max(0,Math.floor((-(d+.075)+Math.sqrt((d+.075)**2+.3*Math.max(0,now-p.base)))/.15)));
  while(true){const start=p.base+brakeRepeatStart(p.index,d);if(start>now+30)break;const repeat=p.index++;const end=start+d;if(end<=now)continue;const n=this.ctx.createBufferSource(),at=Math.max(now,start);n.buffer=this.buffer;n.playbackRate.value=1;this.connectSource(n,p.phase);
   if(repeat>0){const fade=Math.min(.09,d*.2),g=n.levelGain.gain,level=this.levels[p.phase]||1;
    const initial=level*Math.min(1,(end-at)/fade);g.setValueAtTime(initial,at);g.setValueAtTime(initial,Math.max(at,end-fade));g.linearRampToValueAtTime(0,end);
   }
   const offset=p.spec.start+at-start;n.start(at,offset,end-at);n.stop(end);this.nodes.push(n);this.node??=n;n.onended=()=>{n.disconnect();n.levelGain?.disconnect();this.nodes=this.nodes.filter(x=>x!==n);};}
 }
}
