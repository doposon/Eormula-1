import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const s=readFileSync('src/game.js','utf8');
const code=s.slice(s.indexOf('// TYRE_WEAR_BEGIN'),s.indexOf('// TYRE_WEAR_END'));
const ctx=vm.createContext({carX:0,carZ:0,carHeading:0,getSurfaceAt:()=> 'ROAD'});
vm.runInContext(code+';globalThis.t={health:tyreHealth,wear:wearTyres,grip:tyreGripAt,compound(v){tyreCompound=v},enable(v){tyreWearEnabled=v}}',ctx);
const t=ctx.t;
t.wear(10,0,1,true);assert.ok(t.health.every(x=>x===100));
t.wear(1,20,0,false);const normal=100-t.health[0];assert.ok(normal>0&&normal<.1);
t.health.fill(100);ctx.getSurfaceAt=()=> 'GRASS';t.wear(1,20,0,false);assert.ok(100-t.health[0]>normal*20);
t.health.fill(100);ctx.getSurfaceAt=()=> 'ROAD';t.wear(1,20,1,true);assert.ok(t.health[0]<97&&t.health[2]>99);assert.ok(t.grip(0)<t.grip(2));
t.health.fill(100);t.health[2]=t.health[3]=10;assert.ok(t.grip(2)<t.grip(0));
t.enable(false);const before=[...t.health];t.wear(100,1000,1,true);assert.deepEqual([...t.health],before);assert.equal(t.grip(0),1);assert.equal(t.grip(2),1);
console.log('PASS stationary/disabled wear, road/grass wear, front lockup and independent axle grip');

t.enable(true);const measurements={};for(const c of ['soft','medium','hard','inter','wet']){t.compound(c);t.health.fill(100);const grip=t.grip(0);t.wear(1,100,0,false);measurements[c]={grip,wear:100-t.health[0]};}assert.ok(measurements.soft.grip>measurements.medium.grip&&measurements.medium.grip>measurements.hard.grip);assert.ok(measurements.soft.wear>measurements.medium.wear&&measurements.medium.wear>measurements.hard.wear);assert.ok(measurements.wet.grip<measurements.inter.grip);
