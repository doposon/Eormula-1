import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {carBodyFrame,bodyDirection} from '../src/camera.mjs';
const s=readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(s.split('// ROAD_ANGLES_BEGIN')[1].split('// ROAD_ANGLES_END')[0]+';globalThis.angles=roadSlopeAngles;',context);
for(const gx of [-.25,0,.25])for(const gz of [-.18,0,.18])for(const heading of [0,.7,Math.PI/2,Math.PI,-1.3])for(const team of ['redbull','ferrari']){
 const pose=context.angles(gx,gz,heading),frame=carBodyFrame(team,0,0,0,heading,pose);
 const up=bodyDirection(frame,[0,1,0]),normal=[-gx,1,-gz],length=Math.hypot(...normal);
 assert.ok(up.reduce((a,v,i)=>a+v*normal[i]/length,0)>1-1e-10,`${team} normal mismatch`);
 const gaps=[];
 for(const x of [-1.7,1.3])for(const z of [-.67,.67]){
  const p=bodyDirection(frame,[x*frame.sign,-frame.originY,z*frame.sign]);
  gaps.push(frame.y+p[1]-gx*p[0]-gz*p[2]);
 }
 assert.ok(Math.max(...gaps)-Math.min(...gaps)<1e-9,`${team} tyres diverge from road plane`);
}
console.log('PASS RB22/SF26 four-wheel road-plane alignment over 90 combinations of pitch, bank and heading');
