const fs=require('fs'),vm=require('vm'),assert=require('assert');const src=fs.readFileSync(require('path').join(__dirname,'../src/game.js'),'utf8');const start=src.indexOf('function wallSegmentClosest('),end=src.indexOf('// The current game uses WebGL1.',start);const grid=new Map();for(let i=-5;i<6;i++)for(let j=-5;j<6;j++)grid.set(i+','+j,[[0,-60,0,60,-1,5]]);
const c={trackWallGrids:{spa:grid,silverstone:grid,singapore:grid},TRACK_WALL_CELL:16,shanghaiWallGrid:grid,SHANGHAI_COLLIDER_CELL:16,rideTargetY:()=>0,shanghaiHeightAt:()=>0,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),lerpAngle:(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t};vm.createContext(c);vm.runInContext(src.slice(start,end),c);
for(const track of ['spa','silverstone','singapore','shanghai']){
 const p={x:-6,z:0,h:0},hit=c.resolveCarWalls(track,p,{x:10,z:0,h:0});assert(hit.hit);assert(hit.x< -2.7);
 const away=c.resolveCarWalls(track,hit,{...hit,x:hit.x-1});assert(!away.hit);assert(away.x<hit.x);
 const embedded=c.resolveCarWalls(track,{x:-1.5,z:0,h:0},{x:-1.4,z:0,h:0});assert(embedded.hit);assert(embedded.x< -2.7);
 assert(!c.resolveCarWalls(track,embedded,{...embedded,x:embedded.x-1}).hit);
 const rear=c.resolveCarWalls(track,{x:1.5,z:0,h:0},{x:1.4,z:0,h:0});assert(rear.hit&&rear.x>2.7);assert(!c.resolveCarWalls(track,rear,{...rear,x:rear.x+1}).hit);
 const lateral=c.resolveCarWalls(track,{x:-1.2,z:0,h:Math.PI/2},{x:-1.2,z:2,h:Math.PI/2});assert(!lateral.hit);
 const rotate=c.resolveCarWalls(track,{x:-1.2,z:0,h:Math.PI/2},{x:-1.2,z:0,h:0});assert(rotate.hit);
}
console.log('PASS four circuits: high-speed stop, front/rear penetration recovery, reverse escape, lateral clearance and rotation sweep');
