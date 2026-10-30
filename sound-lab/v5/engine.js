import {loopBuffer,stableWindow} from '../engine.js?v=states1';
export const STATES={upshift:'升挡',accelerate:'同挡加速',downshift:'降挡',decelerate:'同挡减速（刹车）',coast:'无油门滑行'};
const LIMITS=[0,65,100,140,180,225,270,310,355];
export class Drive {
 constructor(){this.reset();}
 reset(){this.speed=0;this.gear=1;this.rpm=5500;this.throttle=0;this.brake=0;this.auto=false;this.shiftId=0;this.shiftState=null;this.shiftTime=0;this.topTime=0;}
 shift(delta){const next=Math.max(1,Math.min(8,this.gear+delta));if(next===this.gear||this.shiftTime>0)return;const ratio=this.speed/LIMITS[next];if(delta<0&&ratio>1)return;this.gear=next;this.shiftId++;this.shiftState=delta>0?'upshift':'downshift';this.shiftTime=.35;this.topTime=0;this.rpm=delta>0?Math.max(5500,this.rpm-2200):Math.min(12500,this.rpm+1800);}
 get state(){return this.shiftTime>0?this.shiftState:this.brake>0?'decelerate':this.throttle>0?'accelerate':'coast';}
 update(dt){dt=Math.max(0,Math.min(.05,dt));this.shiftTime=Math.max(0,this.shiftTime-dt);const low=this.gear===1?0:LIMITS[this.gear-1]*.72,high=LIMITS[this.gear];
 this.speed=Math.max(0,Math.min(high,this.speed+((this.shiftTime?0:this.throttle)*24/Math.pow(this.gear,.3)-this.brake*65-1.3-this.speed*.012)*dt));
 const progress=Math.max(0,Math.min(1,(this.speed-low)/(high-low)));const target=5500+progress*6700;this.rpm+=(target-this.rpm)*(1-Math.exp(-dt*5));
 this.topTime=this.rpm>11800&&this.throttle>0?this.topTime+dt:0;
 if(this.auto&&this.shiftTime===0){if(this.topTime>.5)this.shift(1);else if(this.brake>0&&this.gear>1&&progress<.12)this.shift(-1);}
 }
}
export class Engine {
 constructor(ctx){this.ctx=ctx;this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);this.loops=[];this.shots=[];this.lastShift=0;this.activeState=null;}
 clear(){for(const x of [...this.loops,...this.shots]){try{x.node.stop();}catch{}x.node.disconnect();x.gain.disconnect();}this.loops=[];this.shots=[];this.activeState=null;}
 setBank(source,clips){this.clear();this.source=source;this.clips=structuredClone(clips);for(const name of ['accelerate','decelerate','coast']){const c=clips[name];if(!c)continue;const selected=stableWindow(source,c),node=this.ctx.createBufferSource(),gain=this.ctx.createGain();node.buffer=loopBuffer(this.ctx,source,selected.start,selected.length);node.loop=true;gain.gain.value=0;node.connect(gain);gain.connect(this.master);node.start();this.loops.push({name,node,gain,rpm:c.rpm,selected});}}
 stopShots(){for(const x of this.shots){try{x.node.stop();}catch{}x.node.disconnect();x.gain.disconnect();}this.shots=[];}
 update(d,volume,playing){const t=this.ctx.currentTime;this.master.gain.setTargetAtTime(playing?volume*.65:0,t,.025);this.activeState=playing?d.state:null;
 if(!playing){this.stopShots();this.lastShift=d.shiftId;}
 if(playing&&d.shiftId!==this.lastShift){this.lastShift=d.shiftId;const c=this.clips?.[d.shiftState];if(c){this.stopShots();const node=this.ctx.createBufferSource(),gain=this.ctx.createGain();node.buffer=this.source;node.connect(gain);gain.connect(this.master);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.8,t+.008);gain.gain.setValueAtTime(.8,t+c.length-.02);gain.gain.linearRampToValueAtTime(0,t+c.length);node.start(t,c.start,c.length);const shot={node,gain,name:d.shiftState};this.shots.push(shot);node.onended=()=>{node.disconnect();gain.disconnect();this.shots=this.shots.filter(x=>x!==shot);};}}
 if(playing&&this.shots.length)this.activeState=this.shots[0].name;
 // Exactly one continuous state is audible; recorded shifts only play on gear events.
 for(const x of this.loops){x.gain.gain.setTargetAtTime(playing&&!this.shots.length&&x.name===d.state ? .85 : 0,t,.025);x.node.playbackRate.setTargetAtTime(Math.max(.5,Math.min(2,d.rpm/x.rpm)),t,.1);}
 }
}
