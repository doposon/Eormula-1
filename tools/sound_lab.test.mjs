import assert from 'node:assert/strict';
import {Drive,candidates,stableWindow} from '../sound-lab/engine.js';
const d=new Drive();d.throttle=1;const gears=new Set();let shifts=0;
assert.equal(d.rpm,5500);d.update(1/60);assert.ok(d.rpm<6000);
for(let i=0;i<2400;i++){const old=d.gear;d.update(1/60);gears.add(d.gear);if(d.gear>old)shifts++;assert.ok(Number.isFinite(d.rpm)&&d.rpm>=4000&&d.rpm<=12800);}
assert.ok(shifts>=5);assert.ok(d.speed>220);
d.throttle=0;const speed=d.speed;for(let i=0;i<120;i++)d.update(1/60);assert.ok(d.speed<speed);
d.brake=1;for(let i=0;i<900;i++)d.update(1/60);assert.equal(d.speed,0);assert.equal(d.gear,1);
d.reset();d.speed=220;d.gear=7;d.shift(-1);assert.equal(d.gear,6);d.speed=350;d.shift(-1);assert.equal(d.gear,6);
assert.throws(()=>candidates({sampleRate:1000,getChannelData:()=>new Float32Array(1000)}));
const rate=4000,samples=new Float32Array(rate*3);for(let i=0;i<samples.length;i++){const t=i/rate;samples[i]=.4*Math.sin(2*Math.PI*(200*t+(t>=1&&t<2?150*(t-1)**2:0)));}
const selected=stableWindow({sampleRate:rate,getChannelData:()=>samples},{start:0,length:3});assert.ok(selected.length<=.5);assert.ok(selected.start<.6||selected.start>1.9);
assert.deepEqual(stableWindow({sampleRate:rate,getChannelData:()=>samples},{start:1,length:.4}),{start:1,length:.4});
console.log('PASS drive controls, silent-input rejection and stable loop selection');
