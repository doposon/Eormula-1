import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
const code=source.split('// SURFACE_CONTACT_BEGIN')[1].split('// SURFACE_CONTACT_END')[0];
const context=vm.createContext({});vm.runInContext(code+';globalThis.api={addVenueContact,venueContactAt};',context);
const {addVenueContact:add,venueContactAt:sample}=context.api;
// A planar incline spanning an 8m bin edge and two triangles must stay continuous.
add('test','road',new Float32Array([0,0,0,16,4,0,0,0,16,16,4,16]),[0,1,2,1,3,2]);
for(let x=.1;x<15.9;x+=.1)assert.ok(Math.abs(sample('test','road',x,8)-x/4)<1e-6);
assert.equal(sample('test','road',-1,8),null);
// Imported coordinates match the renderer's X,-Z,Y mapping and Singapore's scale.
add('singapore','kerb',new Float32Array([0,0,-22.65,1,0,-22.65,0,1,-22.65]),[0,1,2],2.1,true);
assert.ok(Math.abs(sample('singapore','kerb',.2,.2,47.54)-47.565)<1e-4);
// Walls and roofs must not count as low kerbs.
add('singapore','kerb',new Float32Array([10,0,-30,11,0,-30,10,1,-30]),[0,1,2],2.1,true);
assert.equal(sample('singapore','kerb',21.2,.2,47.54),null);
add('test','kerb',new Float32Array([20,0,0,20,5,0,20,0,2]),[0,1,2]);
assert.equal(sample('test','kerb',20,1),null);
console.log('PASS sloped mesh continuity, spatial bins, imported transforms, kerb floor selection and wall exclusion');
