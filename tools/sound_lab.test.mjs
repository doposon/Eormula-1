import assert from 'node:assert/strict';
import {Drive,candidates} from '../sound-lab/engine.js';
const d=new Drive();d.throttle=1;const gears=new Set();let shifts=0;
for(let i=0;i<2400;i++){const old=d.gear;d.update(1/60);gears.add(d.gear);if(d.gear>old)shifts++;assert.ok(Number.isFinite(d.rpm)&&d.rpm>=4000&&d.rpm<=12800);}
assert.ok(shifts>=5);assert.ok(d.speed>220);
d.throttle=0;const speed=d.speed;for(let i=0;i<120;i++)d.update(1/60);assert.ok(d.speed<speed);
d.brake=1;for(let i=0;i<900;i++)d.update(1/60);assert.equal(d.speed,0);assert.equal(d.gear,1);
d.reset();d.speed=220;d.gear=7;d.shift(-1);assert.equal(d.gear,6);d.speed=350;d.shift(-1);assert.equal(d.gear,6);
assert.throws(()=>candidates({sampleRate:1000,getChannelData:()=>new Float32Array(1000)}));
console.log('PASS acceleration, upshifts, coasting, braking/downshifts, overrev protection and silent-input rejection');
