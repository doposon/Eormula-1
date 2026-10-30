import { DRIVING_CAMERAS, carBodyFrame, cockpitCamera } from './camera.mjs';
import { MarkedAudio, APPROVED_AUDIO } from './marked-audio.mjs';

export default function startGame(__embeddedAssets) {

window.addEventListener('error',function(event){
  const panel=document.getElementById('error');
  if(!panel)return;
  panel.style.display='grid';
  const box=panel.querySelector('.errbox');
  if(box){
    box.innerHTML='';
    const heading=document.createElement('h2');heading.textContent='Game script error';
    const paragraph=document.createElement('p');paragraph.textContent=(event.message||'An unexpected JavaScript error occurred.')+' Please take a screenshot of this message.';
    box.append(heading,paragraph);
  }
  console.error(event.error||event.message);
});
(()=>{'use strict';
const canvas=document.getElementById('glcanvas');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false,stencil:true})||canvas.getContext('experimental-webgl',{antialias:true,alpha:false,stencil:true});
if(!gl){document.getElementById('error').style.display='grid';return;}
const L=40,R=27,SW=80,ROAD=12,ARC=Math.PI*R,TOTAL=2*SW+2*ARC,rad=Math.PI/180;
// Arcade speed scale: preserve the existing vehicle/track motion while allowing a 0–340 km/h speedometer.
const MAX_WORLD_SPEED=23,MAX_DASH_SPEED=340;
const vs=`attribute vec3 aPos; attribute vec3 aColor; uniform mat4 uMvp; uniform mat4 uModel; varying vec3 vColor; varying float vLight; void main(){vec4 world=uModel*vec4(aPos,1.0);gl_Position=uMvp*world;vColor=aColor;vLight=0.91+0.09*clamp((world.x*0.004+world.z*0.003+0.5),0.0,1.0);}`;
const fs=`precision mediump float; varying vec3 vColor; varying float vLight; uniform float uOpacity; void main(){gl_FragColor=vec4(vColor*vLight,uOpacity);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vs));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
const locPos=gl.getAttribLocation(prog,'aPos'),locCol=gl.getAttribLocation(prog,'aColor'),locMvp=gl.getUniformLocation(prog,'uMvp'),locModel=gl.getUniformLocation(prog,'uModel'),locOpacity=gl.getUniformLocation(prog,'uOpacity');gl.uniform1f(locOpacity,1);

const carVs=`attribute vec3 aCarPos; attribute vec3 aCarNormal; attribute vec2 aCarUV;
uniform mat4 uCarVP; uniform vec3 uCarPosition; uniform float uCarHeading; uniform vec3 uCarCameraPosition; uniform float uCarGloss; uniform vec3 uCarSunDir;
uniform float uWheelGroup; uniform vec3 uWheelCenter; uniform float uWheelSpin; uniform float uFrontWheelSteer; uniform float uIsFront; uniform float uCarUVFlipMode; uniform float uBodyRoll; uniform float uBodyPitch; uniform float uWheelLift;
varying vec2 vCarUV; varying float vCarLight; varying float vCarSpec;
void main(){
 vec3 p=aCarPos; vec3 n=aCarNormal;
 if(uWheelGroup>0.5){
   vec3 c=uWheelCenter; vec3 d=p-c; vec3 nn=n;
   float cs=cos(uWheelSpin), sn=sin(uWheelSpin);
   p.x=c.x+d.x*cs-d.y*sn; p.y=c.y+d.x*sn+d.y*cs;
   n.x=nn.x*cs-nn.y*sn; n.y=nn.x*sn+nn.y*cs;
   if(uIsFront>0.5){
     d=p-c; nn=n; cs=cos(uFrontWheelSteer); sn=sin(uFrontWheelSteer);
     p.x=c.x+d.x*cs-d.z*sn; p.z=c.z+d.x*sn+d.z*cs;
     n.x=nn.x*cs-nn.z*sn; n.z=nn.x*sn+nn.z*cs;
   }
 }
 // Suspension: wheel travel plus small pitch (local Z axis) and roll (local X axis).
 if(uWheelGroup>0.5)p.y+=uWheelLift;
 float cp=cos(uBodyPitch),sp=sin(uBodyPitch),cr=cos(uBodyRoll),sr=sin(uBodyRoll);
 vec3 pp=p,nn=n;
 p.x=cp*pp.x-sp*pp.y;p.y=sp*pp.x+cp*pp.y;
 n.x=cp*nn.x-sp*nn.y;n.y=sp*nn.x+cp*nn.y;
 pp=p;nn=n;
 p.y=cr*pp.y-sr*pp.z;p.z=sr*pp.y+cr*pp.z;
 n.y=cr*nn.y-sr*nn.z;n.z=sr*nn.y+cr*nn.z;
 float ch=cos(uCarHeading), sh=sin(uCarHeading);
 vec3 world=vec3(uCarPosition.x+ch*p.x-sh*p.z,uCarPosition.y+p.y,uCarPosition.z+sh*p.x+ch*p.z);
 vec3 wn=normalize(vec3(ch*n.x-sh*n.z,n.y,sh*n.x+ch*n.z));
 vec3 lightDir=normalize(uCarSunDir);
 float ndl=max(dot(wn,lightDir),0.0);
 vCarLight=0.64+0.36*ndl;
 vec3 viewDir=normalize(uCarCameraPosition-world);
 vec3 halfDir=normalize(lightDir+viewDir);
 vCarSpec=pow(max(dot(wn,halfDir),0.0),30.0)*uCarGloss;
 vec2 uv=aCarUV; if(uCarUVFlipMode>0.5 && uCarUVFlipMode<1.5){uv.y=1.0-uv.y;}else if(uCarUVFlipMode>=1.5 && uCarUVFlipMode<2.5){uv.x=1.0-uv.x;}else if(uCarUVFlipMode>=2.5){uv=vec2(1.0-uv.x,1.0-uv.y);}
 vCarUV=uv; gl_Position=uCarVP*vec4(world,1.0);
}`;
const carFs=`precision mediump float; varying vec2 vCarUV; varying float vCarLight; varying float vCarSpec; uniform sampler2D uCarTexture; uniform float uCarAlphaMode; uniform float uCarAlphaCutoff; uniform vec4 uCarBaseColor; void main(){ vec4 t=texture2D(uCarTexture,vCarUV)*uCarBaseColor; if(uCarAlphaMode>0.5 && uCarAlphaMode<1.5 && t.a<uCarAlphaCutoff) discard; vec3 rgb=min(t.rgb*vCarLight+vec3(vCarSpec),vec3(1.0)); gl_FragColor=vec4(rgb,t.a); }`;
const carProg=gl.createProgram();gl.attachShader(carProg,shader(gl.VERTEX_SHADER,carVs));gl.attachShader(carProg,shader(gl.FRAGMENT_SHADER,carFs));gl.linkProgram(carProg);if(!gl.getProgramParameter(carProg,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(carProg));
const carLoc={pos:gl.getAttribLocation(carProg,'aCarPos'),normal:gl.getAttribLocation(carProg,'aCarNormal'),uv:gl.getAttribLocation(carProg,'aCarUV'),vp:gl.getUniformLocation(carProg,'uCarVP'),position:gl.getUniformLocation(carProg,'uCarPosition'),heading:gl.getUniformLocation(carProg,'uCarHeading'),camera:gl.getUniformLocation(carProg,'uCarCameraPosition'),gloss:gl.getUniformLocation(carProg,'uCarGloss'),sun:gl.getUniformLocation(carProg,'uCarSunDir'),alphaMode:gl.getUniformLocation(carProg,'uCarAlphaMode'),alphaCutoff:gl.getUniformLocation(carProg,'uCarAlphaCutoff'),baseColor:gl.getUniformLocation(carProg,'uCarBaseColor'),group:gl.getUniformLocation(carProg,'uWheelGroup'),center:gl.getUniformLocation(carProg,'uWheelCenter'),spin:gl.getUniformLocation(carProg,'uWheelSpin'),steer:gl.getUniformLocation(carProg,'uFrontWheelSteer'),front:gl.getUniformLocation(carProg,'uIsFront'),bodyRoll:gl.getUniformLocation(carProg,'uBodyRoll'),bodyPitch:gl.getUniformLocation(carProg,'uBodyPitch'),wheelLift:gl.getUniformLocation(carProg,'uWheelLift'),uvFlipMode:gl.getUniformLocation(carProg,'uCarUVFlipMode'),texture:gl.getUniformLocation(carProg,'uCarTexture')};
const uintIndicesExt=gl.getExtension('OES_element_index_uint');
const cachedStencilBits=gl.getParameter(gl.STENCIL_BITS); // cache expensive WebGL state query instead of every frame

const USER_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-001"];
const NPC_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-002"];
const FERRARI_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-003"];
const MERCEDES_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-004"];
const WILLIAMS_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-005"];
const ALPINE_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-006"];
const AUDI_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-007"];
const HAAS_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-008"];
const RACINGBULLS_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-009"];
const ASTONMARTIN_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-010"];
const CADILLAC_CAR_GLB_DEFLATE_B64=__embeddedAssets["asset-011"];
const ADDITIONAL_TEAM_MODEL_B64={williams:WILLIAMS_CAR_GLB_DEFLATE_B64,alpine:ALPINE_CAR_GLB_DEFLATE_B64,audi:AUDI_CAR_GLB_DEFLATE_B64,haas:HAAS_CAR_GLB_DEFLATE_B64,racingbulls:RACINGBULLS_CAR_GLB_DEFLATE_B64,astonmartin:ASTONMARTIN_CAR_GLB_DEFLATE_B64,cadillac:CADILLAC_CAR_GLB_DEFLATE_B64};

let npcCarAsset=null;
let ferrariCarAsset=null;
let mercedesCarAsset=null;
let userCarAsset=null;
// Exact road, white-edge and low raised red/white kerb meshes from the previously verified oval GLB.
// The fixed course mesh is translated only: +27 m along Z to place the start line at car Z=0,
// and +0.075 m vertically to sit on the game ground. The driving/control code is unchanged.
const TRACK_POS_B64=__embeddedAssets["asset-012"];
const TRACK_COL_B64=__embeddedAssets["asset-013"];
const positions=decodeFloat32(TRACK_POS_B64), colors=decodeFloat32(TRACK_COL_B64);
function bindMesh(m){gl.bindBuffer(gl.ARRAY_BUFFER,m.pb);gl.enableVertexAttribArray(locPos);gl.vertexAttribPointer(locPos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.cb);gl.enableVertexAttribArray(locCol);gl.vertexAttribPointer(locCol,3,gl.FLOAT,false,0,0)}

// The embedded custom car model starts here; its mesh data and materials are unchanged.
const CAR_POS_B64=__embeddedAssets["asset-014"];
const CAR_COL_B64=__embeddedAssets["asset-015"];
function decodeFloat32(b64){const raw=atob(b64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Float32Array(bytes.buffer)}
const carPositions=decodeFloat32(CAR_POS_B64),carColors=decodeFloat32(CAR_COL_B64);
function makeMeshBuffers(pos,col){const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,pos,gl.STATIC_DRAW);const cb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,col,gl.STATIC_DRAW);return {pb,cb,count:pos.length/3}}
const ovalTrackBuffers=makeMeshBuffers(positions,colors);
// Sunlight shared by the car lighting, true 3D silhouette projection and visible sky disc.
// Each vector points FROM ground TOWARD the sun (Y is vertical).
const SUN_PRESETS=[
 {label:'MIDDAY',direction:[-0.30,0.92,-0.25]},
 {label:'AFTERNOON',direction:[-0.52,0.72,-0.39]},
 {label:'EVENING',direction:[-0.70,0.47,-0.43]}
];
let sunPresetIndex=1;
let sunDirection=new Float32Array(SUN_PRESETS[sunPresetIndex].direction);
function selectSunPreset(index){
 sunPresetIndex=((index%SUN_PRESETS.length)+SUN_PRESETS.length)%SUN_PRESETS.length;
 const d=SUN_PRESETS[sunPresetIndex].direction,l=Math.hypot(...d);
 sunDirection=new Float32Array([d[0]/l,d[1]/l,d[2]/l]);
 const button=document.getElementById('sunAngleButton');if(button)button.textContent='SUN: '+SUN_PRESETS[sunPresetIndex].label;
}
selectSunPreset(1);
document.getElementById('sunAngleButton').addEventListener('click',()=>selectSunPreset(sunPresetIndex+1));

// Atmospheric sky: world-locked clouds over a pale-blue gradient.
// Screen quad is only the raster target; cloud pattern is sampled in world directions.
const skyVs=`attribute vec2 aSkyCorner;varying vec2 vSkyUV;void main(){vSkyUV=aSkyCorner*.5+.5;gl_Position=vec4(aSkyCorner,0.9999,1.0);}`;
const skyFs=`precision mediump float;varying vec2 vSkyUV;
uniform float uSkyMode;uniform float uSkyAspect;uniform float uSkyTanHalfFov;
uniform vec3 uSkyForward;uniform vec3 uSkyRight;uniform vec3 uSkyUp;
float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash2(i),hash2(i+vec2(1.0,0.0)),f.x),
            mix(hash2(i+vec2(0.0,1.0)),hash2(i+vec2(1.0,1.0)),f.x),f.y);}
void main(){
 vec2 screen=vSkyUV*2.0-1.0;
 // True ray through this screen pixel: turning the camera changes the world direction.
 vec3 ray=normalize(uSkyForward+uSkyRight*(screen.x*uSkyAspect*uSkyTanHalfFov)+uSkyUp*(screen.y*uSkyTanHalfFov));
 float elevation=max(0.0,ray.y), skyHeight=clamp(elevation*1.22,0.0,1.0);
 float evening=step(1.5,uSkyMode);
 float noon=1.0-step(0.5,uSkyMode);
 vec3 top=mix(vec3(0.28,0.59,0.85),vec3(0.38,0.62,0.84),evening);
 vec3 horizon=mix(vec3(0.80,0.88,0.96),vec3(0.96,0.79,0.69),evening);
 top=mix(top,vec3(0.25,0.57,0.88),noon);
 vec3 col=mix(horizon,top,smoothstep(0.0,1.0,skyHeight));
 // Angular cloudfield anchored to the world. No camera eye position or yaw offset.
 // This projection remains continuous at all azimuth angles (no spherical longitude seam).
 vec2 p=ray.xz*(3.6/(0.45+elevation))+vec2(2.3,-1.5);
 float wisps=noise2(p*1.25)+0.45*noise2(p*2.55+7.4)+0.16*noise2(p*5.2);
 float bands=0.5+0.5*sin(p.x*1.8+p.y*3.3+noise2(p*0.7)*1.9);
 float cloud=smoothstep(0.88,1.28,wisps+0.2*bands);
 // Clouds now occupy upper sky only; keep the horizon clear of low-lying clouds.
 cloud*=smoothstep(0.30,0.49,elevation)*(1.0-smoothstep(0.985,1.0,elevation));
 col=mix(col,vec3(1.0,0.99,0.97),cloud*0.30);
 float haze=0.09*(1.0-smoothstep(0.06,0.30,elevation));
 col=mix(col,vec3(0.96,0.97,1.0),haze);
 gl_FragColor=vec4(col,1.0);
}`;
const skyProg=gl.createProgram();gl.attachShader(skyProg,shader(gl.VERTEX_SHADER,skyVs));gl.attachShader(skyProg,shader(gl.FRAGMENT_SHADER,skyFs));gl.linkProgram(skyProg);
if(!gl.getProgramParameter(skyProg,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(skyProg));
const skyLoc={pos:gl.getAttribLocation(skyProg,'aSkyCorner'),mode:gl.getUniformLocation(skyProg,'uSkyMode'),aspect:gl.getUniformLocation(skyProg,'uSkyAspect'),tanHalfFov:gl.getUniformLocation(skyProg,'uSkyTanHalfFov'),forward:gl.getUniformLocation(skyProg,'uSkyForward'),right:gl.getUniformLocation(skyProg,'uSkyRight'),up:gl.getUniformLocation(skyProg,'uSkyUp')};
const skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
function renderAtmosphericSky(cameraEye,cameraTarget,aspect,fovDegrees,cameraUp=[0,1,0]){
 gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);gl.disable(gl.STENCIL_TEST);
 const forward=norm(sub(cameraTarget,cameraEye));
 let right=cross(forward,cameraUp);const rLen=Math.hypot(...right);
 right=rLen>1e-5?right.map(v=>v/rLen):[1,0,0];
 const up=norm(cross(right,forward));
 gl.useProgram(skyProg);
 gl.uniform1f(skyLoc.mode,sunPresetIndex);
 gl.uniform1f(skyLoc.aspect,Math.max(0.3,aspect));
 gl.uniform1f(skyLoc.tanHalfFov,Math.tan(fovDegrees*rad*0.5));
 gl.uniform3fv(skyLoc.forward,new Float32Array(forward));
 gl.uniform3fv(skyLoc.right,new Float32Array(right));
 gl.uniform3fv(skyLoc.up,new Float32Array(up));
 gl.bindBuffer(gl.ARRAY_BUFFER,skyBuffer);gl.enableVertexAttribArray(skyLoc.pos);gl.vertexAttribPointer(skyLoc.pos,2,gl.FLOAT,false,0,0);
 gl.drawArrays(gl.TRIANGLES,0,6);
 gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(prog);
}

// Decorative skyline beyond the authored Shanghai circuit. Buildings are not part of
// racetrack collisions; the real venue geometry and shadow meshes are unchanged.
const skylineVs=`attribute vec3 aSkylinePosition;attribute vec2 aSkylineTexcoord;attribute vec3 aSkylineNormal;
uniform mat4 uSkylineVP;uniform vec3 uSkylineEye;uniform vec3 uSkylineSun;
varying vec2 vFacadeUV;varying float vFacadeLight;varying float vFacadeFog;
void main(){gl_Position=uSkylineVP*vec4(aSkylinePosition,1.0);vFacadeUV=aSkylineTexcoord;
 vec3 n=normalize(aSkylineNormal),l=normalize(uSkylineSun);
 vFacadeLight=0.72+0.27*max(dot(n,l),0.0);
 vFacadeFog=clamp((distance(aSkylinePosition.xz,uSkylineEye.xz)-510.0)/1680.0,0.0,0.64);
}`;
const skylineFs=`precision mediump float;
varying vec2 vFacadeUV;varying float vFacadeLight;varying float vFacadeFog;
uniform sampler2D uFacadeAtlas;uniform float uSkylineTime;
void main(){vec3 c=texture2D(uFacadeAtlas,vFacadeUV).rgb*vFacadeLight;
 vec3 fog=mix(vec3(.76,.86,.93),vec3(.95,.78,.68),step(1.5,uSkylineTime));
 gl_FragColor=vec4(mix(c,fog,vFacadeFog),1.0);}`;
const skylineProg=gl.createProgram();gl.attachShader(skylineProg,shader(gl.VERTEX_SHADER,skylineVs));gl.attachShader(skylineProg,shader(gl.FRAGMENT_SHADER,skylineFs));gl.linkProgram(skylineProg);
if(!gl.getProgramParameter(skylineProg,gl.LINK_STATUS))throw new Error('Distant buildings shader: '+gl.getProgramInfoLog(skylineProg));
const skylineLoc={position:gl.getAttribLocation(skylineProg,'aSkylinePosition'),uv:gl.getAttribLocation(skylineProg,'aSkylineTexcoord'),normal:gl.getAttribLocation(skylineProg,'aSkylineNormal'),vp:gl.getUniformLocation(skylineProg,'uSkylineVP'),eye:gl.getUniformLocation(skylineProg,'uSkylineEye'),sun:gl.getUniformLocation(skylineProg,'uSkylineSun'),atlas:gl.getUniformLocation(skylineProg,'uFacadeAtlas'),time:gl.getUniformLocation(skylineProg,'uSkylineTime')};
// A single procedurally painted 1024x1024 atlas holds twelve office/residential
// facade materials plus four rooftop/utility tiles. No external image URLs.
function makeSkylineFacadeAtlas(){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('2D texture atlas unavailable');
 const facades=['#667884','#87999e','#c1b7a6','#768b9b','#a1a9b2','#867e79','#667d7e','#b6a997','#536b80','#8b9aa8','#c2b6a1','#68737b'];
 let seed=728034;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let idx=0;idx<16;idx++){
  const ox=(idx%4)*256,oy=Math.floor(idx/4)*256;
  ctx.fillStyle=facades[idx%facades.length]||'#777f82';ctx.fillRect(ox,oy,256,256);
  if(idx>=12){ // flat rooftop textures: concrete, skylights, mechanical plant
   ctx.fillStyle=idx%2?'#777e80':'#969b9c';ctx.fillRect(ox+6,oy+6,244,244);
   for(let j=0;j<9;j++){const xx=ox+15+(j%3)*78,yy=oy+15+Math.floor(j/3)*78;
    ctx.fillStyle=j%3===0?'#606b71':'#aeb8b8';ctx.fillRect(xx,yy,49,43);
    ctx.fillStyle='#4a5a66';ctx.fillRect(xx+6,yy+7,37,27);
   }
  }else{
   // Vertical shading, narrow mullions and varied reflective window panels.
   ctx.fillStyle='rgba(17,29,38,0.22)';ctx.fillRect(ox+8,oy,7,256);ctx.fillRect(ox+239,oy,7,256);
   const cols=idx%3===0?7:(idx%3===1?9:6),rows=idx%4===0?11:(idx%4===1?13:9);
   const wx=232/cols,wy=237/rows;
   for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
     const x=ox+12+c*wx,y=oy+8+r*wy,ill=rand();
     const glass=ill<.16?'#b6cbd5':ill<.39?'#597181':ill<.74?'#344c5c':'#839dac';
     ctx.fillStyle=glass;ctx.fillRect(Math.round(x+2),Math.round(y+2),Math.max(3,Math.round(wx-5)),Math.max(4,Math.round(wy-5)));
     ctx.fillStyle='rgba(255,255,255,0.13)';ctx.fillRect(Math.round(x+3),Math.round(y+3),Math.max(1,Math.round(wx*.18)),Math.max(2,Math.round(wy*.55)));
     if(rand()<.036){ctx.fillStyle='#e4d8ae';ctx.fillRect(Math.round(x+4),Math.round(y+3),Math.max(2,Math.round(wx-10)),Math.max(3,Math.round(wy-7)));}
   }
   ctx.fillStyle='rgba(35,46,51,0.27)';for(let r=3;r<rows;r+=4)ctx.fillRect(ox+1,oy+8+r*wy,254,3);
   ctx.fillStyle='rgba(233,231,211,0.24)';ctx.fillRect(ox,oy+246,256,7);
  }
 }
 const tex=gl.createTexture();const flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.generateMipmap(gl.TEXTURE_2D);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flip);
 return tex;
}
const skylineTexture=makeSkylineFacadeAtlas();
function buildDistantCitySkyline(){
 const p=[],uv=[],nor=[];let seed=1618033;
 const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function tileBounds(k){let c=k%4,r=Math.floor(k/4),eps=.0025;return [c*.25+eps,1-(r+1)*.25+eps,(c+1)*.25-eps,1-r*.25-eps];}
 function quad(a,b,c,d,normal,tile){const [u0,v0,u1,v1]=tileBounds(tile);const ps=[a,b,c,a,c,d];const tx=[[u0,v0],[u1,v0],[u1,v1],[u0,v0],[u1,v1],[u0,v1]];
  for(let i=0;i<6;i++){p.push(...ps[i]);uv.push(...tx[i]);nor.push(...normal);}}
 function building(x,z,w,depth,height,style){
  const x0=x-w*.5,x1=x+w*.5,z0=z-depth*.5,z1=z+depth*.5;
  const y0=-5.4,y1=y0+height;
  const a=[x0,y0,z0],b=[x1,y0,z0],c=[x1,y1,z0],d=[x0,y1,z0];
  quad(a,b,c,d,[0,0,-1],style); // south facade
  quad([x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1],[0,0,1],style);
  quad([x0,y0,z1],a,d,[x0,y1,z1],[-1,0,0],(style+3)%12);
  quad(b,[x1,y0,z1],[x1,y1,z1],c,[1,0,0],(style+3)%12);
  quad(d,c,[x1,y1,z1],[x0,y1,z1],[0,1,0],12+(style%4));
  // Small raised roof plant blocks on selected buildings.
  if(height>71&&rng()<.36){const ww=Math.min(w*.36,23),dd=Math.min(depth*.40,20),hh=4+rng()*5;
   const xx=x+(rng()-.5)*w*.20,zz=z+(rng()-.5)*depth*.20;
   const xa=xx-ww/2,xb=xx+ww/2,za=zz-dd/2,zb=zz+dd/2,Y=y1+hh;
   quad([xa,y1,za],[xb,y1,za],[xb,Y,za],[xa,Y,za],[0,0,-1],14);
   quad([xb,y1,zb],[xa,y1,zb],[xa,Y,zb],[xb,Y,zb],[0,0,1],14);
   quad([xa,y1,zb],[xa,y1,za],[xa,Y,za],[xa,Y,zb],[-1,0,0],13);
   quad([xb,y1,za],[xb,y1,zb],[xb,Y,zb],[xb,Y,za],[1,0,0],13);
   quad([xa,Y,za],[xb,Y,za],[xb,Y,zb],[xa,Y,zb],[0,1,0],13);
  }
 }
 // Four sets of outlying districts *outside* the extents of the imported buildings
 // (original world X ~[-642,858], Z ~[-1021,357]). Gaps avoid a continuous wall.
 const edges=[
  {axis:'x',constant:565,from:-830,to:1000},
  {axis:'x',constant:-1285,from:-820,to:1040},
  {axis:'z',constant:-855,from:-1130,to:640},
  {axis:'z',constant:1080,from:-1140,to:700}
 ];
 let buildings=0;
 for(let ei=0;ei<edges.length;ei++){
  const e=edges[ei];let along=e.from+18;
  while(along<e.to-25){
   const w=21+rng()*37, gap=7+rng()*19;
   if(rng()<.07){along+=w+gap+22;continue;}
   let h=19+rng()*40;
   if(rng()<.23)h+=22+rng()*46;
   const d=12+rng()*22,offset=(rng()-.5)*76;
   if(e.axis==='x')building(along+w*.5, e.constant+offset, w,d,h,Math.floor(rng()*12));
   else building(e.constant+offset,along+w*.5,d,w,h,Math.floor(rng()*12));
   buildings++;along+=w+gap;
  }
 }
 const pos=new Float32Array(p),texcoords=new Float32Array(uv),normals=new Float32Array(nor);
 function buffer(data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b;}
 return {pb:buffer(pos),ub:buffer(texcoords),nb:buffer(normals),count:pos.length/3,buildings};
}
const distantSkyline=buildDistantCitySkyline();
// A subtle grass/field plane outside the original geometry, set *below* all authored
// track surfaces so it cannot cover the Shanghai road or pit buildings.
function makeDistantOutskirtsGround(){
 const p=[],c=[];let seed=2026;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const steps=24,xmin=-1460,xmax=1460,zmin=-1740,zmax=910,y=-5.65;
 for(let ix=0;ix<steps;ix++)for(let iz=0;iz<steps;iz++){
  const x0=xmin+(xmax-xmin)*ix/steps,x1=xmin+(xmax-xmin)*(ix+1)/steps;
  const z0=zmin+(zmax-zmin)*iz/steps,z1=zmin+(zmax-zmin)*(iz+1)/steps;
  const vv=[[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z0],[x1,y,z1],[x0,y,z1]];
  const shade=.84+rand()*.20;const tint=[.17*shade,.26*shade,.19*shade];
  for(const a of vv){p.push(...a);c.push(...tint);}
 }
 return makeMeshBuffers(new Float32Array(p),new Float32Array(c));
}
const distantOutskirtsGround=makeDistantOutskirtsGround();
function renderShanghaiOutskirts(vp,eye){
 if(selectedTrack!=='shanghai')return;
 // Opaque far terrain drawn using the known-stable track colour pipeline.
 gl.useProgram(prog);gl.uniformMatrix4fv(locMvp,false,vp);gl.uniformMatrix4fv(locModel,false,IDENTITY);gl.uniform1f(locOpacity,1);
 bindMesh(distantOutskirtsGround);gl.drawArrays(gl.TRIANGLES,0,distantOutskirtsGround.count);
 // Textured block facades, shaded by the same directional sun as the F1 cars.
 gl.useProgram(skylineProg);gl.uniformMatrix4fv(skylineLoc.vp,false,vp);
 gl.uniform3f(skylineLoc.eye,eye[0],eye[1],eye[2]);gl.uniform3fv(skylineLoc.sun,sunDirection);
 gl.uniform1f(skylineLoc.time,sunPresetIndex);gl.uniform1i(skylineLoc.atlas,0);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,skylineTexture);
 gl.bindBuffer(gl.ARRAY_BUFFER,distantSkyline.pb);gl.enableVertexAttribArray(skylineLoc.position);gl.vertexAttribPointer(skylineLoc.position,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,distantSkyline.ub);gl.enableVertexAttribArray(skylineLoc.uv);gl.vertexAttribPointer(skylineLoc.uv,2,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,distantSkyline.nb);gl.enableVertexAttribArray(skylineLoc.normal);gl.vertexAttribPointer(skylineLoc.normal,3,gl.FLOAT,false,0,0);
 gl.drawArrays(gl.TRIANGLES,0,distantSkyline.count);
 gl.useProgram(prog);
}

// Sun disc + halo. This is a view-dependent sky sprite placed along the same vector as the directional light.
const sunVs=`attribute vec3 aSunPoint;uniform mat4 uSunVP;uniform vec3 uSunPosition;uniform float uSunSize;
void main(){gl_Position=uSunVP*vec4(aSunPoint+uSunPosition,1.0);gl_PointSize=uSunSize;}`;
const sunFs=`precision mediump float;uniform float uSunHalo;
void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.0;
float a=uSunHalo>0.5?0.16*pow(max(0.0,1.0-r),2.4):0.93*(1.0-smoothstep(0.72,1.0,r));
vec3 c=uSunHalo>0.5?vec3(1.0,0.92,0.70):vec3(1.0,0.98,0.86);
gl_FragColor=vec4(c,a);}`;
const sunProg=gl.createProgram();gl.attachShader(sunProg,shader(gl.VERTEX_SHADER,sunVs));gl.attachShader(sunProg,shader(gl.FRAGMENT_SHADER,sunFs));gl.linkProgram(sunProg);if(!gl.getProgramParameter(sunProg,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(sunProg));
const sunLoc={point:gl.getAttribLocation(sunProg,'aSunPoint'),vp:gl.getUniformLocation(sunProg,'uSunVP'),pos:gl.getUniformLocation(sunProg,'uSunPosition'),size:gl.getUniformLocation(sunProg,'uSunSize'),halo:gl.getUniformLocation(sunProg,'uSunHalo')};
const sunPointBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,sunPointBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,0]),gl.STATIC_DRAW);
function renderSunDisc(vp,eye,screenHeight){
 const distance=(selectedTrack==='oval'?200:1900);
 gl.useProgram(sunProg);gl.uniformMatrix4fv(sunLoc.vp,false,vp);
 gl.uniform3f(sunLoc.pos,eye[0]+sunDirection[0]*distance,eye[1]+sunDirection[1]*distance,eye[2]+sunDirection[2]*distance);
 gl.bindBuffer(gl.ARRAY_BUFFER,sunPointBuffer);gl.enableVertexAttribArray(sunLoc.point);gl.vertexAttribPointer(sunLoc.point,3,gl.FLOAT,false,0,0);
 gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 const scale=Math.min(1.4,Math.max(.65,screenHeight/850));
 gl.uniform1f(sunLoc.halo,1);gl.uniform1f(sunLoc.size,170*scale);gl.drawArrays(gl.POINTS,0,1);
 gl.uniform1f(sunLoc.halo,0);gl.uniform1f(sunLoc.size,40*scale);gl.drawArrays(gl.POINTS,0,1);
 gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.useProgram(prog);
}

// Physically projected silhouette from the actual car triangles, including wheel articulation for grouped meshes.
// No ellipses or approximate silhouette decals. All shadow pixels are merged through the stencil buffer,
// avoiding repeated blending that would otherwise make every overlapping triangle near-black.
const castVs=`attribute vec3 aCastPos;
uniform mat4 uCastVP;uniform vec3 uCastCarPosition;uniform float uCastHeading;uniform float uCastGroundY;
uniform vec3 uCastSunDirection;uniform mat4 uCastPartMatrix;
uniform float uCastWheelGroup;uniform vec3 uCastWheelCenter;uniform float uCastWheelSpin;uniform float uCastFrontWheelSteer;uniform float uCastIsFront;
void main(){
 vec3 p=(uCastPartMatrix*vec4(aCastPos,1.0)).xyz;
 if(uCastWheelGroup>0.5){
  vec3 c=uCastWheelCenter,d=p-c;float co=cos(uCastWheelSpin),si=sin(uCastWheelSpin);
  p.xy=c.xy+vec2(d.x*co-d.y*si,d.x*si+d.y*co);
  if(uCastIsFront>0.5){d=p-c;co=cos(uCastFrontWheelSteer);si=sin(uCastFrontWheelSteer);
   p.x=c.x+d.x*co-d.z*si;p.z=c.z+d.x*si+d.z*co;}
 }
 float ch=cos(uCastHeading),sh=sin(uCastHeading);
 vec3 world=vec3(uCastCarPosition.x+ch*p.x-sh*p.z,uCastCarPosition.y+p.y,uCastCarPosition.z+sh*p.x+ch*p.z);
 float fall=max(0.0,world.y-uCastGroundY)/max(0.15,uCastSunDirection.y);
 vec3 hit=vec3(world.x-uCastSunDirection.x*fall,uCastGroundY+0.046,world.z-uCastSunDirection.z*fall);
 gl_Position=uCastVP*vec4(hit,1.0);
}`;
const castFs=`precision mediump float;void main(){gl_FragColor=vec4(0.0,0.0,0.0,1.0);}`;
const castProg=gl.createProgram();gl.attachShader(castProg,shader(gl.VERTEX_SHADER,castVs));gl.attachShader(castProg,shader(gl.FRAGMENT_SHADER,castFs));gl.linkProgram(castProg);if(!gl.getProgramParameter(castProg,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(castProg));
const castLoc={pos:gl.getAttribLocation(castProg,'aCastPos'),vp:gl.getUniformLocation(castProg,'uCastVP'),car:gl.getUniformLocation(castProg,'uCastCarPosition'),heading:gl.getUniformLocation(castProg,'uCastHeading'),ground:gl.getUniformLocation(castProg,'uCastGroundY'),sun:gl.getUniformLocation(castProg,'uCastSunDirection'),part:gl.getUniformLocation(castProg,'uCastPartMatrix'),wheel:gl.getUniformLocation(castProg,'uCastWheelGroup'),center:gl.getUniformLocation(castProg,'uCastWheelCenter'),spin:gl.getUniformLocation(castProg,'uCastWheelSpin'),steer:gl.getUniformLocation(castProg,'uCastFrontWheelSteer'),front:gl.getUniformLocation(castProg,'uCastIsFront')};

// Final fullscreen blending pass, restricted by the real projected silhouette stencil.
const darkVs=`attribute vec2 aDarkQuad;void main(){gl_Position=vec4(aDarkQuad,0.0,1.0);}`;
const darkFs=`precision mediump float;void main(){gl_FragColor=vec4(0.015,0.018,0.025,0.43);}`;
const darkProg=gl.createProgram();gl.attachShader(darkProg,shader(gl.VERTEX_SHADER,darkVs));gl.attachShader(darkProg,shader(gl.FRAGMENT_SHADER,darkFs));gl.linkProgram(darkProg);if(!gl.getProgramParameter(darkProg,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(darkProg));
const darkLoc=gl.getAttribLocation(darkProg,'aDarkQuad');
const darkQuadBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,darkQuadBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
function casterMesh(batch){
 if(!batch||!batch.pb)return;
 gl.bindBuffer(gl.ARRAY_BUFFER,batch.pb);gl.enableVertexAttribArray(castLoc.pos);gl.vertexAttribPointer(castLoc.pos,3,gl.FLOAT,false,0,0);
 if(batch.ib){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,batch.ib);gl.drawElements(gl.TRIANGLES,batch.count,gl.UNSIGNED_INT,0);}
 else gl.drawArrays(gl.TRIANGLES,0,batch.count);
}
// Only upward/horizontal ground facets can RECEIVE projected car/building shadows.
// This prevents the previous screen-space stencil coverage from painting dark triangles
// across standing walls, barriers, grandstand facades and fencing.
let shanghaiGroundShadowReceiver=null;
function buildShanghaiGroundShadowReceiver(positions){
 const verts=[];
 for(let i=0;i+8<positions.length;i+=9){
  const ax=positions[i+3]-positions[i],ay=positions[i+4]-positions[i+1],az=positions[i+5]-positions[i+2];
  const bx=positions[i+6]-positions[i],by=positions[i+7]-positions[i+1],bz=positions[i+8]-positions[i+2];
  const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
  const length=Math.hypot(nx,ny,nz);
  const maxY=Math.max(positions[i+1],positions[i+4],positions[i+7]);
  if(length<0.015||Math.abs(ny)/length<0.75||maxY>12.0)continue;
  for(let j=0;j<9;j++)verts.push(positions[i+j]);
 }
 if(!verts.length){shanghaiGroundShadowReceiver=null;return;}
 const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
 shanghaiGroundShadowReceiver={pb,count:verts.length/3};
 console.info('Shanghai shadow receiving ground triangles',verts.length/9);
}
// Shanghai buildings: real elevated polygons from the imported track mesh.
// Only high structure faces are kept as casters; tarmac, grass and low kerbs are excluded.
// One GPU buffer is prepared at track load; it is not rebuilt each frame.
let shanghaiBuildingShadowCaster=null;
function buildShanghaiBuildingShadowCaster(positions){
 const elevated=[];let lowerGantries=0,highBuildings=0;
 for(let i=0;i+8<positions.length;i+=9){
  const y0=positions[i+1],y1=positions[i+4],y2=positions[i+7];
  const minY=Math.min(y0,y1,y2),averageY=(y0+y1+y2)/3;
  // Buildings, wall crowns AND overhead gantries/signboards. The older
  // >18-unit rule missed many real track signs suspended above the racing line.
  if(minY<4.5||averageY<7.0)continue;
  const ax=positions[i+3]-positions[i],ay=positions[i+4]-positions[i+1],az=positions[i+5]-positions[i+2];
  const bx=positions[i+6]-positions[i],by=positions[i+7]-positions[i+1],bz=positions[i+8]-positions[i+2];
  const cx=ay*bz-az*by,cy=az*bx-ax*bz,cz=ax*by-ay*bx;
  const area=.5*Math.hypot(cx,cy,cz),horizontalProjectedArea=.5*Math.abs(cy);
  if(!Number.isFinite(area)||area<0.025||area>950||horizontalProjectedArea>850)continue;
  if(Math.max(Math.hypot(ax,ay,az),Math.hypot(bx,by,bz))>135)continue;
  if(averageY<18)lowerGantries++;else highBuildings++;
  for(let k=0;k<9;k++)elevated.push(positions[i+k]);
 }
 if(!elevated.length){shanghaiBuildingShadowCaster=null;return;}
 const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(elevated),gl.STATIC_DRAW);
 shanghaiBuildingShadowCaster={pb,count:elevated.length/3};
 console.info('Shanghai shadow casters, lower gantry/sign surfaces',lowerGantries,'building surfaces',highBuildings);
}

function renderShanghaiBuildingShadow(){
 if(selectedTrack!=='shanghai'||!shanghaiBuildingShadowCaster)return;
 // Same 3D sun projection as the cars; buildings use their authored world-space triangles.
 gl.uniform3f(castLoc.car,0,0,0);gl.uniform1f(castLoc.heading,0);
 gl.uniform1f(castLoc.ground,0);gl.uniformMatrix4fv(castLoc.part,false,IDENTITY);
 gl.uniform1f(castLoc.wheel,0);gl.uniform1f(castLoc.spin,0);
 gl.uniform1f(castLoc.steer,0);gl.uniform1f(castLoc.front,0);
 casterMesh(shanghaiBuildingShadowCaster);
}
const SHADOW_WHEEL_CENTERS=[[0,0,0],[1.277133,-.184574,-.637920],[1.277133,-.184345,.640129],[-1.728492,-.198543,-.653947],[-1.729950,-.198543,.654607]];
function renderCasterShadow(team,x,z,heading,spin,steer,rideHeight){
 let asset=null,offset=.5,carHeading=heading;
 if(team==='mclaren'){asset=userCarAsset;offset=.577;}
 else if(team==='redbull'){asset=npcCarAsset;offset=.075;}
 else{asset=team==='ferrari'?ferrariCarAsset:team==='mercedes'?mercedesCarAsset:additionalTeamAssets[team];carHeading+=Math.PI;}
 const gy=(selectedTrack==='shanghai'&&Number.isFinite(rideHeight))?rideHeight:trackGroundY(x,z);
 gl.uniform3f(castLoc.car,x,gy+offset,z);gl.uniform1f(castLoc.heading,carHeading);gl.uniform1f(castLoc.ground,gy);
 gl.uniformMatrix4fv(castLoc.part,false,IDENTITY);gl.uniform1f(castLoc.wheel,0);gl.uniform1f(castLoc.spin,spin);gl.uniform1f(castLoc.steer,steer);
 if(asset&&(asset.batch||asset.batches)){
  const grouped=team==='mclaren'&&asset.batches;
  for(const batch of (asset.batches||[asset.batch])){
   if(batch.alphaMode==='BLEND')continue; // transparent glass shouldn't cast a solid wall-like shadow
   const group=grouped?(batch.group||0):0;
   const c=SHADOW_WHEEL_CENTERS[group]||SHADOW_WHEEL_CENTERS[0];
   gl.uniform1f(castLoc.wheel,group);gl.uniform3f(castLoc.center,c[0],c[1],c[2]);gl.uniform1f(castLoc.front,group===1||group===2?1:0);
   casterMesh(batch);
  }
 }else{
  // A fallback shape is still available before a selected model has finished loading.
  gl.uniform1f(castLoc.wheel,0);gl.uniform1f(castLoc.front,0);
  gl.uniform3f(castLoc.car,x,gy+.077,z);gl.uniform1f(castLoc.heading,heading);
  casterMesh(carBuffers);
  const wheelSet=[{x:-1.337,z:-.96,front:false},{x:-1.337,z:.96,front:false},{x:1.093,z:-.96,front:true},{x:1.093,z:.96,front:true}];
  for(const wheel of wheelSet){
   let part=translationMatrix(wheel.x,.34,wheel.z);
   if(wheel.front)part=multiply(part,carModelMatrix(0,0,0,steer));
   part=multiply(part,rotationZMatrix(spin));
   gl.uniformMatrix4fv(castLoc.part,false,part);
   casterMesh(wheelBuffers);
  }
  gl.uniformMatrix4fv(castLoc.part,false,IDENTITY);
 }
}
function renderRealCarShadows(vp){
 if(cachedStencilBits<2)return;
 // The visible scene was written into stencil bit zero during the regular depth-tested
 // track pass. Shadow geometry is projected onto a mathematical receiver plane, which
 // must NOT be depth-tested against the varying track height (source of old flicker/gaps).
 gl.enable(gl.STENCIL_TEST);
 gl.stencilFunc(gl.EQUAL,3,1); // compare only the scene-receiver bit
 gl.stencilMask(2);           // write only shadow-coverage bit
 gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE); // reference 3 preserves both bits
 gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
 gl.colorMask(false,false,false,false);gl.disable(gl.BLEND);
 gl.useProgram(castProg);gl.uniformMatrix4fv(castLoc.vp,false,vp);gl.uniform3fv(castLoc.sun,sunDirection);
 renderShanghaiBuildingShadow();
 // Player and NPC always share the exact same projection/light direction.
 if(npcGhostActive)renderCasterShadow(selectedNpcTeam,npcX,npcZ,npcHeading,npcWheelSpin,npcFrontWheelSteer,modelGroundY(selectedNpcTeam,npcRideY));
 renderCasterShadow(selectedPlayerTeam,carX,carZ,carHeading,wheelSpin,frontWheelSteer,modelGroundY(selectedPlayerTeam,playerRideY));
 // Composite precisely once per pixel; avoid repeated opacity where triangles overlap.
 gl.colorMask(true,true,true,true);gl.stencilMask(0);
 gl.stencilFunc(gl.EQUAL,3,3);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
 gl.useProgram(darkProg);gl.bindBuffer(gl.ARRAY_BUFFER,darkQuadBuffer);
 gl.enableVertexAttribArray(darkLoc);gl.vertexAttribPointer(darkLoc,2,gl.FLOAT,false,0,0);
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.drawArrays(gl.TRIANGLES,0,6);
 // Explicit state reset: models use their own vertex attributes, blending and depth.
 gl.disable(gl.BLEND);gl.colorMask(true,true,true,true);
 gl.stencilMask(255);gl.disable(gl.STENCIL_TEST);
 gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
 gl.useProgram(prog);
}

// Shanghai International Circuit: cleaned, vertex-colour game LOD; start grid shifted to the world origin.
const SHANGHAI_TRACK_DEFLATE_B64=__embeddedAssets["asset-016"];
const SHANGHAI_ROUTE_B64=__embeddedAssets["asset-017"];
const SHANGHAI_ROUTE=decodeFloat32(SHANGHAI_ROUTE_B64); // x,z,height,heading,absolute curvature
// Physics-only lookup extracted from the baked colours of the *original* Shanghai kerb meshes.
// Two bytes per centreline metre, one for each track side. Zero means no red kerb detected.
const SHANGHAI_ORIGINAL_KERB_B64=__embeddedAssets["asset-018"];
const SHANGHAI_KERB_BYTES=(()=>{const b=atob(SHANGHAI_ORIGINAL_KERB_B64),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;})();
const SHANGHAI_ROUTE_STRIDE=5;
const SHANGHAI_SAMPLE_COUNT=SHANGHAI_ROUTE.length/SHANGHAI_ROUTE_STRIDE;
const SHANGHAI_LOOP_LENGTH=5411.110360;
const SHANGHAI_PATH_STEP=1.000020395;
const SHANGHAI_MOTION_SCALE=2.45;
const SHANGHAI_BRAKE_DISTANCE_SCALE=2.45;
const SHANGHAI_CORNER_RADIUS=62.0;
// Solid collision boundary aligned beside the Shanghai circuit's existing roadside barriers.
// Road and kerb remain drivable; cars are stopped at a signed lateral offset of 10.2 units.
const SHANGHAI_COLLIDER_CELL=6.0;
let shanghaiWallGrid=null,shanghaiColliderCount=0;
let solidWallImpactTimer=0;
// Start grid inferred from the two blue placeholder cubes in the authored Shanghai model.
// Route is driven in reverse compared with the source raceline; these are stations on the reversed route.
const SHANGHAI_PLAYER_GRID_S=2.639;
const SHANGHAI_PLAYER_GRID_LANE=-2.533;
const SHANGHAI_NPC_GRID_S=SHANGHAI_LOOP_LENGTH-6.489;
const SHANGHAI_NPC_LANE_OFFSET=1.599;
const SHANGHAI_GRID_ORIGIN=Object.freeze({x:0,y:0,z:0});

const SILVERSTONE_SOURCE_GLB_B64=__embeddedAssets["asset-019"];
let silverstoneTrackBuffers=null;
const SILVERSTONE_ROUTE_B64=__embeddedAssets["asset-020"];
const SILVERSTONE_ROUTE=decodeFloat32(SILVERSTONE_ROUTE_B64); // x, z, heading, absolute curvature from uploaded GLB asphalt centerline
const SILVERSTONE_SAMPLE_COUNT=SILVERSTONE_ROUTE.length/4;
const SILVERSTONE_LOOP_LENGTH=5890.962190297;
const SILVERSTONE_PATH_STEP=0.999993582;
const SILVERSTONE_MOTION_SCALE=2.45; // scale displayed speed to the authored track's metre-like dimensions
const SILVERSTONE_BRAKE_DISTANCE_SCALE=2.45;
const SILVERSTONE_CORNER_RADIUS=360;

// Silverstone preview height and road proximity derived from the uploaded asphalt mesh.
// Separate from the historical Silverstone racing line, which is not aligned with this GLB.
const SILVERSTONE_GROUND_B64=__embeddedAssets["asset-021"];
let silverstoneTerrainH=null,silverstoneTerrainD=null;
async function loadSilverstoneTerrain(){
 const str=atob(SILVERSTONE_GROUND_B64),a=new Uint8Array(str.length);
 for(let i=0;i<str.length;i++)a[i]=str.charCodeAt(i);
 const bytes=new Uint8Array(await new Response(new Blob([a]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
 if(bytes.length!==419*591*3)throw new Error('Silverstone terrain data invalid');
 silverstoneTerrainH=new Int16Array(bytes.buffer,0,419*591);
 silverstoneTerrainD=new Uint8Array(bytes.buffer,419*591*2,419*591);
}
function silverstoneField(x,z,road){
 if(!silverstoneTerrainH)return road?0:0;
 const fx=Math.max(0,Math.min(417.999,(x+1030)/5)),fz=Math.max(0,Math.min(589.999,(z+1480)/5));
 const ix=Math.floor(fx),iz=Math.floor(fz),ax=fx-ix,az=fz-iz;
 const a=iz*419+ix,arr=road?silverstoneTerrainD:silverstoneTerrainH;
 return (arr[a]*(1-ax)*(1-az)+arr[a+1]*ax*(1-az)+arr[a+419]*(1-ax)*az+arr[a+420]*ax*az)*(road?.1:.01);
}


// User-authored Blender markers / Singapore GLB node markers. The source indices are never renumbered.
const SPA_SEMANTIC_META = {"model":"spa_track_annotated_roles (1).glb","model_source":"spa_track_annotated_roles (1).glb","road_object":"Object_13","kerb_object":"Object_33","grass_objects":["Object_76","Object_79"],"wall_objects":["Object_31","Object_61"],"guide_object":"Object_37","grid":[{"index":0,"original_name":"空物体","role":"grid","position":[-305.8957824707031,0,-727.26123046875]},{"index":1,"original_name":"空物体.001","role":"grid","position":[-307.7304382324219,0,-716.4781494140625]},{"index":2,"original_name":"空物体.002","role":"grid","position":[-297.4913635253906,0,-714.0962524414062]},{"index":3,"original_name":"空物体.003","role":"grid","position":[-299.5329895019531,0,-703.0838623046875]},{"index":4,"original_name":"空物体.004","role":"grid","position":[-289.1701965332031,0,-700.609130859375]},{"index":5,"original_name":"空物体.005","role":"grid","position":[-290.8406066894531,0,-689.4358520507812]},{"index":6,"original_name":"空物体.006","role":"grid","position":[-280.4840087890625,0,-686.83740234375]},{"index":7,"original_name":"空物体.007","role":"grid","position":[-282.4884948730469,0,-676.258056640625]},{"index":8,"original_name":"空物体.008","role":"grid","position":[-272.0205383300781,0,-673.1028442382812]},{"index":9,"original_name":"空物体.009","role":"grid","position":[-274.09185791015625,0,-662.9318237304688]},{"index":10,"original_name":"空物体.010","role":"grid","position":[-263.35662841796875,0,-659.635498046875]},{"index":11,"original_name":"空物体.011","role":"grid","position":[-265.76202392578125,0,-648.9893188476562]},{"index":12,"original_name":"空物体.012","role":"grid","position":[-254.89315795898438,0,-646.0939331054688]},{"index":13,"original_name":"空物体.013","role":"grid","position":[-257.0758361816406,0,-635.536865234375]},{"index":14,"original_name":"空物体.014","role":"grid","position":[-246.69696044921875,0,-632.68603515625]},{"index":15,"original_name":"空物体.015","role":"grid","position":[-248.34510803222656,0,-621.9508056640625]},{"index":16,"original_name":"空物体.016","role":"grid","position":[-237.87713623046875,0,-619.1444702148438]},{"index":17,"original_name":"空物体.017","role":"grid","position":[-240.2250518798828,0,-608.4010009765625]},{"index":18,"original_name":"空物体.018","role":"grid","position":[-229.52496337890625,0,-605.3062133789062]},{"index":19,"original_name":"空物体.019","role":"grid","position":[-231.5662078857422,0,-594.6719970703125]},{"index":20,"original_name":"空物体.020","role":"grid","position":[-220.99781799316406,0,-592.10400390625]},{"index":21,"original_name":"空物体.021","role":"grid","position":[-223.0390625,0,-581.1076049804688]},{"index":22,"original_name":"空物体.022","role":"grid","position":[-212.53651428222656,0,-578.3749389648438]},{"index":23,"original_name":"空物体.023","role":"grid","position":[-214.3143768310547,0,-567.6090087890625]},{"index":24,"original_name":"空物体.024","role":"grid","position":[-204.00936889648438,0,-564.8434448242188]},{"index":25,"original_name":"空物体.025","role":"grid","position":[-205.88600158691406,0,-554.2750244140625]}],"finish":{"index":26,"original_name":"空物体.026","role":"finish","position":[-245.11671447753906,0,-624.2530517578125],"rotation":[0,0.9431052207946777,0,0.33249443769454956]},"heading":1.0026245940777287,"orientation":"xy_horizontal_z_up","status":"geometry matches marked Blender mesh; free drive until validated racing-line","terrain":{"origin":[-721.4506225585938,-1049.554931640625],"step":6.0,"nx":243,"nz":367,"height_scale":0.01,"near_road_distance_scale":0.2,"packed_layout":"i16 height then u8 nearest road vertex distance"},"model_transform":"root X +90 deg: raw (x,y,z) -> world (x,-z,y); grid empties are world (x,y,z)"};
const SINGAPORE_SEMANTIC_META = {"model":"singapore GLB","source":"singapor track.glb","markers":[{"index":0,"original_name":"\u7a7a\u7269\u4f53","role":"grid","position":[-600.1569213867188,0,300.1205749511719],"rotation":null},{"index":1,"original_name":"\u7a7a\u7269\u4f53.001","role":"grid","position":[-595.0401611328125,0,291.7666931152344],"rotation":null},{"index":2,"original_name":"\u7a7a\u7269\u4f53.002","role":"grid","position":[-597.1110229492188,0,275.98858642578125],"rotation":null},{"index":3,"original_name":"\u7a7a\u7269\u4f53.003","role":"grid","position":[-602.227783203125,0,284.34246826171875],"rotation":null},{"index":4,"original_name":"\u7a7a\u7269\u4f53.004","role":"grid","position":[-606.4953002929688,0,251.6217041015625],"rotation":null},{"index":5,"original_name":"\u7a7a\u7269\u4f53.005","role":"grid","position":[-601.3785400390625,0,243.26780700683594],"rotation":null},{"index":6,"original_name":"\u7a7a\u7269\u4f53.006","role":"grid","position":[-599.3076782226562,0,259.0459289550781],"rotation":null},{"index":7,"original_name":"\u7a7a\u7269\u4f53.007","role":"grid","position":[-604.4244384765625,0,267.3998107910156],"rotation":null},{"index":8,"original_name":"\u7a7a\u7269\u4f53.008","role":"grid","position":[-612.6429443359375,0,203.1411590576172],"rotation":null},{"index":9,"original_name":"\u7a7a\u7269\u4f53.009","role":"grid","position":[-607.5261840820312,0,194.7872772216797],"rotation":null},{"index":10,"original_name":"\u7a7a\u7269\u4f53.010","role":"grid","position":[-609.5970458984375,0,179.0091552734375],"rotation":null},{"index":11,"original_name":"\u7a7a\u7269\u4f53.011","role":"grid","position":[-614.7138061523438,0,187.36305236816406],"rotation":null},{"index":12,"original_name":"\u7a7a\u7269\u4f53.012","role":"grid","position":[-610.4462890625,0,220.0838165283203],"rotation":null},{"index":13,"original_name":"\u7a7a\u7269\u4f53.013","role":"grid","position":[-605.3295288085938,0,211.7299346923828],"rotation":null},{"index":14,"original_name":"\u7a7a\u7269\u4f53.014","role":"grid","position":[-603.2586669921875,0,227.50804138183594],"rotation":null},{"index":15,"original_name":"\u7a7a\u7269\u4f53.015","role":"grid","position":[-608.3754272460938,0,235.86192321777344],"rotation":null},{"index":16,"original_name":"\u7a7a\u7269\u4f53.016","role":"grid","position":[-624.9089965820312,0,107.75001525878906],"rotation":null},{"index":17,"original_name":"\u7a7a\u7269\u4f53.017","role":"grid","position":[-619.792236328125,0,99.39613342285156],"rotation":null},{"index":18,"original_name":"\u7a7a\u7269\u4f53.018","role":"grid","position":[-621.8630981445312,0,83.61802673339844],"rotation":null},{"index":19,"original_name":"\u7a7a\u7269\u4f53.019","role":"grid","position":[-626.9798583984375,0,91.97190856933594],"rotation":null},{"index":20,"original_name":"\u7a7a\u7269\u4f53.020","role":"finish","position":[-617.9863891601562,0,136.38790893554688],"rotation":[0,-0.044662680476903915,0,0.9990021586418152]},{"index":22,"original_name":"\u7a7a\u7269\u4f53.022","role":"grid","position":[-624.0597534179688,0,66.67536926269531],"rotation":null},{"index":23,"original_name":"\u7a7a\u7269\u4f53.023","role":"grid","position":[-629.176513671875,0,75.02925109863281],"rotation":null},{"index":24,"original_name":"\u7a7a\u7269\u4f53.024","role":"grid","position":[-620.9580078125,0,139.28790283203125],"rotation":null},{"index":25,"original_name":"\u7a7a\u7269\u4f53.025","role":"grid","position":[-615.8412475585938,0,130.93402099609375],"rotation":null},{"index":26,"original_name":"\u7a7a\u7269\u4f53.026","role":"grid","position":[-617.912109375,0,115.15589904785156],"rotation":null},{"index":27,"original_name":"\u7a7a\u7269\u4f53.027","role":"grid","position":[-623.0288696289062,0,123.50979614257812],"rotation":null},{"index":28,"original_name":"\u7a7a\u7269\u4f53.028","role":"grid","position":[-618.7613525390625,0,156.23056030273438],"rotation":null},{"index":29,"original_name":"\u7a7a\u7269\u4f53.029","role":"grid","position":[-613.6445922851562,0,147.87667846679688],"rotation":null},{"index":30,"original_name":"\u7a7a\u7269\u4f53.030","role":"grid","position":[-611.57373046875,0,163.65478515625],"rotation":null},{"index":31,"original_name":"\u7a7a\u7269\u4f53.031","role":"grid","position":[-616.6904907226562,0,172.0086669921875],"rotation":null}],"grid":[{"index":0,"original_name":"\u7a7a\u7269\u4f53","role":"grid","position":[-600.1569213867188,0,300.1205749511719],"rotation":null},{"index":1,"original_name":"\u7a7a\u7269\u4f53.001","role":"grid","position":[-595.0401611328125,0,291.7666931152344],"rotation":null},{"index":2,"original_name":"\u7a7a\u7269\u4f53.002","role":"grid","position":[-597.1110229492188,0,275.98858642578125],"rotation":null},{"index":3,"original_name":"\u7a7a\u7269\u4f53.003","role":"grid","position":[-602.227783203125,0,284.34246826171875],"rotation":null},{"index":4,"original_name":"\u7a7a\u7269\u4f53.004","role":"grid","position":[-606.4953002929688,0,251.6217041015625],"rotation":null},{"index":5,"original_name":"\u7a7a\u7269\u4f53.005","role":"grid","position":[-601.3785400390625,0,243.26780700683594],"rotation":null},{"index":6,"original_name":"\u7a7a\u7269\u4f53.006","role":"grid","position":[-599.3076782226562,0,259.0459289550781],"rotation":null},{"index":7,"original_name":"\u7a7a\u7269\u4f53.007","role":"grid","position":[-604.4244384765625,0,267.3998107910156],"rotation":null},{"index":8,"original_name":"\u7a7a\u7269\u4f53.008","role":"grid","position":[-612.6429443359375,0,203.1411590576172],"rotation":null},{"index":9,"original_name":"\u7a7a\u7269\u4f53.009","role":"grid","position":[-607.5261840820312,0,194.7872772216797],"rotation":null},{"index":10,"original_name":"\u7a7a\u7269\u4f53.010","role":"grid","position":[-609.5970458984375,0,179.0091552734375],"rotation":null},{"index":11,"original_name":"\u7a7a\u7269\u4f53.011","role":"grid","position":[-614.7138061523438,0,187.36305236816406],"rotation":null},{"index":12,"original_name":"\u7a7a\u7269\u4f53.012","role":"grid","position":[-610.4462890625,0,220.0838165283203],"rotation":null},{"index":13,"original_name":"\u7a7a\u7269\u4f53.013","role":"grid","position":[-605.3295288085938,0,211.7299346923828],"rotation":null},{"index":14,"original_name":"\u7a7a\u7269\u4f53.014","role":"grid","position":[-603.2586669921875,0,227.50804138183594],"rotation":null},{"index":15,"original_name":"\u7a7a\u7269\u4f53.015","role":"grid","position":[-608.3754272460938,0,235.86192321777344],"rotation":null},{"index":16,"original_name":"\u7a7a\u7269\u4f53.016","role":"grid","position":[-624.9089965820312,0,107.75001525878906],"rotation":null},{"index":17,"original_name":"\u7a7a\u7269\u4f53.017","role":"grid","position":[-619.792236328125,0,99.39613342285156],"rotation":null},{"index":18,"original_name":"\u7a7a\u7269\u4f53.018","role":"grid","position":[-621.8630981445312,0,83.61802673339844],"rotation":null},{"index":19,"original_name":"\u7a7a\u7269\u4f53.019","role":"grid","position":[-626.9798583984375,0,91.97190856933594],"rotation":null},{"index":22,"original_name":"\u7a7a\u7269\u4f53.022","role":"grid","position":[-624.0597534179688,0,66.67536926269531],"rotation":null},{"index":23,"original_name":"\u7a7a\u7269\u4f53.023","role":"grid","position":[-629.176513671875,0,75.02925109863281],"rotation":null},{"index":24,"original_name":"\u7a7a\u7269\u4f53.024","role":"grid","position":[-620.9580078125,0,139.28790283203125],"rotation":null},{"index":25,"original_name":"\u7a7a\u7269\u4f53.025","role":"grid","position":[-615.8412475585938,0,130.93402099609375],"rotation":null},{"index":26,"original_name":"\u7a7a\u7269\u4f53.026","role":"grid","position":[-617.912109375,0,115.15589904785156],"rotation":null},{"index":27,"original_name":"\u7a7a\u7269\u4f53.027","role":"grid","position":[-623.0288696289062,0,123.50979614257812],"rotation":null},{"index":28,"original_name":"\u7a7a\u7269\u4f53.028","role":"grid","position":[-618.7613525390625,0,156.23056030273438],"rotation":null},{"index":29,"original_name":"\u7a7a\u7269\u4f53.029","role":"grid","position":[-613.6445922851562,0,147.87667846679688],"rotation":null},{"index":30,"original_name":"\u7a7a\u7269\u4f53.030","role":"grid","position":[-611.57373046875,0,163.65478515625],"rotation":null},{"index":31,"original_name":"\u7a7a\u7269\u4f53.031","role":"grid","position":[-616.6904907226562,0,172.0086669921875],"rotation":null}],"finish":{"index":20,"original_name":"\u7a7a\u7269\u4f53.020","role":"finish","position":[-617.9863891601562,0,136.38790893554688],"rotation":[0,-0.044662680476903915,0,0.9990021586418152]},"heading":2.1203570044458067,"status":"source marker numbering preserved, no index21, preview only; road mesh roles not provided"};

// v2.16.8: Spa ROAD (asph.001) triangles rasterized at 1.5m, not 6m nearest vertices.
// Accurate track contact is separate from chassis visual suspension damping.
const SPA_PRECISE_TERRAIN_META={"origin":[-656,-1080],"step":1.5,"nx":880,"nz":1470,"height_scale":0.01,"distance_scale":1.0,"packed_layout":"i16 precise triangle height + u8 distance in metres"};
const SPA_PRECISE_TERRAIN_B64=__embeddedAssets["asset-022"];
let spaPreciseTerrainHeight=null,spaPreciseTerrainDistance=null;
async function preparePreciseSpaTerrain(){
 if(spaPreciseTerrainHeight)return;
 const packed=Uint8Array.from(atob(SPA_PRECISE_TERRAIN_B64),v=>v.charCodeAt(0));
 const bytes=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
 const t=SPA_PRECISE_TERRAIN_META,cells=t.nx*t.nz;
 if(bytes.byteLength!==cells*3)throw new Error('Spa precise terrain size invalid');
 spaPreciseTerrainHeight=new Int16Array(bytes,0,cells);
 spaPreciseTerrainDistance=new Uint8Array(bytes,cells*2,cells);
 console.info('SPA precise road triangle terrain loaded',t.nx,t.nz,'at',t.step,'m resolution');
}
// SURFACE_CONTACT_BEGIN
// Sparse triangle bins in the same world space used by the visible track.
const venueContacts={};
function addVenueContact(key,kind,positions,indices,scale=1,rotate=false){
 const venue=venueContacts[key]||(venueContacts[key]={});
 const field=venue[kind]||(venue[kind]={bins:new Map(),triangles:[],step:8});
 const point=i=>{const q=i*3;return [positions[q]*scale,(rotate?positions[q+1]:positions[q+2])*scale,(rotate?-positions[q+2]:positions[q+1])*scale];}; // x,z,height
 const count=indices?indices.length:positions.length/3;
 for(let i=0;i+2<count;i+=3){
  const a=point(indices?indices[i]:i),b=point(indices?indices[i+1]:i+1),c=point(indices?indices[i+2]:i+2);
  const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  const ux=b[0]-a[0],uz=b[1]-a[1],uy=b[2]-a[2],vx=c[0]-a[0],vz=c[1]-a[1],vy=c[2]-a[2];
  const normal=Math.hypot(uz*vy-uy*vz,uy*vx-ux*vy,det);
  if(Math.abs(det)<1e-6||Math.abs(det)/normal<.65)continue; // exclude vertical kerb ends/walls
  if(key==='singapore'&&Math.abs((a[2]+b[2]+c[2])/3-47.54)>.8)continue;
  const minX=Math.floor(Math.min(a[0],b[0],c[0])/field.step),maxX=Math.floor(Math.max(a[0],b[0],c[0])/field.step);
  const minZ=Math.floor(Math.min(a[1],b[1],c[1])/field.step),maxZ=Math.floor(Math.max(a[1],b[1],c[1])/field.step);
  const tri={a,b,c,det};field.triangles.push(tri);
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const k=x+','+z;let bin=field.bins.get(k);if(!bin)field.bins.set(k,bin=[]);bin.push(tri);}
 }
}
function venueContactAt(key,kind,x,z,reference=0,details=false){
 const f=venueContacts[key]?.[kind];if(!f)return null;
 const bin=f.bins.get(Math.floor(x/f.step)+','+Math.floor(z/f.step));if(!bin)return null;
 let best=null,bestTriangle=null;
 for(const t of bin){const {a,b,c,det}=t;
  const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/det;
  const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/det,w=1-u-v;
  if(u< -1e-5||v< -1e-5||w< -1e-5)continue;
  const y=u*a[2]+v*b[2]+w*c[2];
  if(best===null||Math.abs(y-reference)<Math.abs(best-reference)){best=y;bestTriangle=t;}
 }
 if(details&&bestTriangle){const {a,b,c,det}=bestTriangle;
  return {height:best,gradX:((a[2]-c[2])*(b[1]-c[1])-(b[2]-c[2])*(a[1]-c[1]))/det,
   gradZ:((a[0]-c[0])*(b[2]-c[2])-(b[0]-c[0])*(a[2]-c[2]))/det};}
 return best;
}
// SURFACE_CONTACT_END
function spaPreciseHeightAt(x,z){
 const mesh=venueContactAt('spa','road',x,z);if(mesh!==null)return mesh;
 if(!spaPreciseTerrainHeight)return -spaField(x,z,false);
 const t=SPA_PRECISE_TERRAIN_META;
 const fx=Math.max(0,Math.min(t.nx-1.001,(x-t.origin[0])/t.step));
 const fz=Math.max(0,Math.min(t.nz-1.001,(z-t.origin[1])/t.step));
 const ix=Math.floor(fx),iz=Math.floor(fz),dx=fx-ix,dz=fz-iz,ind=iz*t.nx+ix;
 const a=spaPreciseTerrainHeight;
 const height=(a[ind]*(1-dx)*(1-dz)+a[ind+1]*dx*(1-dz)+a[ind+t.nx]*(1-dx)*dz+a[ind+t.nx+1]*dx*dz)*t.height_scale;
 const d=spaPreciseTerrainDistance;
 const gap=(d[ind]*(1-dx)*(1-dz)+d[ind+1]*dx*(1-dz)+d[ind+t.nx]*(1-dx)*dz+d[ind+t.nx+1]*dx*dz);
 // Far outside paved asphalt, blend with historical terrain rather than extending a cliff's height.
 const fade=Math.max(0,Math.min(1,(gap-13)/9));
 return height*(1-fade)+(-spaField(x,z,false))*fade;
}
// Continuous local terrain plane, not a changing maximum of five wheel samples.
// 4x4 Catmull-Rom reconstruction makes slope continuous between the authored 1.5m cells.
function spaContinuousHeight(x,z){
 const mesh=venueContactAt('spa','road',x,z);if(mesh!==null)return mesh;
 if(!spaPreciseTerrainHeight)return spaPreciseHeightAt(x,z);
 const m=SPA_PRECISE_TERRAIN_META,arr=spaPreciseTerrainHeight;
 const fx=Math.max(1,Math.min(m.nx-2.002,(x-m.origin[0])/m.step));
 const fz=Math.max(1,Math.min(m.nz-2.002,(z-m.origin[1])/m.step));
 const ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz;
 const cr=(a,b,c,d,t)=>b+0.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
 const r=[];
 for(let j=-1;j<=2;j++){const q=(iz+j)*m.nx+ix;
  r.push(cr(arr[q-1],arr[q],arr[q+1],arr[q+2],u));}
 const h=cr(r[0],r[1],r[2],r[3],v)*m.height_scale;
 // Reject only large spikes in the source raster; keep the actual uphill slope.
 const c=spaPreciseHeightAt(x,z);
 return Math.max(c-0.22,Math.min(c+0.22,h));
}
// 2.17.0: chassis height uses a road-plane fit over the wheelbase, rather than
// reproducing every 1.5 m raster-cell ripple in the car's rigid body.
// ROAD_ANGLES_BEGIN
function roadSlopeAngles(gradX,gradZ,heading){
 const c=Math.cos(heading),s=Math.sin(heading);
 const forward=gradX*c+gradZ*s,across=-gradX*s+gradZ*c;
 // carVs applies pitch about Z, then roll about X: positive roll lowers +Z.
 return {pitch:Math.atan(forward/Math.hypot(1,across)),roll:-Math.atan(across)};
}
// ROAD_ANGLES_END
function spaGroundPose(x,z,heading){
 const contact=venueContactAt('spa','road',x,z,0,true);
 if(contact){const angles=roadSlopeAngles(contact.gradX,contact.gradZ,heading);
  return {y:contact.height+.005,rawY:contact.height,...angles,gradX:contact.gradX,gradZ:contact.gradZ};}
 const c=Math.cos(heading),s=Math.sin(heading),frontSpan=1.7,sideSpan=.92;
 const hc=spaContinuousHeight(x,z);
 const hf=spaContinuousHeight(x+c*frontSpan,z+s*frontSpan);
 const hr=spaContinuousHeight(x-c*frontSpan,z-s*frontSpan);
 const hl=spaContinuousHeight(x-s*sideSpan,z+c*sideSpan);
 const ht=spaContinuousHeight(x+s*sideSpan,z-c*sideSpan);
 // A flat or uniformly inclined road returns its exact surface plane.
 // High-frequency imperfections in individual raster cells are absorbed.
 const planeHeight=.36*hc+.17*(hf+hr)+.15*(hl+ht);
 const riseForward=(hf-hr)/(2*frontSpan),riseLeft=(hl-ht)/(2*sideSpan);
 const {pitch,roll}=roadSlopeAngles(c*riseForward-s*riseLeft,s*riseForward+c*riseLeft,heading);
 const rawY=spaPreciseHeightAt(x,z);
 const y=Math.max(planeHeight+.005,rawY+.005);
 return {y,rawY,pitch:Math.max(-.32,Math.min(.32,pitch)),roll:Math.max(-.32,Math.min(.32,roll)),
  gradX:c*riseForward-s*riseLeft,gradZ:s*riseForward+c*riseLeft};
}
// Predict the broad slope ahead, then filter only the unexpected height error.
// A minimum true-road clearance prevents the old uphill clipping regression.
function makeSpaRideFilter(){return {valid:false,x:0,z:0,y:0,pitch:0,roll:0,gradX:0,gradZ:0};}
function resetSpaRideFilter(st){st.valid=false;}
function filterSpaRide(st,pose,x,z,dt){
 const dx=x-st.x,dz=z-st.z;
 if(!st.valid||dx*dx+dz*dz>144||dt<=0){
  st.valid=true;st.x=x;st.z=z;st.y=pose.y;st.pitch=pose.pitch;st.roll=pose.roll;
 }else{
  const predicted=st.y+st.gradX*dx+st.gradZ*dz;
  const error=pose.y-predicted;
  // Roughly 3cm is tyre/suspension travel: do not transmit it as an instant body hop.
  // Larger discontinuities are absorbed over several frames, not stepped through.
  const absorbRate=Math.abs(error)>.030?9.0:16.0;
  st.y=predicted+error*(1-Math.exp(-Math.min(.05,dt)*absorbRate));
  st.y=Math.max(st.y,pose.rawY+.005);
  const poseAlpha=1-Math.exp(-Math.min(.05,dt)*12.0);
  st.pitch+=(pose.pitch-st.pitch)*poseAlpha;
  st.roll+=(pose.roll-st.roll)*poseAlpha;
  st.x=x;st.z=z;
 }
 st.gradX=pose.gradX;st.gradZ=pose.gradZ;
 return st;
}
function spaChassisGroundAt(x,z,heading){return spaGroundPose(x,z,heading).y;}


const SPA_ROAD_FIELD_B64=__embeddedAssets["asset-023"];
const SPA_ORIGINAL_GLB_B64=__embeddedAssets["asset-024"];
const SINGAPORE_ORIGINAL_GLB_B64=__embeddedAssets["asset-025"];
const UNVERIFIED_TRACKS=['spa','singapore'];
let spaFieldH=null,spaFieldD=null;
async function prepareSpaField(){
 if(spaFieldH)return;
 const raw=atob(SPA_ROAD_FIELD_B64),data=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)data[i]=raw.charCodeAt(i);
 const decoded=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
 const t=SPA_SEMANTIC_META.terrain,cells=t.nx*t.nz;
 if(decoded.byteLength!==cells*3)throw new Error('Spa road-field size mismatch');
 spaFieldH=new Int16Array(decoded,0,cells);spaFieldD=new Uint8Array(decoded,cells*2,cells);
}
function spaField(x,z,distance){
 if(!spaFieldH)return distance?255:0;
 const t=SPA_SEMANTIC_META.terrain;
 const fx=Math.max(0,Math.min(t.nx-1.001,(x-t.origin[0])/t.step));
 const fz=Math.max(0,Math.min(t.nz-1.001,(z-t.origin[1])/t.step));
 const ix=Math.floor(fx),iz=Math.floor(fz),dx=fx-ix,dz=fz-iz;
 const arr=distance?spaFieldD:spaFieldH;
 // Road-distance data remains bilinear. Height uses C1-continuous bicubic Catmull-Rom,
 // avoiding the sudden change of slope at every 6-metre sample (the staircase issue).
 if(distance){const a=iz*t.nx+ix;
  return (arr[a]*(1-dx)*(1-dz)+arr[a+1]*dx*(1-dz)+arr[a+t.nx]*(1-dx)*dz+arr[a+t.nx+1]*dx*dz)*.2;
 }
 const sample=(i,j)=>arr[Math.max(0,Math.min(t.nz-1,j))*t.nx+Math.max(0,Math.min(t.nx-1,i))];
 const cubic=(a,b,c,d,f)=>b+.5*f*(c-a+f*(2*a-5*b+4*c-d+f*(3*(b-c)+d-a)));
 const row=[];
 for(let j=-1;j<=2;j++)row.push(cubic(sample(ix-1,iz+j),sample(ix,iz+j),sample(ix+1,iz+j),sample(ix+2,iz+j),dx));
 const v=cubic(row[0],row[1],row[2],row[3],dz);
 const corners=[sample(ix,iz),sample(ix+1,iz),sample(ix,iz+1),sample(ix+1,iz+1)];
 return Math.max(Math.min(...corners)-40,Math.min(Math.max(...corners)+40,v))*.01;
}

// v2.16.7 real imported venue collision, prepared from the actual GLB vertical faces.
// SPA: authored WALL meshes + barriers + fences. Silverstone: barrier/tyre-wall materials.
// Singapore: low vertical geometry candidate only; proximity/height checked at every hit.
// Each entry is [ax,az,bx,bz,lowY,highY] from the original mesh; no constant-distance invisible walls.
const TRACK_WALL_PACKED={
 spa:__embeddedAssets["asset-026"],
 silverstone:__embeddedAssets["asset-027"],
 singapore:__embeddedAssets["asset-028"]
};
const trackWallGrids=Object.create(null);
const TRACK_WALL_CELL=16;
async function prepareVenueWallCollision(track){
 if(trackWallGrids[track])return;
 const packed=TRACK_WALL_PACKED[track];if(!packed)return;
 const zipped=Uint8Array.from(atob(packed),v=>v.charCodeAt(0));
 const bytes=await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
 const data=new Float32Array(bytes);const grid=new Map(),cell=TRACK_WALL_CELL;
 for(let k=0;k+5<data.length;k+=6){
  const seg=[data[k],data[k+1],data[k+2],data[k+3],data[k+4],data[k+5]];
  const x0=Math.floor((Math.min(seg[0],seg[2])-1.2)/cell),x1=Math.floor((Math.max(seg[0],seg[2])+1.2)/cell);
  const z0=Math.floor((Math.min(seg[1],seg[3])-1.2)/cell),z1=Math.floor((Math.max(seg[1],seg[3])+1.2)/cell);
  for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){
   const key=ix+','+iz;let list=grid.get(key);
   if(!list){list=[];grid.set(key,list);}list.push(seg);
  }
 }
 trackWallGrids[track]=grid;
 console.info('VENUE SOLID WALL',track,'segments',data.length/6,'cells',grid.size);
}
function venueWallHit(track,x0,z0,x1,z1){
 const grid=trackWallGrids[track];if(!grid)return false;
 const cell=TRACK_WALL_CELL,radius=.8,checked=new Set();
 // Use the road-height target, NOT a collision height fixed to y=0 on mountainous Spa.
 const ground=rideTargetY(x1,z1);
 const lowX=Math.floor((Math.min(x0,x1)-radius)/cell),highX=Math.floor((Math.max(x0,x1)+radius)/cell);
 const lowZ=Math.floor((Math.min(z0,z1)-radius)/cell),highZ=Math.floor((Math.max(z0,z1)+radius)/cell);
 for(let ix=lowX;ix<=highX;ix++)for(let iz=lowZ;iz<=highZ;iz++){
  const list=grid.get(ix+','+iz);if(!list)continue;
  for(const wall of list){if(checked.has(wall))continue;checked.add(wall);
   if(ground+1.35<wall[4]||ground>wall[5]+.45)continue;
   const ax=wall[0],az=wall[1],bx=wall[2],bz=wall[3];
   const ux=x1-x0,uz=z1-z0,vx=bx-ax,vz=bz-az,wx=x0-ax,wz=z0-az;
   const A=ux*ux+uz*uz,B=ux*vx+uz*vz,C=vx*vx+vz*vz,D=ux*wx+uz*wz,E=vx*wx+vz*wz;
   let sn=0,tn=0,den=A*C-B*B;
   if(den>1e-8)sn=Math.max(0,Math.min(1,(B*E-C*D)/den));
   tn=C>1e-8?Math.max(0,Math.min(1,(B*sn+E)/C)):0;
   sn=A>1e-8?Math.max(0,Math.min(1,(B*tn-D)/A)):0;
   const dx=wx+sn*ux-tn*vx,dz=wz+sn*uz-tn*vz;
   if(dx*dx+dz*dz<radius*radius)return true;
  }
 }
 return false;
}

// The current game uses WebGL1. This is a separate native-GLB drawing path,
// sharing the original geometry/UV/materials without decimation or vertex-colour baking.
const importedVs=`attribute vec3 aImportPos;attribute vec2 aImportUV;attribute vec3 aImportNormal;
uniform mat4 uImportVP;uniform mat4 uImportObject;uniform vec3 uImportSun;
varying vec2 vImportUV;varying float vImportLight;
void main(){vec4 w=uImportObject*vec4(aImportPos,1.0);
 gl_Position=uImportVP*w;vImportUV=aImportUV;
 vec3 n=normalize(mat3(uImportObject)*aImportNormal);
 vImportLight=.68+.32*max(dot(n,normalize(uImportSun)),0.0);}`;
const importedFs=`precision mediump float;uniform sampler2D uImportTex;uniform vec4 uImportColor;
uniform float uImportHasTex;uniform float uImportCutoff;uniform float uImportOpacity;uniform float uImportOpaque;
varying vec2 vImportUV;varying float vImportLight;
void main(){vec4 c=uImportColor*(uImportHasTex>.5?texture2D(uImportTex,vImportUV):vec4(1.0));
 if(uImportOpaque>.5)c.a=1.0;
 if(c.a<uImportCutoff)discard;gl_FragColor=vec4(min(c.rgb*vImportLight,vec3(1.)),c.a*uImportOpacity);}`;
const importedProg=gl.createProgram();gl.attachShader(importedProg,shader(gl.VERTEX_SHADER,importedVs));gl.attachShader(importedProg,shader(gl.FRAGMENT_SHADER,importedFs));gl.linkProgram(importedProg);
if(!gl.getProgramParameter(importedProg,gl.LINK_STATUS))throw new Error('Imported circuit shader: '+gl.getProgramInfoLog(importedProg));
const impLoc={p:gl.getAttribLocation(importedProg,'aImportPos'),n:gl.getAttribLocation(importedProg,'aImportNormal'),uv:gl.getAttribLocation(importedProg,'aImportUV'),vp:gl.getUniformLocation(importedProg,'uImportVP'),obj:gl.getUniformLocation(importedProg,'uImportObject'),sun:gl.getUniformLocation(importedProg,'uImportSun'),tex:gl.getUniformLocation(importedProg,'uImportTex'),color:gl.getUniformLocation(importedProg,'uImportColor'),has:gl.getUniformLocation(importedProg,'uImportHasTex'),cut:gl.getUniformLocation(importedProg,'uImportCutoff'),opacity:gl.getUniformLocation(importedProg,'uImportOpacity'),opaque:gl.getUniformLocation(importedProg,'uImportOpaque')};
const IMP_SPA_MODEL=new Float32Array([1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1]); // exported Spa root: x,y,z -> x,-z,y
// glTF Singapore node: x-axis rotation +90 degrees with a uniform 2.1 scale.
const IMP_SG_MODEL=new Float32Array([2.1,0,0,0, 0,0,2.1,0, 0,-2.1,0,0, 0,0,0,1]);
let importedTracks={spa:null,singapore:null},importedLoading={};
async function loadImportedCircuit(key){
 if(importedTracks[key])return importedTracks[key];
 if(importedLoading[key])return importedLoading[key];
 const card=document.getElementById(key==='spa'?'selectSpaTrack':'selectSingaporeTrack');
 const action=card.querySelector('.mode-action');
 card.disabled=true;action.textContent='DECOMPRESSING ORIGINAL GLB / LOADING TEXTURES…';
 importedLoading[key]=(async()=>{
  const b64=key==='spa'?SPA_ORIGINAL_GLB_B64:SINGAPORE_ORIGINAL_GLB_B64;
  const ascii=atob(b64),deflated=new Uint8Array(ascii.length);
  for(let i=0;i<ascii.length;i++)deflated[i]=ascii.charCodeAt(i);
  const decompressed=await new Response(new Blob([deflated]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
  const dv=new DataView(decompressed);if(dv.getUint32(0,true)!==0x46546c67)throw new Error('Invalid '+key+' GLB');
  const jsonLength=dv.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(decompressed,20,jsonLength)));
  const binOff=20+jsonLength+8,bin=decompressed.slice(binOff,binOff+dv.getUint32(20+jsonLength,true));
  const ext=gl.getExtension('OES_element_index_uint');
  const white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,white);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  const imageTex=doc.images.map(()=>white);
  // Upload sequentially: a simultaneous decode of ~200 original PNG textures can exhaust GPU memory.
  for(let i=0;i<(doc.images||[]).length;i++){
   try{
    const img=doc.images[i],bv=doc.bufferViews[img.bufferView];
    const blob=new Blob([bin.slice(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength)],{type:img.mimeType||'image/png'});
    const bitmap=await createImageBitmap(blob,{premultiplyAlpha:'none'});
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);
    const powerOfTwo=n=>(n&(n-1))===0;
    const wrap=(powerOfTwo(bitmap.width)&&powerOfTwo(bitmap.height))?gl.REPEAT:gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    bitmap.close();imageTex[i]=tex;
   }catch(e){console.warn(key,'source image',i,'could not load',e);}
   if(i%12===0)await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  const draws=[];
  for(let meshIndex=0;meshIndex<doc.meshes.length;meshIndex++){
   const mesh=doc.meshes[meshIndex];
   for(const prim of mesh.primitives){
   if(prim.mode!==undefined&&prim.mode!==4)continue;
   // Spa's material treesline.001 is a kilometres-long transparent tree *wall*.
   // Its flat planes caused the huge see-through horizontal bands in the screenshot.
   // Keep trees1_2022 / trees2_2022, bushes, all terrain and buildings unchanged.
   const sourceMaterial=doc.materials[prim.material]||{};
   if(key==='spa' && /^treesline(?:\.|$)/i.test(sourceMaterial.name||''))continue;
   const a=prim.attributes,p=silverstoneAccessor(doc,bin,a.POSITION,false);
   const uv=a.TEXCOORD_0===undefined?null:silverstoneAccessor(doc,bin,a.TEXCOORD_0,false);
   const normal=a.NORMAL===undefined?null:silverstoneAccessor(doc,bin,a.NORMAL,false);
   const inds=prim.indices===undefined?null:silverstoneAccessor(doc,bin,prim.indices,true);
   if(key==='spa'&&[45,58,59,60,65,81].includes(prim.material))addVenueContact(key,'road',p.array,inds?.array,1,true);
   if(key==='singapore'&&[185,186].includes(prim.material))addVenueContact(key,'kerb',p.array,inds?.array,2.1,true);
   if(inds&&inds.componentType===5125&&!ext)throw new Error(key+' requires OES_element_index_uint');
   const mat=doc.materials[prim.material]||{},pbr=mat.pbrMetallicRoughness||{},ti=pbr.baseColorTexture;
   const texEntry=ti?doc.textures[ti.index]:null;
   // Singapore material 29 is the bridge deck, distinct from asphalt 182.
   const tarmac=key==='singapore'&&[29,182].includes(prim.material);
   const forceOpaque=(key==='singapore'&&[29,178,182,183,184,185,186].includes(prim.material))||(!mat.alphaMode||mat.alphaMode==='OPAQUE');
   draws.push({bounds:authoredBounds(doc.accessors[a.POSITION],key==='singapore'?2.1:1),pb:silverstoneBuffer(p.array,gl.ARRAY_BUFFER),nb:normal?silverstoneBuffer(normal.array,gl.ARRAY_BUFFER):null,ub:uv?silverstoneBuffer(uv.array,gl.ARRAY_BUFFER):null,ib:inds?silverstoneBuffer(inds.array,gl.ELEMENT_ARRAY_BUFFER):null,count:inds?inds.count:p.count,indexType:inds?(inds.componentType===5125?gl.UNSIGNED_INT:inds.componentType===5123?gl.UNSIGNED_SHORT:gl.UNSIGNED_BYTE):null,tex:texEntry?imageTex[texEntry.source]:white,useTex:!!texEntry,color:tarmac?[.55,.57,.60,1]:(pbr.baseColorFactor||[1,1,1,1]),material:prim.material,forceOpaque,cut:forceOpaque?0:(mat.alphaMode==='MASK'?(mat.alphaCutoff??.5):.001),blended:!forceOpaque&&mat.alphaMode==='BLEND',twoSided:!!mat.doubleSided});
   }
   // Let the browser update loading status and handle input between batches.
   if(meshIndex%4===0)await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  if(key==='spa'){await prepareSpaField();await preparePreciseSpaTerrain();}
  await prepareVenueWallCollision(key);
  importedTracks[key]={draws,transform:key==='spa'?IMP_SPA_MODEL:IMP_SG_MODEL};
  console.info(key,'original GLB loaded, primitives',draws.length,'grid count',key==='spa'?SPA_SEMANTIC_META.grid.length:SINGAPORE_SEMANTIC_META.grid.length);
  action.innerHTML='SELECT '+key.toUpperCase()+' PREVIEW <b>→</b>';
  card.disabled=false;return importedTracks[key];
 })().catch(err=>{console.error('Imported track load failed:',err);action.textContent='FAILED: '+err.message;throw err;}).finally(()=>{importedLoading[key]=null;});
 return importedLoading[key];
}

// Conservative WebGL clip-space frustum culling: batches outside the camera view
// skip their draw call and fragment work; no texture or triangle data is changed.
function visibleImportedBounds(vp,b){
 if(!b)return true;
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const a=axis, nx=vp[3]+sign*vp[a],ny=vp[7]+sign*vp[4+a],nz=vp[11]+sign*vp[8+a];
  const w=vp[15]+sign*vp[12+a];
  const norm=Math.hypot(nx,ny,nz);
  if(nx*b[0]+ny*b[1]+nz*b[2]+w < -b[3]*norm)return false;
 }
 return true;
}
function authoredBounds(acc,scale=1){
 if(!acc||!acc.min||!acc.max)return null;
 const a=acc.min,b=acc.max,cx=(a[0]+b[0])*.5*scale;
 const cy=-(a[2]+b[2])*.5*scale,cz=(a[1]+b[1])*.5*scale;
 const r=.5*Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])*scale+2;
 return [cx,cy,cz,r];
}

function renderImportedCircuit(key,vp){
 const asset=importedTracks[key];if(!asset)return;
 gl.useProgram(importedProg);gl.uniformMatrix4fv(impLoc.vp,false,vp);gl.uniformMatrix4fv(impLoc.obj,false,asset.transform);gl.uniform3fv(impLoc.sun,sunDirection);gl.uniform1i(impLoc.tex,0);gl.activeTexture(gl.TEXTURE0);
 const drawPart=d=>{
  if(d.twoSided)gl.disable(gl.CULL_FACE);else gl.disable(gl.CULL_FACE); // preserve authored winding under axis changes
  gl.uniform4fv(impLoc.color,d.color);gl.uniform1f(impLoc.cut,d.cut);gl.uniform1f(impLoc.opacity,1.);gl.uniform1f(impLoc.opaque,d.forceOpaque?1.:0.);
  gl.uniform1f(impLoc.has,d.useTex?1.:0.);gl.bindTexture(gl.TEXTURE_2D,d.tex);
  gl.bindBuffer(gl.ARRAY_BUFFER,d.pb);gl.enableVertexAttribArray(impLoc.p);gl.vertexAttribPointer(impLoc.p,3,gl.FLOAT,false,0,0);
  if(d.ub){gl.bindBuffer(gl.ARRAY_BUFFER,d.ub);gl.enableVertexAttribArray(impLoc.uv);gl.vertexAttribPointer(impLoc.uv,2,gl.FLOAT,false,0,0);}else{gl.disableVertexAttribArray(impLoc.uv);gl.vertexAttrib2f(impLoc.uv,0,0);}
  if(d.nb){gl.bindBuffer(gl.ARRAY_BUFFER,d.nb);gl.enableVertexAttribArray(impLoc.n);gl.vertexAttribPointer(impLoc.n,3,gl.FLOAT,false,0,0);}else{gl.disableVertexAttribArray(impLoc.n);gl.vertexAttrib3f(impLoc.n,0,0,1);}
  if(d.ib){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,d.ib);gl.drawElements(gl.TRIANGLES,d.count,d.indexType,0);}else gl.drawArrays(gl.TRIANGLES,0,d.count);
 };
 gl.disable(gl.BLEND);gl.depthMask(true);
 for(const d of asset.draws)if(!d.blended&&visibleImportedBounds(vp,d.bounds))drawPart(d);
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
 for(const d of asset.draws)if(d.blended&&visibleImportedBounds(vp,d.bounds))drawPart(d);
 gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.useProgram(prog);
}
function markedTrackGrid(track,index){
 const markers=track==='spa'?SPA_SEMANTIC_META.grid:SINGAPORE_SEMANTIC_META.grid;
 // The user-authored indices are labels, not array positions.
 return markers.find(m=>m.index===index)||markers[0];
}
function markedTrackPose(track,index){
 const marker=markedTrackGrid(track,index),p=marker.position;
 if(track==='spa')return {x:p[0],z:p[2],heading:SPA_SEMANTIC_META.heading+Math.PI}; // Spa: face 180 degrees opposite the original model-grid heading.
 const heading=SINGAPORE_SEMANTIC_META.heading-2*Math.PI/9; // Singapore: another 20 degrees counterclockwise from v2.16.5.
 const retreat=index===0?1.0:0; // Singapore: move driver 2m forward from v2.16.6; NPC grid remains authored.
 return {x:p[0]-Math.cos(heading)*retreat,z:p[2]-Math.sin(heading)*retreat,heading};
}
function semanticTrackHeight(x,z){return selectedTrack==='spa'?spaPreciseHeightAt(x,z):(selectedTrack==='singapore'?47.54:0);}

// Silverstone 2024: draw directly from the uploaded GLB, with its original indices,
// UVs, textures and materials. No mesh decimation or vertex-colour baking.
const silverstoneVs=`attribute vec3 aP;attribute vec2 aUV;attribute vec3 aN;
uniform mat4 uVP;uniform vec3 uSun;varying vec2 vUV;varying float vLit;
void main(){vec3 p=vec3(aP.x,-aP.z,aP.y);vec3 n=normalize(vec3(aN.x,-aN.z,aN.y));
 gl_Position=uVP*vec4(p,1.0);vUV=aUV;vLit=0.67+0.33*max(dot(n,normalize(uSun)),0.0);}`;
// Surface-specific correction for the authored Silverstone textures. Mesh geometry, UVs,
// texture bytes and building shading remain unchanged. Material classes are visual only.
const silverstoneFs=`precision mediump float;varying vec2 vUV;varying float vLit;
uniform sampler2D uTex;uniform vec4 uColor;uniform float uCutoff;uniform float uUseTex;uniform float uSurfaceClass;
void main(){vec4 c=uColor*(uUseTex>0.5?texture2D(uTex,vUV):vec4(1.0));
 if(c.a<uCutoff)discard;
 vec3 rgb=c.rgb*vLit;
 // Correct display tone for track asphalt and landscaped ground, not buildings/cars.
 if(uSurfaceClass>0.5&&uSurfaceClass<1.5)rgb=min(vec3(1.0),pow(max(rgb,vec3(0.0)),vec3(0.80))*1.08);
 else if(uSurfaceClass>1.5&&uSurfaceClass<2.5)rgb=min(vec3(1.0),pow(max(rgb,vec3(0.0)),vec3(0.88))*1.08);
 // Authored tyre-mark/grass overlays carry transparency although glTF marks them OPAQUE.
 // Asphalt colour is no longer destroyed by source PNG alpha; keep decals subtle.
 gl_FragColor=vec4(rgb,uSurfaceClass>2.5?c.a*0.30:1.0);}`;
const silverstoneProg=gl.createProgram();
gl.attachShader(silverstoneProg,shader(gl.VERTEX_SHADER,silverstoneVs));
gl.attachShader(silverstoneProg,shader(gl.FRAGMENT_SHADER,silverstoneFs));
gl.linkProgram(silverstoneProg);
if(!gl.getProgramParameter(silverstoneProg,gl.LINK_STATUS))throw new Error('Silverstone shader: '+gl.getProgramInfoLog(silverstoneProg));
const silverstoneLoc={p:gl.getAttribLocation(silverstoneProg,'aP'),uv:gl.getAttribLocation(silverstoneProg,'aUV'),n:gl.getAttribLocation(silverstoneProg,'aN'),vp:gl.getUniformLocation(silverstoneProg,'uVP'),sun:gl.getUniformLocation(silverstoneProg,'uSun'),tex:gl.getUniformLocation(silverstoneProg,'uTex'),color:gl.getUniformLocation(silverstoneProg,'uColor'),cutoff:gl.getUniformLocation(silverstoneProg,'uCutoff'),useTex:gl.getUniformLocation(silverstoneProg,'uUseTex'),surfaceClass:gl.getUniformLocation(silverstoneProg,'uSurfaceClass')};
let silverstoneOriginalDraws=[];
let silverstoneOriginalTextures=[];
function silverstoneAccessor(glb,bin,accessorId,asIndex){
 const a=glb.accessors[accessorId],bv=glb.bufferViews[a.bufferView];
 const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
 const bytes={5121:1,5123:2,5125:4,5126:4}[a.componentType];
 if(!components||!bytes)throw new Error('Unsupported GLB accessor');
 // Important: view begins at the bufferView, NOT at accessor.byteOffset.
 // Spa packs many attributes into shared bufferViews; shifting the DataView itself
 // and then asking for the whole view length causes a RangeError near the GLB end.
 const stride=bv.byteStride||bytes*components;
 const length=a.count*components;let out;
 const dv=new DataView(bin,bv.byteOffset||0,bv.byteLength);
 if(asIndex){out=a.componentType===5125?new Uint32Array(length):(a.componentType===5123?new Uint16Array(length):new Uint8Array(length));}
 else out=new Float32Array(length);
 for(let i=0;i<a.count;i++)for(let k=0;k<components;k++){
  const o=(a.byteOffset||0)+i*stride+k*bytes;
  const v=a.componentType===5126?dv.getFloat32(o,true):a.componentType===5125?dv.getUint32(o,true):a.componentType===5123?dv.getUint16(o,true):dv.getUint8(o);
  out[i*components+k]=v;
 }
 return {array:out,count:a.count,componentType:a.componentType};
}
function silverstoneBuffer(arr,target){const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,arr,gl.STATIC_DRAW);return b;}
async function loadSilverstoneTrack(){
 try{
  // Decode after the rest of the game UI is usable; the original GLB is intentionally large.
  const encoded=SILVERSTONE_SOURCE_GLB_B64;const raw=atob(encoded);
  const packed=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)packed[i]=raw.charCodeAt(i);
  const stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate'));
  const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  const dv=new DataView(bytes.buffer);if(dv.getUint32(0,true)!==0x46546c67)throw new Error('Invalid Silverstone GLB');
  const jsonLength=dv.getUint32(12,true),jsonText=new TextDecoder().decode(bytes.subarray(20,20+jsonLength));
  const doc=JSON.parse(jsonText);const binStart=20+jsonLength+8;
  const buffers=bytes.buffer.slice(binStart,binStart+dv.getUint32(20+jsonLength,true));
  const ext=gl.getExtension('OES_element_index_uint');
  const opaqueWhite=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,opaqueWhite);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  silverstoneOriginalTextures=doc.images.map(()=>opaqueWhite);
  const texturePromises=doc.images.map(async(img,i)=>{
   try{const bv=doc.bufferViews[img.bufferView],slice=buffers.slice(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
    const blob=new Blob([slice],{type:img.mimeType||'image/png'});// glTF alphaMode OPAQUE means sampled RGB must survive even when the source PNG
    // has low alpha (Silverstone asphalt atlas has alpha=30/255). The default
    // createImageBitmap premultiplication can turn healthy grey pixels near black.
    const bitmap=await createImageBitmap(blob,{premultiplyAlpha:'none'});
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);bitmap.close();
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    silverstoneOriginalTextures[i]=tex;
   }catch(e){console.warn('Silverstone texture skipped',i,e);}
  });
  const result=[];
  for(const mesh of doc.meshes)for(const prim of mesh.primitives){
   if(prim.mode!==undefined&&prim.mode!==4)continue;
   const attrs=prim.attributes,p=silverstoneAccessor(doc,buffers,attrs.POSITION,false),uv=attrs.TEXCOORD_0!==undefined?silverstoneAccessor(doc,buffers,attrs.TEXCOORD_0,false):null;
   const normal=attrs.NORMAL!==undefined?silverstoneAccessor(doc,buffers,attrs.NORMAL,false):null;
   const indices=silverstoneAccessor(doc,buffers,prim.indices,true);
   if([44,56].includes(prim.material))addVenueContact('silverstone','kerb',p.array,indices.array,1,true);
   if(indices.componentType===5125&&!ext)throw new Error('Browser requires OES_element_index_uint to draw original Silverstone geometry');
   const material=doc.materials[prim.material]||{},pbr=material.pbrMetallicRoughness||{},texInfo=pbr.baseColorTexture;
   const texEntry=texInfo?doc.textures[texInfo.index]:null;
   result.push({bounds:authoredBounds(doc.accessors[attrs.POSITION]),p:silverstoneBuffer(p.array,gl.ARRAY_BUFFER),uv:uv?silverstoneBuffer(uv.array,gl.ARRAY_BUFFER):null,n:normal?silverstoneBuffer(normal.array,gl.ARRAY_BUFFER):null,
    index:silverstoneBuffer(indices.array,gl.ELEMENT_ARRAY_BUFFER),indexType:indices.componentType,count:indices.count,material,
    color:pbr.baseColorFactor||[1,1,1,1],image:texEntry?texEntry.source:-1,doubleSided:!!material.doubleSided,
    // GLB material IDs: 4-6 are translucent tyre-mark decals, 53 transparent grass overlay;
    // 52/55 are tarmac and 54/57/58 are topographic/vegetation ground surfaces.
    surfaceClass:[4,5,6,53].includes(prim.material)?3:([52,55].includes(prim.material)?1:([54,57,58].includes(prim.material)?2:0))});
  }
  silverstoneOriginalDraws=result;
  // Keep existing terrain sampling and free-drive setup; visible track is now the intact original GLB.
  await loadSilverstoneTerrain();
  await prepareVenueWallCollision('silverstone');
  silverstoneTrackBuffers=makeMeshBuffers(new Float32Array(0),new Float32Array(0));
  if(selectedTrack==='silverstone')trackBuffers=silverstoneTrackBuffers;
  const button=document.getElementById('selectSilverstoneTrack');if(button){button.disabled=false;const action=button.querySelector('.mode-action');if(action)action.innerHTML='SELECT SILVERSTONE 2024 <b>→</b>';}
  const footer=document.querySelector('.mode-footer');if(footer)footer.textContent='ORIGINAL SILVERSTONE 2024 GLB · ORIGINAL TEXTURES · FREE-DRIVE PREVIEW';
  await Promise.allSettled(texturePromises);
 }catch(err){console.error('Could not load original Silverstone GLB:',err);const footer=document.querySelector('.mode-footer');if(footer)footer.textContent='SILVERSTONE LOAD FAILED · '+err.message;}
}
function renderOriginalSilverstone(vp){
 if(!silverstoneOriginalDraws.length)return;
 gl.useProgram(silverstoneProg);gl.uniformMatrix4fv(silverstoneLoc.vp,false,vp);
 gl.uniform3fv(silverstoneLoc.sun,sunDirection);gl.uniform1i(silverstoneLoc.tex,0);gl.activeTexture(gl.TEXTURE0);
 // Two passes are essential: draw base surfaces first, then subtle tyre decals.
 // Importantly, source textures are decoded WITHOUT alpha premultiplication;
 // asphalt RGB must remain intact even if its PNG happens to have alpha 30/255.
 function drawTrackPart(d){
  if(d.doubleSided)gl.disable(gl.CULL_FACE);else gl.enable(gl.CULL_FACE);
  gl.uniform4fv(silverstoneLoc.color,d.color);
  gl.uniform1f(silverstoneLoc.cutoff,(d.material.alphaMode==='MASK')?(d.material.alphaCutoff||.5):0.002);
  gl.uniform1f(silverstoneLoc.useTex,d.image>=0?1:0);
  gl.uniform1f(silverstoneLoc.surfaceClass,d.surfaceClass);
  gl.bindTexture(gl.TEXTURE_2D,d.image>=0?silverstoneOriginalTextures[d.image]:null);
  gl.bindBuffer(gl.ARRAY_BUFFER,d.p);gl.enableVertexAttribArray(silverstoneLoc.p);gl.vertexAttribPointer(silverstoneLoc.p,3,gl.FLOAT,false,0,0);
  if(d.uv){gl.bindBuffer(gl.ARRAY_BUFFER,d.uv);gl.enableVertexAttribArray(silverstoneLoc.uv);gl.vertexAttribPointer(silverstoneLoc.uv,2,gl.FLOAT,false,0,0);}else{gl.disableVertexAttribArray(silverstoneLoc.uv);gl.vertexAttrib2f(silverstoneLoc.uv,0,0);}
  if(d.n){gl.bindBuffer(gl.ARRAY_BUFFER,d.n);gl.enableVertexAttribArray(silverstoneLoc.n);gl.vertexAttribPointer(silverstoneLoc.n,3,gl.FLOAT,false,0,0);}else{gl.disableVertexAttribArray(silverstoneLoc.n);gl.vertexAttrib3f(silverstoneLoc.n,0,1,0);}
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,d.index);gl.drawElements(gl.TRIANGLES,d.count,d.indexType,0);
 }
 // Opaque first for correct depth occlusion. Buildings keep exactly their
 // original materials, UVs and lighting; only terrain gets selective correction.
 gl.disable(gl.BLEND);gl.depthMask(true);
 for(const d of silverstoneOriginalDraws){if(d.surfaceClass!==3&&visibleImportedBounds(vp,d.bounds))drawTrackPart(d);}
 // Draw restrained transparent tyre marks over the restored asphalt RGB.
 // Depth offset suppresses decal/tarmac z-fighting and the accompanying flicker.
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.depthMask(false);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1.5,-1.5);
 for(const d of silverstoneOriginalDraws){if(d.surfaceClass===3&&visibleImportedBounds(vp,d.bounds))drawTrackPart(d);}
 gl.disable(gl.POLYGON_OFFSET_FILL);gl.depthMask(true);gl.disable(gl.BLEND);
 gl.disable(gl.CULL_FACE);gl.useProgram(prog);
}
// Build a sparse collider grid from the actual visible Shanghai barrier/wall mesh.
// It intentionally ignores road shoulders: no invisible constant-distance wall.
function buildShanghaiWallColliders(pos){
 const cell=SHANGHAI_COLLIDER_CELL,grid=new Map(),dedup=new Set();let count=0;
 const key=(ix,iz)=>ix+','+iz;
 function register(ax,az,bx,bz,low,high){
  let x0=ax,z0=az,x1=bx,z1=bz;
  if(x1<x0||(x1===x0&&z1<z0)){[x0,x1]=[x1,x0];[z0,z1]=[z1,z0];}
  const signature=[x0,z0,x1,z1].map(v=>Math.round(v*2)).join(',');
  if(dedup.has(signature))return;dedup.add(signature);
  const seg=[ax,az,bx,bz,low,high];
  for(let ix=Math.floor((Math.min(ax,bx)-1.3)/cell);ix<=Math.floor((Math.max(ax,bx)+1.3)/cell);ix++)
   for(let iz=Math.floor((Math.min(az,bz)-1.3)/cell);iz<=Math.floor((Math.max(az,bz)+1.3)/cell);iz++){
    const k=key(ix,iz);let bucket=grid.get(k);if(!bucket){bucket=[];grid.set(k,bucket);}bucket.push(seg);
   }
  count++;
 }
 for(let i=0;i+8<pos.length;i+=9){
  const ax=pos[i],ay=pos[i+1],az=pos[i+2],bx=pos[i+3],by=pos[i+4],bz=pos[i+5],cx=pos[i+6],cy=pos[i+7],cz=pos[i+8];
  const height=Math.max(ay,by,cy)-Math.min(ay,by,cy);
  if(height<.64||height>4.8)continue;
  const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,mag=Math.hypot(nx,ny,nz);
  if(mag<.02||Math.abs(ny)/mag>.28)continue; // vertical surfaces only
  const vertices=[[ax,ay,az],[bx,by,bz],[cx,cy,cz]];
  // A barrier triangle has one long, near-horizontal top or bottom edge.
  let best=null,bestLen=0;
  for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){
   const A=vertices[a],B=vertices[b],h=Math.hypot(B[0]-A[0],B[2]-A[2]);
   if(Math.abs(A[1]-B[1])<.22&&h>.55&&h<14&&h>bestLen){best=[A,B];bestLen=h;}
  }
  if(!best)continue;
  const lo=Math.min(ay,by,cy),hi=Math.max(ay,by,cy);
  // Avoid roofs and high floating decor; roadside structures originate near terrain.
  if(lo>7.5||hi<-.8)continue;
  register(best[0][0],best[0][2],best[1][0],best[1][2],lo,hi);
 }
 shanghaiWallGrid=grid;shanghaiColliderCount=count;
 console.info('Shanghai visible mesh barrier colliders:',count,'spatial cells:',grid.size);
}
function shanghaiWallHit(x0,z0,x1,z1){
 if(!shanghaiWallGrid)return false;
 const cell=SHANGHAI_COLLIDER_CELL,limit=1.0,checked=new Set();
 const midX=(x0+x1)*.5,midZ=(z0+z1)*.5;
 const lowX=Math.min(x0,x1,midX)-limit,highX=Math.max(x0,x1,midX)+limit;
 const lowZ=Math.min(z0,z1,midZ)-limit,highZ=Math.max(z0,z1,midZ)+limit;
 // Sloped track ground serves as the car's vertical position; do not collide with overhead geometry.
 const groundY=shanghaiHeightAt(x1,z1);
 for(let ix=Math.floor(lowX/cell);ix<=Math.floor(highX/cell);ix++)for(let iz=Math.floor(lowZ/cell);iz<=Math.floor(highZ/cell);iz++){
  const bucket=shanghaiWallGrid.get(ix+','+iz);if(!bucket)continue;
  for(const wall of bucket){if(checked.has(wall))continue;checked.add(wall);
   if(groundY+1.0<wall[4]||groundY>wall[5]+.45)continue;
   const [ax,az,bx,bz]=wall;
   // Closest approach of car swept segment to wall segment; prevents tunneling at speed.
   const ux=x1-x0,uz=z1-z0,vx=bx-ax,vz=bz-az,wx=x0-ax,wz=z0-az;
   const A=ux*ux+uz*uz,B=ux*vx+uz*vz,C=vx*vx+vz*vz,D=ux*wx+uz*wz,E=vx*wx+vz*wz;
   let sn=0,tn=0,den=A*C-B*B;
   if(den>1e-8){sn=Math.max(0,Math.min(1,(B*E-C*D)/den));}
   tn=C>1e-8?Math.max(0,Math.min(1,(B*sn+E)/C)):0;
   sn=A>1e-8?Math.max(0,Math.min(1,(B*tn-D)/A)):0;
   const dx=wx+sn*ux-tn*vx,dz=wz+sn*uz-tn*vz;
   if(dx*dx+dz*dz<limit*limit)return true;
  }
 }
 return false;
}
async function loadShanghaiTrack(){
 try{
  if(typeof DecompressionStream==='undefined')throw new Error('This browser lacks DEFLATE support.');
  const raw=atob(SHANGHAI_TRACK_DEFLATE_B64),zip=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)zip[i]=raw.charCodeAt(i);
  const stream=new Blob([zip]).stream().pipeThrough(new DecompressionStream('deflate'));
  const full=await new Response(stream).arrayBuffer(),dv=new DataView(full),n=dv.getUint32(0,true);
  if(!n||n%3!==0||full.byteLength!==4+n*8)throw new Error('Shanghai track mesh payload is invalid.');
  const positions=new Float32Array(full,4,n),colors=new Float32Array(full,4+n*4,n);
  // The authored model uses vivid-blue placeholder cubes on grid slots. Keep their positions as spawn references,
  // but omit their faces from rendering so the actual cars can occupy those grid slots.
  const markerBlue=[0.14117648,0.33333334,0.5921569];
  const cleanPositions=new Float32Array(n),cleanColors=new Float32Array(n);let write=0,hiddenGridMarkerTriangles=0;
  for(let k=0;k+8<n;k+=9){
   let isMarker=true;
   for(let v=0;v<3&&isMarker;v++)for(let c=0;c<3;c++)if(Math.abs(colors[k+v*3+c]-markerBlue[c])>0.008){isMarker=false;break;}
   if(isMarker){hiddenGridMarkerTriangles++;continue;}
   cleanPositions.set(positions.subarray(k,k+9),write);cleanColors.set(colors.subarray(k,k+9),write);write+=9;
  }
  buildShanghaiWallColliders(cleanPositions.subarray(0,write));
  buildShanghaiGroundShadowReceiver(cleanPositions.subarray(0,write));
  buildShanghaiBuildingShadowCaster(cleanPositions.subarray(0,write));
  shanghaiTrackBuffers=makeMeshBuffers(cleanPositions.subarray(0,write),cleanColors.subarray(0,write));
  if(selectedTrack==='shanghai')trackBuffers=shanghaiTrackBuffers;
  const button=document.getElementById('selectShanghaiTrack');
  if(button){button.disabled=false;const action=button.querySelector('.mode-action');if(action)action.innerHTML='SELECT SHANGHAI <b>→</b>';}
  const footer=document.querySelector('#trackScreen .mode-footer');
  if(footer)footer.textContent='SHANGHAI READY · MESH COLLISION BARRIERS · BLUE GRID MARKERS HIDDEN · DAYLIGHT';
 }catch(err){
  console.error('Could not load Shanghai circuit:',err);
  const button=document.getElementById('selectShanghaiTrack');if(button){button.disabled=true;const action=button.querySelector('.mode-action');if(action)action.textContent='SHANGHAI FAILED TO LOAD';}
  const footer=document.querySelector('#trackScreen .mode-footer');if(footer)footer.textContent='SHANGHAI MODEL FAILED TO LOAD · '+err.message;
 }
}

let selectedTrack='oval';
let shanghaiTrackBuffers=null;
let trackBuffers=ovalTrackBuffers;
const carBuffers=makeMeshBuffers(carPositions,carColors);
// Procedural four-wheel mesh: a rounded, slightly wide tyre, tread grooves, metallic rim,
// radial spokes and a cyan hub. The wheels are separate meshes so steering/spin can animate.
function makeWheelMesh(){
 const p=[],c=[];
 const tire=[.028,.033,.039], tread=[.075,.083,.09], rim=[.51,.59,.63],rimLight=[.72,.78,.80],hub=[.06,.76,.83],hubDark=[.06,.22,.25];
 function t(a,b,d,col){for(const v of [a,b,d]){p.push(v[0],v[1],v[2]);c.push(col[0],col[1],col[2]);}}
 function q(a,b,d,e,col){t(a,b,d,col);t(a,d,e,col);}
 function point(r,a,z){return [r*Math.cos(a),r*Math.sin(a),z];}
 // Cross-section profile of a tyre revolving around the local Z axle.
 const prof=[[.17,.154],[.225,.154],[.278,.138],[.316,.116],[.337,.078],[.337,-.078],[.316,-.116],[.278,-.138],[.225,-.154],[.17,-.154]];
 const seg=40;
 for(let k=0;k<prof.length;k++){
   const n=(k+1)%prof.length, [r0,z0]=prof[k], [r1,z1]=prof[n];
   const col=(k>=3&&k<=5)?tire:(k===1||k===7?tread:tire);
   for(let i=0;i<seg;i++){
     const a=2*Math.PI*i/seg,b=2*Math.PI*(i+1)/seg;
     q(point(r0,a,z0),point(r0,b,z0),point(r1,b,z1),point(r1,a,z1),col);
   }
 }
 // Small transverse grooves across the visible tread; they rotate with the tyre.
 for(let i=0;i<32;i++){
   const a=2*Math.PI*i/32, b=a+.018;
   q(point(.338,a,-.064),point(.338,b,-.064),point(.338,b,.064),point(.338,a,.064),tread);
 }
 // Metallic annulus and central hub on both wheel faces.
 for(const side of [-1,1]){
   const z=side*.157, inner=.066, outer=.188;
   for(let i=0;i<seg;i++){
     const a=2*Math.PI*i/seg,b=2*Math.PI*(i+1)/seg;
     q(point(inner,a,z),point(outer,a,z),point(outer,b,z),point(inner,b,z),i%4===0?rimLight:rim);
   }
   // Eight separate radial spokes make wheel spin visually obvious.
   for(let i=0;i<8;i++){
     const a=2*Math.PI*i/8+.05, r0=.055,r1=.169, half=.012,zs=side*.160;
     const ux=Math.cos(a),uy=Math.sin(a),px=-uy*half,py=ux*half;
     const v0=[r0*ux+px,r0*uy+py,zs],v1=[r1*ux+px,r1*uy+py,zs];
     const v2=[r1*ux-px,r1*uy-py,zs],v3=[r0*ux-px,r0*uy-py,zs];
     q(v0,v1,v2,v3,i%2===0?rimLight:rim);
   }
   // Hub disc + coloured centre cap.
   for(let i=0;i<seg;i++){
     const a=2*Math.PI*i/seg,b=2*Math.PI*(i+1)/seg;
     t([0,0,z+side*.0005],point(.055,a,z+side*.0005),point(.055,b,z+side*.0005),hubDark);
     t([0,0,z+side*.001],point(.027,a,z+side*.001),point(.027,b,z+side*.001),hub);
   }
 }
 return makeMeshBuffers(new Float32Array(p),new Float32Array(c));
}
const wheelBuffers=makeWheelMesh();
function bindMesh(m){gl.bindBuffer(gl.ARRAY_BUFFER,m.pb);gl.enableVertexAttribArray(locPos);gl.vertexAttribPointer(locPos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.cb);gl.enableVertexAttribArray(locCol);gl.vertexAttribPointer(locCol,3,gl.FLOAT,false,0,0)}

async function loadCustomCar(){
 const status=document.getElementById('modelStatus');
 try{
   if(!uintIndicesExt)throw new Error('This browser lacks 32-bit WebGL index support. Please use a current Chrome or Edge.');
   if(typeof DecompressionStream==='undefined')throw new Error('This browser lacks built-in DEFLATE support. Please use a current Chrome or Edge.');
   const b64=USER_CAR_GLB_DEFLATE_B64, raw=atob(b64), zipped=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)zipped[i]=raw.charCodeAt(i);
   const stream=new Blob([zipped]).stream().pipeThrough(new DecompressionStream('deflate'));
   const full=await new Response(stream).arrayBuffer(); const dv=new DataView(full);
   if(dv.getUint32(0,true)!==0x46546c67)throw new Error('Embedded car model header is invalid.');
   const jsonLength=dv.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(full,20,jsonLength)));
   const binHead=20+jsonLength,binLength=dv.getUint32(binHead,true),binType=dv.getUint32(binHead+4,true);
   if(binType!==0x004e4942)throw new Error('Embedded car model binary chunk is missing.');
   const binStart=binHead+8;
   function accessorView(i,kind){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],offset=binStart+(v.byteOffset||0)+(a.byteOffset||0);if(kind==='f32')return new Float32Array(full,offset,a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]));if(kind==='u32')return new Uint32Array(full,offset,a.count);throw new Error('Unsupported model accessor');}
   function buffer(target,data){const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;}
   const groups={body:0,frontLeft:1,frontRight:2,rearLeft:3,rearRight:4};
   const batches=doc.meshes[0].primitives.map(pr=>{const ids=accessorView(pr.indices,'u32');return {name:pr.extras.animationGroup,group:groups[pr.extras.animationGroup]??0,count:ids.length,ib:buffer(gl.ELEMENT_ARRAY_BUFFER,ids),pb:buffer(gl.ARRAY_BUFFER,accessorView(pr.attributes.POSITION,'f32')),nb:buffer(gl.ARRAY_BUFFER,accessorView(pr.attributes.NORMAL,'f32')),uvb:buffer(gl.ARRAY_BUFFER,accessorView(pr.attributes.TEXCOORD_0,'f32'))}});
   const img=doc.images[0],iv=doc.bufferViews[img.bufferView],imgOffset=binStart+(iv.byteOffset||0),imgBytes=new Uint8Array(full,imgOffset,iv.byteLength);
   const bitmap=await createImageBitmap(new Blob([imgBytes],{type:img.mimeType||'image/jpeg'}));
   const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,bitmap);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
   userCarAsset={batches,tex};status.textContent='CUSTOM MODEL READY';status.style.color='#8be2a1';
 }catch(e){status.textContent='MODEL LOAD FAILED · DEFAULT CAR';status.style.color='#ffb2a4';console.error('Could not load embedded custom car model:',e);}
}
// Updated by drawCustomCar / drawNpcCar just before each car is rendered.
let activeCarSuspension=null;
let ferrariUvMode=1;
const ferrariUvModeNames=['NORMAL','FLIP V','FLIP U','FLIP U+V'];
function drawGroupedCarAt(viewProj,asset,x,y,z,heading,spin,steer){
 if(!asset||!asset.batches)return false;
 gl.useProgram(carProg);gl.uniform3fv(carLoc.sun,sunDirection);gl.uniformMatrix4fv(carLoc.vp,false,viewProj);gl.uniform3f(carLoc.position,x,y,z);gl.uniform1f(carLoc.heading,heading);gl.uniform3f(carLoc.camera,activeCarCameraPosition[0],activeCarCameraPosition[1],activeCarCameraPosition[2]);gl.uniform1f(carLoc.gloss,(asset.team==='redbull'||asset.modelName==='RB22')?0.28:(asset.team==='ferrari'||asset.modelName==='SF26')?0.18:0.0);gl.uniform1f(carLoc.alphaMode,0);gl.uniform1f(carLoc.alphaCutoff,0.5);gl.uniform4f(carLoc.baseColor,1,1,1,1);gl.disable(gl.BLEND);gl.depthMask(true);gl.uniform1f(carLoc.spin,spin);gl.uniform1f(carLoc.steer,steer);
 gl.uniform1f(carLoc.bodyRoll,activeCarSuspension?activeCarSuspension.roll:0);
 gl.uniform1f(carLoc.bodyPitch,activeCarSuspension?activeCarSuspension.pitch:0);
 gl.uniform1f(carLoc.wheelLift,0);
 gl.uniform1i(carLoc.texture,0);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,asset.tex);
 const centers=[[0,0,0],[1.277133,-0.184574,-0.637920],[1.277133,-0.184345,0.640129],[-1.728492,-0.198543,-0.653947],[-1.729950,-0.198543,0.654607]];
 for(const batch of asset.batches){const i=batch.group,c=centers[i]||centers[0];gl.uniform1f(carLoc.group,i);gl.uniform3f(carLoc.center,c[0],c[1],c[2]);gl.uniform1f(carLoc.front,i===1||i===2?1:0);gl.uniform1f(carLoc.uvFlipMode,0);
   gl.uniform1f(carLoc.wheelLift,activeCarSuspension&&i>=1&&i<=4?activeCarSuspension.wheels[i-1]*0.45:0);
   gl.bindBuffer(gl.ARRAY_BUFFER,batch.pb);gl.enableVertexAttribArray(carLoc.pos);gl.vertexAttribPointer(carLoc.pos,3,gl.FLOAT,false,0,0);
   gl.bindBuffer(gl.ARRAY_BUFFER,batch.nb);gl.enableVertexAttribArray(carLoc.normal);gl.vertexAttribPointer(carLoc.normal,3,gl.FLOAT,false,0,0);
   gl.bindBuffer(gl.ARRAY_BUFFER,batch.uvb);gl.enableVertexAttribArray(carLoc.uv);gl.vertexAttribPointer(carLoc.uv,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,batch.ib);gl.drawElements(gl.TRIANGLES,batch.count,gl.UNSIGNED_INT,0);
 }
 gl.useProgram(prog);return true;
}
function drawSingleCarAt(viewProj,asset,x,y,z,heading){
 if(!asset||(!asset.batch&&!asset.batches))return false;
 gl.useProgram(carProg);gl.uniform3fv(carLoc.sun,sunDirection);gl.uniformMatrix4fv(carLoc.vp,false,viewProj);gl.uniform3f(carLoc.position,x,y,z);gl.uniform1f(carLoc.heading,heading);gl.uniform3f(carLoc.camera,activeCarCameraPosition[0],activeCarCameraPosition[1],activeCarCameraPosition[2]);gl.uniform1f(carLoc.gloss,(asset.team==='redbull'||asset.modelName==='RB22')?0.28:0.0);gl.uniform1f(carLoc.spin,0);gl.uniform1f(carLoc.steer,0);gl.uniform1f(carLoc.group,0);gl.uniform3f(carLoc.center,0,0,0);gl.uniform1f(carLoc.front,0);
 const suspensionSign=asset===npcCarAsset?1:-1; // Ferrari/Mercedes/etc are modelled facing -X.
 gl.uniform1f(carLoc.bodyRoll,activeCarSuspension?activeCarSuspension.roll*suspensionSign:0);
 gl.uniform1f(carLoc.bodyPitch,activeCarSuspension?activeCarSuspension.pitch*suspensionSign:0);
 gl.uniform1f(carLoc.wheelLift,0);
 gl.uniform1f(carLoc.uvFlipMode,asset.team==='ferrari'?ferrariUvMode:0);gl.uniform1i(carLoc.texture,0);gl.activeTexture(gl.TEXTURE0);
  const drawBatch=(batch,tex)=>{
    const alphaMode=batch.alphaMode==='BLEND'?2:(batch.alphaMode==='MASK'?1:0);gl.uniform1f(carLoc.alphaMode,alphaMode);gl.uniform1f(carLoc.alphaCutoff,batch.alphaCutoff==null?0.5:batch.alphaCutoff);const factor=batch.baseColorFactor||[1,1,1,1];gl.uniform4f(carLoc.baseColor,factor[0],factor[1],factor[2],factor[3]);if(alphaMode===2){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}else{gl.disable(gl.BLEND);gl.depthMask(true);}
    gl.bindTexture(gl.TEXTURE_2D,tex||asset.tex);
   gl.bindBuffer(gl.ARRAY_BUFFER,batch.pb);gl.enableVertexAttribArray(carLoc.pos);gl.vertexAttribPointer(carLoc.pos,3,gl.FLOAT,false,0,0);
   gl.bindBuffer(gl.ARRAY_BUFFER,batch.nb);gl.enableVertexAttribArray(carLoc.normal);gl.vertexAttribPointer(carLoc.normal,3,gl.FLOAT,false,0,0);
   gl.bindBuffer(gl.ARRAY_BUFFER,batch.uvb);gl.enableVertexAttribArray(carLoc.uv);gl.vertexAttribPointer(carLoc.uv,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,batch.ib);gl.drawElements(gl.TRIANGLES,batch.count,gl.UNSIGNED_INT,0);if(alphaMode===2){gl.depthMask(true);gl.disable(gl.BLEND);}
 };
  if(asset.batches){const ordered=asset.batches.slice().sort((a,b)=>{const rank=x=>x.alphaMode==='BLEND'?2:(x.alphaMode==='MASK'?1:0);return rank(a)-rank(b);});for(const batch of ordered)drawBatch(batch,batch.tex);}
 else drawBatch(asset.batch,asset.tex);
    gl.depthMask(true);gl.disable(gl.BLEND);
 gl.useProgram(prog);return true;
}
// Original curb paint is non-flat visually but represented by flat geometry in the imported map.
// This hidden contact field (not a visible red/white mesh) adds tyre loads at the original curb locations.
function originalKerbWheelSample(wx,wz,chassisIndex,worldSpeed){
 if(selectedTrack!=='shanghai')return 0;
 let best=1e20,segment=-1,tAlong=0,side=0,dist=0;
 for(let k=-9;k<=9;k++){
   const i=(chassisIndex+k+SHANGHAI_SAMPLE_COUNT)%SHANGHAI_SAMPLE_COUNT;
   const j=(i+1)%SHANGHAI_SAMPLE_COUNT,o=i*SHANGHAI_ROUTE_STRIDE,q=j*SHANGHAI_ROUTE_STRIDE;
   const ax=SHANGHAI_ROUTE[o],az=SHANGHAI_ROUTE[o+1],dx=SHANGHAI_ROUTE[q]-ax,dz=SHANGHAI_ROUTE[q+1]-az;
   const den=Math.max(1e-5,dx*dx+dz*dz),t=Math.max(0,Math.min(1,((wx-ax)*dx+(wz-az)*dz)/den));
   const xx=ax+dx*t,zz=az+dz*t,ex=wx-xx,ez=wz-zz,d2=ex*ex+ez*ez;
   if(d2<best){
     best=d2;segment=i;tAlong=t;
     const heading=SHANGHAI_ROUTE[o+3]+Math.PI;
     side=(ex*(-Math.sin(heading))+ez*Math.cos(heading))>=0?1:0;
     dist=Math.sqrt(d2);
   }
 }
 if(segment<0||dist<3.7||dist>9.5)return 0;
 const i1=(segment+1)%SHANGHAI_SAMPLE_COUNT;
 const a=SHANGHAI_KERB_BYTES[segment*2+side],b=SHANGHAI_KERB_BYTES[i1*2+side];
 if(!a&&!b)return 0;
 const presence=(a?1:0)*(1-tAlong)+(b?1:0)*tAlong;
 const kerbOffset=((a||b)-1)/50+4.0;
 const across=Math.abs(dist-kerbOffset);
 // Broad tyre contact under the tyre patch; smoothly fade at its sloping edges.
 const profile=Math.exp(-Math.pow(across/.70,4));
 if(profile<0.005)return 0;
 const pace=Math.min(1,Math.abs(worldSpeed)/25);
 const stripes=0.006*Math.sin(2*Math.PI*(segment+tAlong)/2.2);
 return Math.max(0,(0.046+stripes*pace)*profile*presence);
}
function makeKerbSuspension(){return {heave:0,heaveV:0,roll:0,rollV:0,pitch:0,pitchV:0,wheels:[0,0,0,0],active:false};}
const playerKerbSusp=makeKerbSuspension(),npcKerbSusp=makeKerbSuspension();
function clearKerbSuspension(st){st.heave=st.heaveV=st.roll=st.rollV=st.pitch=st.pitchV=0;st.active=false;st.wheels.fill(0);}
function updateKerbSuspension(st,x,z,heading,motionKmh,dt){
 if(!['shanghai','silverstone','singapore'].includes(selectedTrack)){clearKerbSuspension(st);return;}
 const chassisIndex=selectedTrack==='shanghai'?shanghaiNearest(x,z).index:0;
 const cosine=Math.cos(heading),sine=Math.sin(heading);
 const offsets=[[1.30,-.67],[1.30,.67],[-1.70,-.67],[-1.70,.67]];
 let total=0;
 for(let k=0;k<4;k++){
   const ox=offsets[k][0],oz=offsets[k][1],wx=x+cosine*ox-sine*oz,wz=z+sine*ox+cosine*oz;
   let target;
   if(selectedTrack==='shanghai')target=originalKerbWheelSample(wx,wz,chassisIndex,motionKmh/3.6);
   else{
    // Real kerb footprint, sampled per tyre. Road and nearby walls produce no input.
    const contact=venueContactAt(selectedTrack,'kerb',wx,wz,rideTargetY(wx,wz));
    const pace=Math.min(1,Math.abs(motionKmh)/90);
    target=contact===null?0:.046+.009*pace*Math.sin((wx+wz)*2*Math.PI/.65);
   }
   // Tyre rubber + suspension soften the contact without suddenly snapping up/down.
   const travelAlpha=1-Math.exp(-Math.min(dt,.05)*29);
   st.wheels[k]+=(target-st.wheels[k])*travelAlpha;
   total+=st.wheels[k];
 }
 const front=(st.wheels[0]+st.wheels[1])*.5,rear=(st.wheels[2]+st.wheels[3])*.5;
 const left=(st.wheels[0]+st.wheels[2])*.5,right=(st.wheels[1]+st.wheels[3])*.5;
 const heaveTarget=total*.25*.66;
 const rollTarget=Math.max(-.07,Math.min(.07,1.6*(left-right)/1.34));
 const pitchTarget=Math.max(-.045,Math.min(.045,1.45*(front-rear)/3.0));
 const dtSafe=Math.min(dt,.04),w=19,damping=1.0;
 function damp(value,velocity,target){velocity+=(w*w*(target-value)-2*damping*w*velocity)*dtSafe;value+=velocity*dtSafe;return [value,velocity];}
 [st.heave,st.heaveV]=damp(st.heave,st.heaveV,heaveTarget);
 [st.roll,st.rollV]=damp(st.roll,st.rollV,rollTarget);
 [st.pitch,st.pitchV]=damp(st.pitch,st.pitchV,pitchTarget);
 st.active=total>.010;
}
function trackGroundY(x,z){return selectedTrack==='shanghai'?shanghaiHeightAt(x,z):(selectedTrack==='silverstone'?silverstoneField(x,z,false):((selectedTrack==='spa'||selectedTrack==='singapore')?semanticTrackHeight(x,z):0));}
let playerRideY=0,npcRideY=0,previousRidePX=0,previousRidePZ=0,previousRideNX=0,previousRideNZ=0;
function rideTargetY(x,z){
 if(selectedTrack==='silverstone')return silverstoneField(x,z,false);
  if(selectedTrack==='spa'||selectedTrack==='singapore')return semanticTrackHeight(x,z);
 if(selectedTrack!=='shanghai')return 0;
  return shanghaiHeightAt(x,z);
}
// Road texture is a tiny, world-fixed suspension input, not an alteration of terrain contact.
// The existing Shanghai original-kerb physics remains independent and untouched.
const playerSpaRideFilter=makeSpaRideFilter(),npcSpaRideFilter=makeSpaRideFilter();
const playerRoadFeedback={heave:0,pitch:0,roll:0};
const playerVisualSuspension={heave:0,pitch:0,roll:0,wheels:playerKerbSusp.wheels,active:false};
function resetRoadFeedback(){playerRoadFeedback.heave=playerRoadFeedback.pitch=playerRoadFeedback.roll=0;resetSpaRideFilter(playerSpaRideFilter);resetSpaRideFilter(npcSpaRideFilter);}
function updateRoadFeedback(dt){
 const kmh=Math.abs(carSpeed)/MAX_WORLD_SPEED*MAX_DASH_SPEED;
 const pace=Math.max(0,Math.min(1,(kmh-22)/145));
 // Spa's troublesome raster terrain receives only 40% of the ordinary road texture.
 const amp=(selectedTrack==='spa'?.004:(selectedTrack==='shanghai'?.005:.010))*pace;
 const f=carX*1.12+carZ*.49,g=carZ*1.43-carX*.63;
 const targetH=amp*(.60*Math.sin(f)+.40*Math.sin(g));
 const targetP=amp*.20*Math.sin(f+.75);
 const targetR=amp*.20*Math.cos(g-.30);
 const alpha=1-Math.exp(-Math.min(.05,dt)*13);
 playerRoadFeedback.heave+=(targetH-playerRoadFeedback.heave)*alpha;
 playerRoadFeedback.pitch+=(targetP-playerRoadFeedback.pitch)*alpha;
 playerRoadFeedback.roll+=(targetR-playerRoadFeedback.roll)*alpha;
 playerVisualSuspension.heave=playerKerbSusp.heave+playerRoadFeedback.heave;
 playerVisualSuspension.pitch=playerKerbSusp.pitch+playerRoadFeedback.pitch;
 playerVisualSuspension.roll=playerKerbSusp.roll+playerRoadFeedback.roll;
 playerVisualSuspension.active=playerKerbSusp.active;
}
function updateRideHeights(dt){
 if(!['shanghai','silverstone','spa','singapore'].includes(selectedTrack)){
  playerRideY=0;npcRideY=0;clearKerbSuspension(playerKerbSusp);clearKerbSuspension(npcKerbSusp);
  resetSpaRideFilter(playerSpaRideFilter);resetSpaRideFilter(npcSpaRideFilter);
 }else if(selectedTrack==='spa'){
  // Road contact follows the genuine slope without a lag; only short raster jitter is damped.
  const pose=spaGroundPose(carX,carZ,carHeading);
  const smooth=filterSpaRide(playerSpaRideFilter,pose,carX,carZ,dt);
  playerRideY=smooth.y;playerKerbSusp.pitch=smooth.pitch;playerKerbSusp.roll=smooth.roll;playerKerbSusp.heave=0;
  if(npcGhostActive){const other=spaGroundPose(npcX,npcZ,npcHeading);
   const npcSmooth=filterSpaRide(npcSpaRideFilter,other,npcX,npcZ,dt);
   npcRideY=npcSmooth.y;npcKerbSusp.pitch=npcSmooth.pitch;npcKerbSusp.roll=npcSmooth.roll;npcKerbSusp.heave=0;}
 }else{
  const playerTarget=rideTargetY(carX,carZ),npcTarget=rideTargetY(npcX,npcZ);
  const blend=1-Math.exp(-Math.max(0,dt)*21);
  if(Math.hypot(carX-previousRidePX,carZ-previousRidePZ)>18)playerRideY=playerTarget;
  else playerRideY+=(playerTarget-playerRideY)*blend;
  if(Math.hypot(npcX-previousRideNX,npcZ-previousRideNZ)>18)npcRideY=npcTarget;
  else npcRideY+=(npcTarget-npcRideY)*blend;
 }
 previousRidePX=carX;previousRidePZ=carZ;previousRideNX=npcX;previousRideNZ=npcZ;
 const playerKmh=Math.abs(carSpeed)/MAX_WORLD_SPEED*MAX_DASH_SPEED;
 if(['shanghai','silverstone','singapore'].includes(selectedTrack))updateKerbSuspension(playerKerbSusp,carX,carZ,carHeading,playerKmh,dt);
 else if(selectedTrack!=='spa')clearKerbSuspension(playerKerbSusp);
 if(['shanghai','silverstone','singapore'].includes(selectedTrack)&&npcGhostActive)updateKerbSuspension(npcKerbSusp,npcX,npcZ,npcHeading,npcSpeedKmh,dt);
 else if(selectedTrack!=='spa')clearKerbSuspension(npcKerbSusp);
 // Small spring-damped road feel on the oval, Shanghai, Silverstone, Spa and Singapore.
 updateRoadFeedback(dt);
}
function modelGroundY(team,y){return y-(selectedTrack==='spa'&&team==='redbull'?.075:0);}
function playerBodyFrame(){
 const gy=(['shanghai','silverstone','spa','singapore'].includes(selectedTrack))?playerRideY+playerVisualSuspension.heave:trackGroundY(carX,carZ);
 return carBodyFrame(selectedPlayerTeam,carX,modelGroundY(selectedPlayerTeam,gy),carZ,carHeading,playerVisualSuspension);
}
function drawCustomCar(viewProj){
 activeCarSuspension=playerVisualSuspension;
 const p=playerBodyFrame();
 if(selectedPlayerTeam==='redbull')return drawSingleCarAt(viewProj,npcCarAsset,p.x,p.y,p.z,p.heading);
 if(selectedPlayerTeam==='ferrari')return drawSingleCarAt(viewProj,ferrariCarAsset,p.x,p.y,p.z,p.heading);
 if(selectedPlayerTeam==='mercedes')return drawSingleCarAt(viewProj,mercedesCarAsset,p.x,p.y,p.z,p.heading);
 if(additionalTeamAssets[selectedPlayerTeam])return drawSingleCarAt(viewProj,additionalTeamAssets[selectedPlayerTeam],p.x,p.y,p.z,p.heading);
 return drawGroupedCarAt(viewProj,userCarAsset,p.x,p.y,p.z,p.heading,wheelSpin,frontWheelSteer);
}
async function loadNpcCar(){
 const status=document.getElementById('npcModelStatus');
 try{
   if(!uintIndicesExt)throw new Error('This browser lacks 32-bit WebGL index support.');
   if(typeof DecompressionStream==='undefined')throw new Error('This browser lacks built-in DEFLATE support.');
   const raw=atob(NPC_CAR_GLB_DEFLATE_B64),zip=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)zip[i]=raw.charCodeAt(i);
   const stream=new Blob([zip]).stream().pipeThrough(new DecompressionStream('deflate'));
   const full=await new Response(stream).arrayBuffer(),dv=new DataView(full);
   if(dv.getUint32(0,true)!==0x46546c67)throw new Error('Red Bull RB22 GLB header is invalid.');
   const jsonLength=dv.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(full,20,jsonLength)));
   const binHead=20+jsonLength,binType=dv.getUint32(binHead+4,true);
   if(binType!==0x004e4942)throw new Error('Red Bull RB22 binary chunk is missing.');
   const binStart=binHead+8;
   function accessorData(i,kind){
     const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],off=binStart+(v.byteOffset||0)+(a.byteOffset||0);
     if(kind==='f32')return new Float32Array(full,off,a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]));
     if(kind==='u32'){if(a.componentType!==5125)throw new Error('Red Bull RB22 indices must be uint32.');return new Uint32Array(full,off,a.count);}
     throw new Error('Unsupported Red Bull RB22 accessor');
   }
   function buffer(target,data){const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;}
   const textureCache=new Map();
   async function loadTextureForMaterial(materialIndex){
     const mat=doc.materials[materialIndex]||{};
     const texIndex=mat.pbrMetallicRoughness&&mat.pbrMetallicRoughness.baseColorTexture?mat.pbrMetallicRoughness.baseColorTexture.index:null;
     if(texIndex==null)return null;
     const imageIndex=doc.textures[texIndex]&&doc.textures[texIndex].source;
     if(imageIndex==null)throw new Error('Red Bull RB22 material references a missing image.');
     if(textureCache.has(imageIndex))return textureCache.get(imageIndex);
     const image=doc.images[imageIndex],iv=doc.bufferViews[image.bufferView],offset=binStart+(iv.byteOffset||0),bytes=new Uint8Array(full,offset,iv.byteLength);
     const bitmap=await createImageBitmap(new Blob([bytes],{type:image.mimeType||'image/png'}));
     const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
     textureCache.set(imageIndex,tex);return tex;
   }
   const batches=[];
   for(const pr of doc.meshes[0].primitives){
     const ids=accessorData(pr.indices,'u32');
     const [tex]=[await loadTextureForMaterial(pr.material)];
      const material=doc.materials[pr.material]||{};const batch={name:material.name||'rb22_part',group:0,alphaMode:material.alphaMode||'OPAQUE',alphaCutoff:material.alphaCutoff==null?0.5:material.alphaCutoff,baseColorFactor:(material.pbrMetallicRoughness&&material.pbrMetallicRoughness.baseColorFactor)||[1,1,1,1],count:ids.length,ib:buffer(gl.ELEMENT_ARRAY_BUFFER,ids),pb:buffer(gl.ARRAY_BUFFER,accessorData(pr.attributes.POSITION,'f32')),nb:buffer(gl.ARRAY_BUFFER,accessorData(pr.attributes.NORMAL,'f32')),uvb:buffer(gl.ARRAY_BUFFER,accessorData(pr.attributes.TEXCOORD_0,'f32')),tex};
     batches.push(batch);
   }
   npcCarAsset={batches,team:'redbull',modelName:'RB22'};
   status.textContent='RED BULL RB22 READY · '+batches.length+' MATERIAL PARTS';status.style.color='#8be1a2';
 }catch(e){status.textContent='NPC LOAD FAILED';status.style.color='#ffb2a4';console.error('Could not load Red Bull RB22 model:',e);}
}
async function loadFerrariCar(){
 const status=document.getElementById('ferrariModelStatus');
 try{
   if(!uintIndicesExt)throw new Error('This browser lacks 32-bit WebGL index support.');
   if(typeof DecompressionStream==='undefined')throw new Error('This browser lacks built-in DEFLATE support.');
   const raw=atob(FERRARI_CAR_GLB_DEFLATE_B64),zip=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)zip[i]=raw.charCodeAt(i);
   const stream=new Blob([zip]).stream().pipeThrough(new DecompressionStream('deflate'));
   const full=await new Response(stream).arrayBuffer(),dv=new DataView(full);
   if(dv.getUint32(0,true)!==0x46546c67)throw new Error('Ferrari SF26 GLB header is invalid.');
   const jsonLength=dv.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(full,20,jsonLength)));
   const binHead=20+jsonLength,binType=dv.getUint32(binHead+4,true);
   if(binType!==0x004e4942)throw new Error('Ferrari SF26 binary chunk is missing.');
   const binStart=binHead+8;
   function acc(i,kind){
     const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],off=binStart+(v.byteOffset||0)+(a.byteOffset||0);
     if(kind==='f32')return new Float32Array(full,off,a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]));
     if(kind==='u32'){if(a.componentType!==5125)throw new Error('Ferrari SF26 index buffer is not uint32.');return new Uint32Array(full,off,a.count);}
     throw new Error('Unsupported Ferrari SF26 accessor');
   }
   function buf(target,data){const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;}
   const images=[];
   for(let i=0;i<(doc.images||[]).length;i++){
     const im=doc.images[i],iv=doc.bufferViews[im.bufferView],off=binStart+(iv.byteOffset||0),bytes=new Uint8Array(full,off,iv.byteLength);
     const bitmap=await createImageBitmap(new Blob([bytes],{type:im.mimeType||'image/png'}));
     const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
     images.push(tex);bitmap.close();
   }
   const textures=(doc.textures||[]).map(t=>images[t.source]||null);
   const batches=[];
   for(const mesh of (doc.meshes||[]))for(const pr of (mesh.primitives||[])){
     if(pr.mode!=null&&pr.mode!==4)continue;
     const mat=doc.materials&&doc.materials[pr.material]||{};
     const pbr=mat.pbrMetallicRoughness||{};
     const texRef=pbr.baseColorTexture;
     const tex=texRef&&doc.textures?textures[texRef.index]:null;
     if(!pr.indices||pr.attributes.POSITION==null||pr.attributes.NORMAL==null||pr.attributes.TEXCOORD_0==null)continue;
     const ids=acc(pr.indices,'u32');
     const batch={name:mesh.name||mat.name||'Ferrari SF26 part',group:0,count:ids.length,ib:buf(gl.ELEMENT_ARRAY_BUFFER,ids),pb:buf(gl.ARRAY_BUFFER,acc(pr.attributes.POSITION,'f32')),nb:buf(gl.ARRAY_BUFFER,acc(pr.attributes.NORMAL,'f32')),uvb:buf(gl.ARRAY_BUFFER,acc(pr.attributes.TEXCOORD_0,'f32')),tex,alphaMode:mat.alphaMode||'OPAQUE',alphaCutoff:mat.alphaCutoff==null?0.5:mat.alphaCutoff,baseColorFactor:pbr.baseColorFactor||[1,1,1,1]};
     batches.push(batch);
   }
   if(!batches.length)throw new Error('Ferrari SF26 contains no supported mesh primitives.');
   ferrariCarAsset={batches,team:'ferrari',modelName:'SF26'};
   status.textContent='FERRARI SF26 READY · '+batches.length+' MATERIAL BATCHES';status.style.color='#8eeda5';
   document.querySelectorAll('option[value="ferrari"]').forEach(o=>{o.disabled=false;o.textContent='Ferrari SF26 · Available';});
 }catch(e){status.textContent='FERRARI LOAD FAILED';status.style.color='#ffb2a4';console.error('Could not load Ferrari SF26 model:',e);}
}
async function loadMercedesCar(){
 const status=document.getElementById('mercedesModelStatus');
 try{
   if(!uintIndicesExt)throw new Error('This browser lacks 32-bit WebGL index support.');
   if(typeof DecompressionStream==='undefined')throw new Error('This browser lacks built-in DEFLATE support.');
   const raw=atob(MERCEDES_CAR_GLB_DEFLATE_B64),zip=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)zip[i]=raw.charCodeAt(i);
   const stream=new Blob([zip]).stream().pipeThrough(new DecompressionStream('deflate'));
   const full=await new Response(stream).arrayBuffer(),dv=new DataView(full);
   if(dv.getUint32(0,true)!==0x46546c67)throw new Error('Mercedes GLB header is invalid.');
   const jsonLength=dv.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(full,20,jsonLength)));
   const binHead=20+jsonLength,binLength=dv.getUint32(binHead,true),binType=dv.getUint32(binHead+4,true);
   if(binType!==0x004e4942)throw new Error('Mercedes GLB binary chunk is missing.');
   const binStart=binHead+8;
   function acc(i,kind){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],off=binStart+(v.byteOffset||0)+(a.byteOffset||0);if(kind==='f32')return new Float32Array(full,off,a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]));if(kind==='u32')return new Uint32Array(full,off,a.count);throw new Error('Unsupported NPC accessor');}
   function buf(target,data){const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;}
   const pr=doc.meshes[0].primitives[0],ids=acc(pr.indices,'u32');
   const batch={name:'mercedesBody',group:0,count:ids.length,ib:buf(gl.ELEMENT_ARRAY_BUFFER,ids),pb:buf(gl.ARRAY_BUFFER,acc(pr.attributes.POSITION,'f32')),nb:buf(gl.ARRAY_BUFFER,acc(pr.attributes.NORMAL,'f32')),uvb:buf(gl.ARRAY_BUFFER,acc(pr.attributes.TEXCOORD_0,'f32'))};
   const img=doc.images[0],iv=doc.bufferViews[img.bufferView],off=binStart+(iv.byteOffset||0),bytes=new Uint8Array(full,off,iv.byteLength);
   const bitmap=await createImageBitmap(new Blob([bytes],{type:img.mimeType||'image/jpeg'}));
   const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,bitmap);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
   mercedesCarAsset={batch,tex};status.textContent='MERCEDES CAR READY';status.style.color='#8be1a2';document.querySelectorAll('option[value="mercedes"]').forEach(o=>{o.disabled=false;o.textContent='Mercedes · Available';});
 }catch(e){status.textContent='MERCEDES LOAD FAILED';status.style.color='#ffb2a4';console.error('Could not load Mercedes model:',e);}
}

async function loadAdditionalTeamCar(team){
 if(additionalTeamAssets[team])return additionalTeamAssets[team];
 if(additionalTeamLoading[team])return additionalTeamLoading[team];
 const packed=ADDITIONAL_TEAM_MODEL_B64[team];
 if(!packed)throw new Error('No additional model is registered for '+teamDisplayName(team)+'.');
 const status=document.getElementById('teamLoadStatus');
 if(status)status.textContent='LOADING '+teamDisplayName(team)+' MODEL…';
 additionalTeamLoading[team]=(async()=>{
  try{
   if(!uintIndicesExt)throw new Error('This browser lacks 32-bit WebGL index support.');
   if(typeof DecompressionStream==='undefined')throw new Error('This browser lacks built-in DEFLATE support.');
   const raw=atob(packed),zip=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)zip[i]=raw.charCodeAt(i);
   const stream=new Blob([zip]).stream().pipeThrough(new DecompressionStream('deflate'));
   const full=await new Response(stream).arrayBuffer(),dv=new DataView(full);
   if(dv.getUint32(0,true)!==0x46546c67)throw new Error(teamDisplayName(team)+' GLB header is invalid.');
   const jsonLength=dv.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(full,20,jsonLength)));
   const binHead=20+jsonLength,binType=dv.getUint32(binHead+4,true);
   if(binType!==0x004e4942)throw new Error(teamDisplayName(team)+' binary chunk is missing.');
   const binStart=binHead+8;
   function acc(i,kind){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],off=binStart+(v.byteOffset||0)+(a.byteOffset||0);if(kind==='f32')return new Float32Array(full,off,a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]));if(kind==='u32'){if(a.componentType!==5125)throw new Error('Expected 32-bit indices for '+teamDisplayName(team));return new Uint32Array(full,off,a.count);}throw new Error('Unsupported '+teamDisplayName(team)+' accessor');}
   function buf(target,data){const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;}
   const pr=doc.meshes[0].primitives[0],ids=acc(pr.indices,'u32');
   const batch={name:team+'Body',group:0,count:ids.length,ib:buf(gl.ELEMENT_ARRAY_BUFFER,ids),pb:buf(gl.ARRAY_BUFFER,acc(pr.attributes.POSITION,'f32')),nb:buf(gl.ARRAY_BUFFER,acc(pr.attributes.NORMAL,'f32')),uvb:buf(gl.ARRAY_BUFFER,acc(pr.attributes.TEXCOORD_0,'f32'))};
   const img=doc.images[0],iv=doc.bufferViews[img.bufferView],off=binStart+(iv.byteOffset||0),bytes=new Uint8Array(full,off,iv.byteLength);
   const bitmap=await createImageBitmap(new Blob([bytes],{type:img.mimeType||'image/jpeg'}));
   const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,bitmap);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
   const asset={batch,tex};additionalTeamAssets[team]=asset;
   if(status)status.textContent=teamDisplayName(team)+' MODEL READY';
   return asset;
  }catch(e){delete additionalTeamLoading[team];if(status)status.textContent=teamDisplayName(team)+' LOAD FAILED · '+e.message;console.error('Could not load additional team model '+team+':',e);throw e;}
 })();
 return additionalTeamLoading[team];
}
async function ensureTeamModelReady(team){
 if(ADDITIONAL_TEAM_MODEL_B64[team])return loadAdditionalTeamCar(team);
 await coreModelLoadPromise;
 const assets={mclaren:userCarAsset,redbull:npcCarAsset,ferrari:ferrariCarAsset,mercedes:mercedesCarAsset};
 if(!assets[team])throw new Error(teamDisplayName(team)+' model did not finish loading.');
 return assets[team];
}

function drawNpcCar(viewProj){
 if(!npcGhostActive)return false;
 activeCarSuspension=npcKerbSusp;
 const gy=(['shanghai','silverstone','spa','singapore'].includes(selectedTrack))?modelGroundY(selectedNpcTeam,npcRideY+npcKerbSusp.heave):trackGroundY(npcX,npcZ);
 if(selectedNpcTeam==='mclaren')return drawGroupedCarAt(viewProj,userCarAsset,npcX,.577+gy,npcZ,npcHeading,npcWheelSpin,npcFrontWheelSteer);
 if(selectedNpcTeam==='ferrari')return drawSingleCarAt(viewProj,ferrariCarAsset,npcX,.5+gy,npcZ,npcHeading+Math.PI);
 if(selectedNpcTeam==='mercedes')return drawSingleCarAt(viewProj,mercedesCarAsset,npcX,.5+gy,npcZ,npcHeading+Math.PI);
 if(additionalTeamAssets[selectedNpcTeam])return drawSingleCarAt(viewProj,additionalTeamAssets[selectedNpcTeam],npcX,.5+gy,npcZ,npcHeading+Math.PI);
 return drawSingleCarAt(viewProj,npcCarAsset,npcX,.075+gy,npcZ,npcHeading);
}
gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(0.69,0.83,0.97,1); // pale-blue daytime sky; track uses the stable base-colour shader, cars retain their own lighting
function norm(v){const n=Math.hypot(...v)||1;return v.map(x=>x/n)}function sub(a,b){return a.map((x,i)=>x-b[i])}function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}function dot(a,b){return a.reduce((s,x,i)=>s+x*b[i],0)}
function lookAt(eye,center,up){const z=norm(sub(eye,center)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
let yaw=-.62,pitch=.55,distance=13,drag=false,lastX=0,lastY=0;
let cameraMode='chase';
let gameStarted=false;
let carX=0,carZ=0,carHeading=0,carSpeed=0,offroad=false;
let travelHeading=0; // movement direction; lags behind body heading on grass to simulate loss of traction
let wheelSpin=0,frontWheelSteer=0,steeringInput=0,actualTurnRadius=Infinity;
let brakePressure=0;
let brakeHoldTime=0;
let brakeStartSpeedKmh=0; // speed at the start of the current braking application
let tireLocked=false;
let tireRecovery=0;
// Smoothed chase-camera state prevents a sudden zoom-out above 200 km/h.
let chaseBackCurrent=6.8,chaseHeightCurrent=2.25,chaseLookAheadCurrent=6.0,chaseFovCurrent=50;

// Formula Racing NPC: fixed-line AI until the player's first completed lap, then replay the player's latest lap as a pace ghost.
const NPC_LANE_OFFSET=2.45, NPC_LANE_RADIUS=R-NPC_LANE_OFFSET;
const NPC_LOOP_LENGTH=2*SW+2*Math.PI*NPC_LANE_RADIUS;
let NPC_STRAIGHT_KMH=300, NPC_CORNER_KMH=170, NPC_BRAKE_ZONE=42;
const NPC_DIFFICULTIES={
 easy:{straight:260,corner:145,brakeZone:42},
 normal:{straight:300,corner:170,brakeZone:42},
 hard:{straight:320,corner:200,brakeZone:48},
 master:{straight:320,corner:220,brakeZone:52}
};
let selectedNpcDifficulty='normal';
let selectedPlayerTeam='mclaren', selectedNpcTeam='redbull';
const additionalTeamAssets=Object.create(null);
const additionalTeamLoading=Object.create(null);
let coreModelLoadPromise=Promise.resolve();
function teamDisplayName(team){const names={mclaren:'McLAREN',redbull:'RED BULL',ferrari:'FERRARI',mercedes:'MERCEDES',astonmartin:'ASTON MARTIN',alpine:'ALPINE',williams:'WILLIAMS',haas:'HAAS',racingbulls:'RACING BULLS',audi:'AUDI',cadillac:'CADILLAC'};return names[team]||String(team||'').toUpperCase();}
let npcWheelSpin=0, npcFrontWheelSteer=0;
const NPC_ACCEL_KMH_PER_SEC=62, NPC_BRAKE_KMH_PER_SEC=145;
let npcDistance=56.0, npcX=16, npcZ=NPC_LANE_OFFSET, npcHeading=0, npcSpeedKmh=235;
function silverstonePoseAt(s,laneOffset=0){
 s=((s%SILVERSTONE_LOOP_LENGTH)+SILVERSTONE_LOOP_LENGTH)%SILVERSTONE_LOOP_LENGTH;
 const f=s/SILVERSTONE_PATH_STEP, i=Math.floor(f)%SILVERSTONE_SAMPLE_COUNT, j=(i+1)%SILVERSTONE_SAMPLE_COUNT, t=f-Math.floor(f);
 const o=i*4, q=j*4;
 const x=SILVERSTONE_ROUTE[o]+(SILVERSTONE_ROUTE[q]-SILVERSTONE_ROUTE[o])*t;
 const z=SILVERSTONE_ROUTE[o+1]+(SILVERSTONE_ROUTE[q+1]-SILVERSTONE_ROUTE[o+1])*t;
 const h0=SILVERSTONE_ROUTE[o+2],h1=SILVERSTONE_ROUTE[q+2];
 const dh=Math.atan2(Math.sin(h1-h0),Math.cos(h1-h0));
 const heading=h0+dh*t;
 const curvature=SILVERSTONE_ROUTE[o+3]+(SILVERSTONE_ROUTE[q+3]-SILVERSTONE_ROUTE[o+3])*t;
 const nx=-Math.sin(heading), nz=Math.cos(heading);
 return {x:x+nx*laneOffset,z:z+nz*laneOffset,heading,curvature,radius:curvature>1e-5?1/curvature:Infinity};
}
function silverstoneNearest(x,z){
 let best=Infinity,bi=0;
 // Coarse every-other-sample scan is enough for a stable surface indicator and stays cheap each frame.
 for(let i=0;i<SILVERSTONE_SAMPLE_COUNT;i+=2){const o=i*4,dx=x-SILVERSTONE_ROUTE[o],dz=z-SILVERSTONE_ROUTE[o+1],d=dx*dx+dz*dz;if(d<best){best=d;bi=i;}}
 const o=bi*4,curv=SILVERSTONE_ROUTE[o+3];
 return {distance:Math.sqrt(best),index:bi,radius:curv>1e-5?1/curv:Infinity};
}
function shanghaiPoseAt(s,laneOffset=0){
 s=((s%SHANGHAI_LOOP_LENGTH)+SHANGHAI_LOOP_LENGTH)%SHANGHAI_LOOP_LENGTH;
 // Reverse the progression along the same physical track, without rotating or scaling the track mesh.
 const sourceS=(SHANGHAI_LOOP_LENGTH-s)%SHANGHAI_LOOP_LENGTH;
 const f=sourceS/SHANGHAI_PATH_STEP,i=Math.floor(f)%SHANGHAI_SAMPLE_COUNT,j=(i+1)%SHANGHAI_SAMPLE_COUNT,t=f-Math.floor(f);
 const o=i*SHANGHAI_ROUTE_STRIDE,q=j*SHANGHAI_ROUTE_STRIDE;
 const x=SHANGHAI_ROUTE[o]+(SHANGHAI_ROUTE[q]-SHANGHAI_ROUTE[o])*t;
 const z=SHANGHAI_ROUTE[o+1]+(SHANGHAI_ROUTE[q+1]-SHANGHAI_ROUTE[o+1])*t;
 const y=SHANGHAI_ROUTE[o+2]+(SHANGHAI_ROUTE[q+2]-SHANGHAI_ROUTE[o+2])*t;
 const h0=SHANGHAI_ROUTE[o+3],h1=SHANGHAI_ROUTE[q+3],dh=Math.atan2(Math.sin(h1-h0),Math.cos(h1-h0));
 const heading=h0+dh*t+Math.PI;
 const curvature=Math.max(0,SHANGHAI_ROUTE[o+4]+(SHANGHAI_ROUTE[q+4]-SHANGHAI_ROUTE[o+4])*t);
 const nx=-Math.sin(heading),nz=Math.cos(heading);
 return {x:x+nx*laneOffset,z:z+nz*laneOffset,y,heading,curvature,radius:curvature>1e-5?1/curvature:Infinity};
}
// Smooth Shanghai terrain lookup: project to the closest line segment, interpolate its height
// continuously instead of snapping to the nearest route vertex (the old 2 m staircase).
function shanghaiNearest(x,z){
 let coarse=Infinity,nearestIndex=0;
 for(let i=0;i<SHANGHAI_SAMPLE_COUNT;i+=2){
  const o=i*SHANGHAI_ROUTE_STRIDE,dx=x-SHANGHAI_ROUTE[o],dz=z-SHANGHAI_ROUTE[o+1];
  const d=dx*dx+dz*dz;if(d<coarse){coarse=d;nearestIndex=i;}
 }
 let best=Infinity,segment=nearestIndex,at=0,px=0,pz=0,height=0,angle=0,curvature=0;
 for(let k=-4;k<=3;k++){
  const i=(nearestIndex+k+SHANGHAI_SAMPLE_COUNT)%SHANGHAI_SAMPLE_COUNT;
  const j=(i+1)%SHANGHAI_SAMPLE_COUNT;
  const a=i*SHANGHAI_ROUTE_STRIDE,b=j*SHANGHAI_ROUTE_STRIDE;
  const ax=SHANGHAI_ROUTE[a],az=SHANGHAI_ROUTE[a+1],bx=SHANGHAI_ROUTE[b],bz=SHANGHAI_ROUTE[b+1];
  const dx=bx-ax,dz=bz-az,len2=Math.max(dx*dx+dz*dz,0.000001);
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/len2));
  const xx=ax+dx*t,zz=az+dz*t,d=(x-xx)*(x-xx)+(z-zz)*(z-zz);
  if(d<best){
   best=d;segment=i;at=t;px=xx;pz=zz;
   height=SHANGHAI_ROUTE[a+2]*(1-t)+SHANGHAI_ROUTE[b+2]*t;
   const ha=SHANGHAI_ROUTE[a+3],hb=SHANGHAI_ROUTE[b+3];
   angle=ha+Math.atan2(Math.sin(hb-ha),Math.cos(hb-ha))*t+Math.PI;
   curvature=SHANGHAI_ROUTE[a+4]*(1-t)+SHANGHAI_ROUTE[b+4]*t;
  }
 }
 const nx=-Math.sin(angle),nz=Math.cos(angle);
 const progressIndex=(segment+at)%SHANGHAI_SAMPLE_COUNT;
 return {distance:Math.sqrt(best),index:Math.round(progressIndex)%SHANGHAI_SAMPLE_COUNT,
   progressIndex,radius:curvature>1e-5?1/curvature:Infinity,height,
   signedOffset:(x-px)*nx+(z-pz)*nz,centerX:px,centerZ:pz};
}
function shanghaiHeightAt(x,z){return shanghaiNearest(x,z).height;}
// Use the Shanghai track's original kerb geometry and paint. No duplicate raised-kerb mesh.
function shanghaiTargetSpeedAt(s){
 const here=shanghaiPoseAt(s,0),cornerRadius=SHANGHAI_CORNER_RADIUS;
 if(here.radius<cornerRadius)return NPC_CORNER_KMH;
 let distanceToCorner=Infinity;
 const brakeZone=NPC_BRAKE_ZONE;
 const scanAhead=Math.min(brakeZone+82*SHANGHAI_BRAKE_DISTANCE_SCALE,SHANGHAI_LOOP_LENGTH);
 for(let d=SHANGHAI_PATH_STEP;d<=scanAhead;d+=SHANGHAI_PATH_STEP*2){if(shanghaiPoseAt(s+d,0).radius<cornerRadius){distanceToCorner=d;break;}}
 if(distanceToCorner<=brakeZone){const blend=npcSmooth01(distanceToCorner/brakeZone);return NPC_CORNER_KMH+(NPC_STRAIGHT_KMH-NPC_CORNER_KMH)*blend;}
 if(distanceToCorner<brakeZone+65*SHANGHAI_BRAKE_DISTANCE_SCALE){const t=(distanceToCorner-brakeZone)/(65*SHANGHAI_BRAKE_DISTANCE_SCALE);const blend=npcSmooth01(t);return NPC_CORNER_KMH+(NPC_STRAIGHT_KMH-NPC_CORNER_KMH)*blend;}
 return NPC_STRAIGHT_KMH;
}
function silverstoneTargetSpeedAt(s){
 const here=silverstonePoseAt(s,0), cornerRadius=59.5;
 if(here.radius<cornerRadius)return NPC_CORNER_KMH;
 let distanceToCorner=Infinity;
 // Use the selected difficulty's configured brake zone; the old local name `brakeZone`
 // was undefined on Silverstone and crashed the game when the start lights went out.
 const brakeZone=NPC_BRAKE_ZONE;
 const scanAhead=Math.min(brakeZone+70*SILVERSTONE_BRAKE_DISTANCE_SCALE,SILVERSTONE_LOOP_LENGTH);
 for(let d=SILVERSTONE_PATH_STEP;d<=scanAhead;d+=SILVERSTONE_PATH_STEP){
  if(silverstonePoseAt(s+d,0).radius<cornerRadius){distanceToCorner=d;break;}
 }
 if(distanceToCorner<=brakeZone){const blend=npcSmooth01(distanceToCorner/brakeZone);return NPC_CORNER_KMH+(NPC_STRAIGHT_KMH-NPC_CORNER_KMH)*blend;}
 return NPC_STRAIGHT_KMH;
}
function npcPathPose(s){
 if(selectedTrack==='silverstone')return silverstonePoseAt(s,NPC_LANE_OFFSET);
 if(selectedTrack==='shanghai')return shanghaiPoseAt(s,SHANGHAI_NPC_LANE_OFFSET);
 s=((s%NPC_LOOP_LENGTH)+NPC_LOOP_LENGTH)%NPC_LOOP_LENGTH;
 const straight=SW, arc=Math.PI*NPC_LANE_RADIUS;
 if(s<straight) return {x:-L+s,z:NPC_LANE_OFFSET,heading:0};
 s-=straight;
 if(s<arc){const a=-Math.PI/2+s/NPC_LANE_RADIUS;return {x:L+NPC_LANE_RADIUS*Math.cos(a),z:R+NPC_LANE_RADIUS*Math.sin(a),heading:a+Math.PI/2};}
 s-=arc;
 if(s<straight) return {x:L-s,z:2*R-NPC_LANE_OFFSET,heading:Math.PI};
 s-=straight;
 const a=Math.PI/2+s/NPC_LANE_RADIUS;
 return {x:-L+NPC_LANE_RADIUS*Math.cos(a),z:R+NPC_LANE_RADIUS*Math.sin(a),heading:a+Math.PI/2};
}
function npcSmooth01(t){t=clamp(t,0,1);return t*t*(3-2*t);}
function npcTargetSpeedAt(s){
 if(selectedTrack==='silverstone')return silverstoneTargetSpeedAt(s);
 if(selectedTrack==='shanghai')return shanghaiTargetSpeedAt(s);
 // On straights the NPC accelerates toward 300 km/h, then progressively sheds speed
 // during the 42 m braking zone before each semicircular bend.
 s=((s%NPC_LOOP_LENGTH)+NPC_LOOP_LENGTH)%NPC_LOOP_LENGTH;
 const straight=SW, arc=Math.PI*NPC_LANE_RADIUS, firstCornerEnd=straight+arc, secondStraightEnd=firstCornerEnd+straight;
 let distanceToCorner;
 if(s<straight) distanceToCorner=straight-s;
 else if(s<firstCornerEnd) return NPC_CORNER_KMH;
 else if(s<secondStraightEnd) distanceToCorner=secondStraightEnd-s;
 else return NPC_CORNER_KMH;
 if(distanceToCorner>=NPC_BRAKE_ZONE) return NPC_STRAIGHT_KMH;
 const blend=npcSmooth01(distanceToCorner/NPC_BRAKE_ZONE);
 return NPC_CORNER_KMH+(NPC_STRAIGHT_KMH-NPC_CORNER_KMH)*blend;
}
function lerpAngle(a,b,t){const d=Math.atan2(Math.sin(b-a),Math.cos(b-a));return a+d*t;}
function sampleNpcReplay(now){
 if(!npcLapReplay||npcLapReplay.length<2)return false;
 const elapsed=Math.max(0,now-npcReplayStartAt);
 const samples=npcLapReplay;
 // Repeat the fastest lap indefinitely. Never stop the ghost at the end.
 const loopElapsed=elapsed%Math.max(1,npcReplayDurationMs);
 let lo=0,hi=samples.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(samples[mid].t<=loopElapsed)lo=mid;else hi=mid;}
 const a=samples[lo],b=samples[hi],span=Math.max(1,b.t-a.t),t=clamp((loopElapsed-a.t)/span,0,1);
 // Offset the replay slightly to the adjacent lane, preserving the recorded racing line and body heading.
 const lane=0, ah=a.travelHeading??a.heading, bh=b.travelHeading??b.heading;
 const ax=a.x-Math.sin(ah)*lane, az=a.z+Math.cos(ah)*lane;
 const bx=b.x-Math.sin(bh)*lane, bz=b.z+Math.cos(bh)*lane;
 npcX=ax+(bx-ax)*t;npcZ=az+(bz-az)*t;npcHeading=lerpAngle(a.heading,b.heading,t);
 npcFrontWheelSteer=(a.frontWheelSteer||0)+((b.frontWheelSteer||0)-(a.frontWheelSteer||0))*t;
 npcWheelSpin=lerpAngle(a.wheelSpin||0,b.wheelSpin||0,t);
 npcSpeedKmh=(a.speedKmh||0)+((b.speedKmh||0)-(a.speedKmh||0))*t;
 return true;
}
// Free-drive NPC for circuits without a VERIFIED AI raceline.
// Rather than teleporting onto the legacy oval, follow the player's recently driven road
// with a safe arc-length delay. This is explicitly NOT a competitive track-aware AI.

// Best-lap challenge replaces the previous independent AI route and player-trail follower.
// Kept solely as a reset compatibility stub for the existing grid-reset path.
function resetIndependentNpc(){}
function updateNpc(dt){
 if(!npcGhostActive||!npcLapReplay)return;
 sampleNpcReplay(performance.now());return;
 /* Legacy track AI kept in source but intentionally unreachable in BEST-LAP GHOST mode. */
 const oldHeading=npcHeading;
 const targetKmh=npcTargetSpeedAt(npcDistance);
 if(targetKmh<npcSpeedKmh) npcSpeedKmh=moveToward(npcSpeedKmh,targetKmh,NPC_BRAKE_KMH_PER_SEC*dt);
 else npcSpeedKmh=moveToward(npcSpeedKmh,targetKmh,NPC_ACCEL_KMH_PER_SEC*dt);
 const boostT=clamp((npcSpeedKmh-200)/140,0,1);
 const motionMultiplier=1+0.65*boostT*boostT*(3-2*boostT);
 const trackMotionScale=selectedTrack==='shanghai'?SHANGHAI_MOTION_SCALE:1;
 const pathSpeed=MAX_WORLD_SPEED*(npcSpeedKmh/MAX_DASH_SPEED)*motionMultiplier*trackMotionScale;
 const pathLength=selectedTrack==='silverstone'?SILVERSTONE_LOOP_LENGTH:(selectedTrack==='shanghai'?SHANGHAI_LOOP_LENGTH:NPC_LOOP_LENGTH);
 const moved=Math.max(0,pathSpeed*dt);
 npcDistance=(npcDistance+moved)%pathLength;
 const pose=npcPathPose(npcDistance);npcX=pose.x;npcZ=pose.z;npcHeading=pose.heading;
 if(moved>0.0001){const dh=Math.atan2(Math.sin(npcHeading-oldHeading),Math.cos(npcHeading-oldHeading));npcFrontWheelSteer=clamp(Math.atan2(3.13*dh,moved),-0.42,0.42);npcWheelSpin=(npcWheelSpin+moved/0.30)%(Math.PI*2);}
 else npcFrontWheelSteer=moveToward(npcFrontWheelSteer,0,dt*1.8);
}

const keys=Object.create(null);
const controlsKeys=new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','r',' ']);
window.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();
 if(controlsKeys.has(k)||e.code==='Space')e.preventDefault();
 if(k==='escape'){if(practiceConfigured&&gameStarted&&!countdownActive){e.preventDefault();if(e.repeat)return;if(!gamePaused&&!resumeCountdownActive){pauseCameraMode=cameraMode;gamePaused=true;pauseStartedAt=performance.now();clearDriveKeys();showPauseMenu();}else if(!resumeCountdownActive){if(pausePage!=='menu')showPauseMenu();else resumePractice();}}return;}
 if(k==='r'){if(practiceConfigured&&!gamePaused&&!resumeCountdownActive)resetPracticeGrid();return;}
 if(k==='v'){e.preventDefault();cycleCameraView();return;}
 if(e.code==='Space'||k===' '){
   if(!practiceConfigured||!gameStarted||countdownActive)return;
   if(resumeCountdownActive)return;
   if(gamePaused){
     resumePractice();
   }else{
     pauseCameraMode=cameraMode;gamePaused=true;pauseStartedAt=performance.now();clearDriveKeys();showPauseMenu();
   }
   return;
 }
 if(!gameStarted||countdownActive||gamePaused||resumeCountdownActive)return;
 keys[k]=true;
});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
function fit(){distance=13;}
function resetOrbit(){cameraMode='orbit';yaw=-.62;pitch=.55;distance=13;syncCameraChoice();}
function orbitCar(){cameraMode='orbit';yaw=-.72;pitch=.66;distance=15;syncCameraChoice();}
function fitTrack(){const aspect=Math.max(.45,canvas.clientWidth/Math.max(1,canvas.clientHeight));if(selectedTrack==='spa')distance=6900;else if(selectedTrack==='singapore')distance=4800;else if(selectedTrack==='shanghai')distance=Math.max(1750,(980/(Math.tan(21*rad)*aspect))*1.2);else if(selectedTrack==='silverstone')distance=Math.max(1600,(880/(Math.tan(21*rad)*aspect))*1.25);else distance=Math.max(126,78/(Math.tan(21*rad)*aspect));}
function fullTrack(){cameraMode='track';yaw=-.28;pitch=1.20;fitTrack();syncCameraChoice();}
function chase(){cameraMode='chase';syncCameraChoice();}
const CAMERA_SEQUENCE=DRIVING_CAMERAS;
function setCameraView(mode){
 if(mode!=='track'&&mode!=='orbit'&&!CAMERA_SEQUENCE.includes(mode))return;
 if(mode==='orbit'){orbitCar();}else if(mode==='track'){fullTrack();}else{cameraMode=mode;}
 if(gamePaused&&pausePage==='settings')pauseCameraMode=mode;
 syncCameraChoice();
}
function syncCameraChoice(){document.querySelectorAll('.camera-choice').forEach(b=>{const active=b.dataset.view===cameraMode;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});}
function cycleCameraView(){const idx=CAMERA_SEQUENCE.indexOf(cameraMode);setCameraView(CAMERA_SEQUENCE[(idx+1)%CAMERA_SEQUENCE.length]);}

function resetCar(){if(selectedTrack==='silverstone'){
    // Silverstone 2024: the imported GLB's grid heads in the opposite direction
    // from the previous build. Turn the car 180 degrees around the world-up axis.
    // Starting from the previous verified asphalt position, advance toward the
    // front of the visible start grid, with a modest left-side lane adjustment.
    // Keep these as separate offsets for easy non-destructive grid tuning.
    const silverstoneGridHeading=2.19+Math.PI;
    const silverstoneGridForward=70.5; // modest forward adjustment, preserving known correct straight
    const silverstoneGridLeft=-3.5; // move another 5.7 units towards the visual LEFT, not the previous inverted direction
    carX=-423.0+Math.cos(silverstoneGridHeading)*silverstoneGridForward-Math.sin(silverstoneGridHeading)*silverstoneGridLeft;
    carZ= 295.0+Math.sin(silverstoneGridHeading)*silverstoneGridForward+Math.cos(silverstoneGridHeading)*silverstoneGridLeft;
    carHeading=silverstoneGridHeading;
   }else if(selectedTrack==='spa'||selectedTrack==='singapore'){const p=markedTrackPose(selectedTrack,0);carX=p.x;carZ=p.z;carHeading=p.heading;}else if(selectedTrack==='shanghai'){const p=shanghaiPoseAt(SHANGHAI_PLAYER_GRID_S,SHANGHAI_PLAYER_GRID_LANE);carX=p.x;carZ=p.z;carHeading=p.heading;}else{carX=0;carZ=0;carHeading=0;}travelHeading=carHeading;clearKerbSuspension(playerKerbSusp);resetRoadFeedback();playerRideY=rideTargetY(carX,carZ);previousRidePX=carX;previousRidePZ=carZ;carSpeed=0;offroad=false;wheelSpin=0;frontWheelSteer=0;steeringInput=0;brakePressure=0;brakeHoldTime=0;brakeStartSpeedKmh=0;tireLocked=false;tireRecovery=0;solidWallImpactTimer=0;actualTurnRadius=Infinity;document.getElementById('speed').textContent='000';document.getElementById('gear').textContent='N';document.getElementById('radius').textContent='—';document.getElementById('speedFx').style.opacity='0';const resetSurface=getSurfaceAt(carX,carZ),surfaceEl=document.getElementById('surface');surfaceEl.textContent=resetSurface;surfaceEl.style.color=resetSurface==='ROAD'?'#68f0f0':resetSurface==='KERB'?'#ffc66d':'#8be1a2';}
function resetNpcToGrid(){
 npcDistance=selectedTrack==='shanghai'?SHANGHAI_NPC_GRID_S:(selectedTrack==='silverstone'?0:SW/2);
 npcSpeedKmh=0;npcWheelSpin=0;npcFrontWheelSteer=0;
 const p=(selectedTrack==='spa'||selectedTrack==='singapore')?markedTrackPose(selectedTrack,1):
  selectedTrack==='silverstone'?{x:carX-10*Math.cos(carHeading)-2.4*Math.sin(carHeading),z:carZ-10*Math.sin(carHeading)+2.4*Math.cos(carHeading),heading:carHeading}:npcPathPose(npcDistance);
 npcX=p.x;npcZ=p.z;npcHeading=p.heading;
 clearKerbSuspension(npcKerbSusp);npcRideY=rideTargetY(npcX,npcZ);previousRideNX=npcX;previousRideNZ=npcZ;
 resetIndependentNpc();
}
function resetPracticeGrid(){if(!practiceConfigured)return;startPracticeCountdown(true);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function moveToward(v,target,step){return v<target?Math.min(target,v+step):Math.max(target,v-step)}
// Engine acceleration fades progressively with indicated speed. Units are world-speed units per second squared.
function engineAcceleration(kmh){
 if(kmh<240){const t=clamp(kmh/240,0,1);return 8.5-7.0*Math.pow(t,1.4);}
 if(kmh<314){const t=(kmh-240)/74;return 1.5-1.15*t;}
 if(kmh<338){return 0.35*Math.pow(clamp((338-kmh)/24,0,1),0.45);}
 if(kmh<339.4)return 0.06;
 return 0.25;
}
function trackDistance(x,z){
 if(selectedTrack==='silverstone')return silverstoneNearest(x,z).distance;
  if(selectedTrack==='spa')return spaField(x,z,true);
  if(selectedTrack==='singapore')return 0; // Singapore road material classification pending
 if(selectedTrack==='shanghai')return shanghaiNearest(x,z).distance;
 // Signed-free distance to the stadium-shaped oval centreline; used for telemetry only.
 if(x>=-40&&x<=40)return Math.min(Math.abs(z),Math.abs(z-54));
 const cx=x>40?40:-40,cz=27;
 return Math.abs(Math.hypot(x-cx,z-cz)-27);
}
function getSurfaceAt(x,z){
  if(selectedTrack==='spa'){
   const d=spaField(x,z,true);
   return d<12?'ROAD':d<17?'KERB':'GRASS';
  }
  if(selectedTrack==='singapore')return 'ROAD'; // preview: no reliable surface mesh classification yet
 if(selectedTrack==='silverstone'){
   const td=silverstoneField(x,z,true);
   if(td<=4.8)return 'ROAD';
   if(td<=9.0)return 'KERB';
   return 'GRASS';
 }
 if(selectedTrack==='shanghai'){
   const td=shanghaiNearest(x,z).distance;
   if(td<=5.8)return 'ROAD';
   if(td<=7.8)return 'KERB';
   return 'GRASS';
 }
 const td=trackDistance(x,z),curved=Math.abs(x)>38;
 if(td<=6)return 'ROAD';
 if(curved&&td<=7.45)return 'KERB';
 return 'GRASS';
}
function update(dt){
 const forward=keys['w']||keys['arrowup'],reverse=keys['s']||keys['arrowdown'],left=keys['a']||keys['arrowleft'],right=keys['d']||keys['arrowright'];
 const surfaceBefore=getSurfaceAt(carX,carZ),onGrass=surfaceBefore==='GRASS';
 const currentKmh=carSpeed<0?Math.abs(carSpeed)*3.6:(Math.abs(carSpeed)/MAX_WORLD_SPEED)*MAX_DASH_SPEED;
 // Progressive S braking: pressure builds smoothly, with gentler braking at high speed.
 // Sustained heavy braking can lock the tyres; speed still falls, but braking becomes less efficient.
 const isBraking=reverse && carSpeed>0.001;
 if(!isBraking){
   if(tireLocked){tireLocked=false;tireRecovery=1.5;}
   else tireRecovery=Math.max(0,tireRecovery-dt);
   brakeHoldTime=0;
   brakeStartSpeedKmh=0;
 }
 if(isBraking){
   if(brakeHoldTime<=0.0001)brakeStartSpeedKmh=currentKmh;
   brakeHoldTime+=dt;
   brakePressure=moveToward(brakePressure,1,dt*1.35); // reach full pressure in ~0.74 s
   const pressure=brakePressure*brakePressure*(3-2*brakePressure); // smooth ramp-in
   const lockSpeedBlend=clamp((brakeStartSpeedKmh-210)/30,0,1);
   // 210 km/h requires a long, sustained brake; at 240+ km/h lockup can happen sooner.
   // Eligibility uses the speed at brake application, so normal low-speed braking never locks the tyres.
   const lockHoldRequired=1.42-0.62*lockSpeedBlend;
   if(!tireLocked && brakeStartSpeedKmh>=210 && currentKmh>=90 && brakePressure>0.88 && brakeHoldTime>lockHoldRequired){
     tireLocked=true;
     tireRecovery=1.5;
   }
   const v=clamp(carSpeed/MAX_WORLD_SPEED,0,1);
   const speedDependentDecel=2.0+8.0*Math.pow(1-v,0.82); // faster at lower speeds
   const lockEfficiency=tireLocked?0.67:1.0; // locked tyres still slow the car, but less effectively
   carSpeed=Math.max(0,carSpeed-speedDependentDecel*pressure*lockEfficiency*dt);
 }else if(forward){
   brakePressure=moveToward(brakePressure,0,dt*3.5);
   if(carSpeed<0)carSpeed=Math.min(0,carSpeed+8.0*dt);
   else {
     const recoveryAcceleration=1.0-0.42*clamp(tireRecovery/1.5,0,1);
     const grassAccelerationFactor=onGrass?0.04:1.0; // only 4% of engine power reaches the ground on grass; recovery is deliberately very slow
     carSpeed=Math.min(MAX_WORLD_SPEED,carSpeed+engineAcceleration(currentKmh)*recoveryAcceleration*grassAccelerationFactor*dt);
   }
 }else if(reverse){
   brakePressure=moveToward(brakePressure,0,dt*3.0);
   carSpeed=Math.max(-7,carSpeed-5.5*dt); // reverse after the car has stopped
 }else{
   brakePressure=moveToward(brakePressure,0,dt*2.8);
   carSpeed=moveToward(carSpeed,0,1.15*dt);
 }
 if(onGrass){
   // Grass slip/recovery: coasting loses speed heavily; with throttle, drag still sheds racing speed,
   // but becomes small near zero so 4% engine power can slowly get the car moving again.
   const grassSpeed=Math.abs(carSpeed);
   const grassDragPerSecond=forward?(0.18+0.22*grassSpeed):(2.0+0.26*grassSpeed);
   carSpeed=moveToward(carSpeed,0,grassDragPerSecond*dt);
 }
 const displayedBeforeTurn=carSpeed<0?Math.abs(carSpeed)*3.6:(Math.abs(carSpeed)/MAX_WORLD_SPEED)*MAX_DASH_SPEED;
 const steerTarget=(right?1:0)-(left?1:0),speedRatio=clamp(displayedBeforeTurn/MAX_DASH_SPEED,0,1);
 // Keep acceleration/speedometer calibration unchanged; only motion and view effects are altered.
 const boostT=clamp((displayedBeforeTurn-200)/140,0,1),speedMotionMultiplier=1+0.65*boostT*boostT*(3-2*boostT);
 const motionScale=['silverstone','spa','singapore'].includes(selectedTrack)?SILVERSTONE_MOTION_SCALE:(selectedTrack==='shanghai'?SHANGHAI_MOTION_SCALE:1);
 const motionSpeed=carSpeed*speedMotionMultiplier*motionScale,speedAbs=Math.abs(motionSpeed);
 const steerResponse=12-5.0*speedRatio;
 steeringInput+=(steerTarget-steeringInput)*Math.min(1,dt*steerResponse);
 // At high speeds, the real steering angle and yaw both reduce: clear progressive understeer.
 const lowSpeedT=clamp(displayedBeforeTurn/165,0,1);
 const lowSpeedBlend=1-lowSpeedT*lowSpeedT*(3-2*lowSpeedT);
 const lowSpeedSteerBoost=0.08*lowSpeedBlend; // modest low-speed steering aid; avoids twitchy response and fades by 165 km/h
 const maxFrontLock=.42-.40*Math.pow(speedRatio,.55)+lowSpeedSteerBoost;
 frontWheelSteer+=(steeringInput*maxFrontLock-frontWheelSteer)*Math.min(1,dt*(12-3.0*speedRatio));
 const displayForSpin=Math.abs(carSpeed)/MAX_WORLD_SPEED*MAX_DASH_SPEED;
 if(!tireLocked)wheelSpin=(wheelSpin+Math.sign(carSpeed)*(displayForSpin/3.6)/.30*dt)%(Math.PI*2);
 const wheelbase=3.13;
 const bicycleYawRate=(motionSpeed/wheelbase)*Math.tan(frontWheelSteer);
 const recoveryGrip=1.0-0.38*clamp(tireRecovery/1.5,0,1);
 const tireGrip=(tireLocked?0.24:recoveryGrip)*(onGrass?0.28:1.0); // grass has very little lateral grip
 const maxLateralAcceleration=((['silverstone','shanghai','spa','singapore'].includes(selectedTrack))?45.0:17.0)*tireGrip; // map-specific grip calibration: keep F1-like lateral grip on full-size circuit
 const maxGripYawRate=speedAbs>0.15?maxLateralAcceleration/speedAbs:Infinity;
 const yawRate=Math.sign(bicycleYawRate)*Math.min(Math.abs(bicycleYawRate),maxGripYawRate);
 actualTurnRadius=(speedAbs>0.15 && Math.abs(yawRate)>0.002)?speedAbs/Math.abs(yawRate):Infinity;
 carHeading+=yawRate*dt;
 // Separate body heading from movement direction. Road/kerb re-align the trajectory quickly;
 // grass has low lateral grip, so momentum carries the car forward while the body gradually rotates.
 const headingDelta=Math.atan2(Math.sin(carHeading-travelHeading),Math.cos(carHeading-travelHeading));
 const movementSurface=getSurfaceAt(carX,carZ);
 const directionCatchup=movementSurface==='GRASS'?(0.35+0.30*speedRatio):(movementSurface==='KERB'?3.8:8.5);
 travelHeading+=headingDelta*Math.min(1,dt*directionCatchup);
 const previousCarX=carX,previousCarZ=carZ;
 carX+=Math.cos(travelHeading)*motionSpeed*dt;
 carZ+=Math.sin(travelHeading)*motionSpeed*dt;
 // Shanghai's roadside barriers are now solid: crossing their lateral collision line rolls the car back and sheds speed.
 if((selectedTrack==='shanghai' && shanghaiWallHit(previousCarX,previousCarZ,carX,carZ)) || (['spa','singapore','silverstone'].includes(selectedTrack) && venueWallHit(selectedTrack,previousCarX,previousCarZ,carX,carZ))){
  carX=previousCarX;carZ=previousCarZ;
  carSpeed*=0.34;solidWallImpactTimer=0.42;
  // Keep the steering direction; driver can recover or reverse away from the wall.
 }
 solidWallImpactTimer=Math.max(0,solidWallImpactTimer-dt);
 const currentSurface=getSurfaceAt(carX,carZ);offroad=currentSurface==='GRASS';
 const displayedKmh=carSpeed<0?Math.abs(carSpeed)*3.6:(Math.abs(carSpeed)/MAX_WORLD_SPEED)*MAX_DASH_SPEED;
 document.getElementById('speed').textContent=String(Math.round(displayedKmh)).padStart(3,'0');
 document.getElementById('gear').textContent=carSpeed<-.15?'R':Math.abs(carSpeed)<.15?'N':'D';
 const surfaceEl=document.getElementById('surface');
 if(solidWallImpactTimer>0){surfaceEl.textContent='WALL IMPACT';surfaceEl.style.color='#ff8f7d';}
 else if(tireLocked){surfaceEl.textContent='TYRE LOCK';surfaceEl.style.color='#ff6b67';}
 else if(tireRecovery>0.05){surfaceEl.textContent='GRIP RECOVERY';surfaceEl.style.color='#ffc66d';}
 else if(currentSurface==='ROAD'){surfaceEl.textContent='ROAD';surfaceEl.style.color='#68f0f0';}
 else if(playerKerbSusp.active){surfaceEl.textContent='KERB RUMBLE';surfaceEl.style.color='#ffc66d';}
 else if(currentSurface==='KERB'){surfaceEl.textContent=selectedTrack==='shanghai'?'SHOULDER':'KERB';surfaceEl.style.color='#ffc66d';}
 else {surfaceEl.textContent='GRASS';surfaceEl.style.color='#8be1a2';}
 document.getElementById('radius').textContent=Number.isFinite(actualTurnRadius)&&Math.abs(steeringInput)>.08?Math.round(actualTurnRadius)+' m':'—';
 const speedFx=document.getElementById('speedFx');
 const speedBlend=clamp((displayedKmh-150)/190,0,1);
 speedFx.style.opacity=String(cameraMode==='chase'?0.42*Math.pow(speedBlend,0.85):0);
 updatePracticeTiming(performance.now());
}
const IDENTITY=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function carModelMatrix(x,y,z,a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,s,0,0,1,0,0,-s,0,c,0,x,y,z,1]);}
function translationMatrix(x,y,z){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);}
function rotationZMatrix(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]);}
// HUD gears are a virtual automatic readout; engine/traction physics are unchanged.
let displayGear=1;
function updateDrivingHud(kmh){
 const hud=document.getElementById('drivingHud');hud.hidden=!practiceConfigured;
 const shifts=[0,72,112,152,192,232,272,312,360];
 if(kmh<3)displayGear=1;
 while(displayGear<8&&kmh>shifts[displayGear])displayGear++;
 while(displayGear>1&&kmh<shifts[displayGear-1]-8)displayGear--;
 if(gameAudioEngine)displayGear=gameAudioEngine.timeline.gear;
 const label=carSpeed<-.15?'R':Math.abs(carSpeed)<.15?'N':String(displayGear);
 document.getElementById('hudGear').textContent=label;
 document.getElementById('hudSpeed').textContent=String(Math.round(kmh)).padStart(3,'0');
 const progress=label==='N'||label==='R'?0:clamp((kmh-shifts[displayGear-1])/(shifts[displayGear]-shifts[displayGear-1]),0,1);
 document.querySelectorAll('#shiftLights i').forEach((lamp,i)=>lamp.classList.toggle('lit',i<Math.round(progress*12)));
}
let activeCarCameraPosition=[0,6,12];
function draw(now,dt){
 gl.useProgram(prog);
 const dpr=Math.min(window.devicePixelRatio||1,2)*renderResolutionScale,w=Math.max(1,Math.floor(canvas.clientWidth*dpr)),h=Math.max(1,Math.floor(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearStencil(0);gl.stencilMask(255);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
 const aspect=w/h;let eye,center,cameraUp=[0,1,0],nearPlane=selectedTrack==='silverstone'?.45:.1;
 let currentDisplayKmh=carSpeed<0?Math.abs(carSpeed)*3.6:(Math.abs(carSpeed)/MAX_WORLD_SPEED)*MAX_DASH_SPEED;
 updateDrivingHud(currentDisplayKmh);
 const speedRatio=clamp(currentDisplayKmh/MAX_DASH_SPEED,0,1);
 let fovDegrees=42;
 if(cameraMode==='chase'){
   const fx=Math.cos(carHeading),fz=Math.sin(carHeading);
   // Camera pull-back starts earlier, near 120 km/h, and grows smoothly with speed.
   const post200=clamp((currentDisplayKmh-120)/220,0,1);
   const ramp=Math.pow(post200,1.35);
   const brakePush=brakePressure*brakePressure*(3-2*brakePressure);
   const backTarget=6.8+1.8*ramp-.7*brakePush;
   const heightTarget=2.25+.35*ramp-.08*brakePush;
   const lookAheadTarget=6.0+3.0*ramp-1.0*brakePush;
   // Ease zoom-out slowly; on braking the camera moves forward more promptly.
   const backRate=brakePressure>0.04?4.8:1.35;
   chaseBackCurrent+=(backTarget-chaseBackCurrent)*(1-Math.exp(-dt*backRate));
   chaseHeightCurrent+=(heightTarget-chaseHeightCurrent)*(1-Math.exp(-dt*2.0));
   chaseLookAheadCurrent+=(lookAheadTarget-chaseLookAheadCurrent)*(1-Math.exp(-dt*(brakePressure>0.04?4.0:1.5)));
   const fovTarget=50+10*ramp-2.5*brakePush;
   chaseFovCurrent+=(fovTarget-chaseFovCurrent)*(1-Math.exp(-dt*1.65));
   const groundY=(['shanghai','silverstone','spa','singapore'].includes(selectedTrack))?playerRideY:trackGroundY(carX,carZ);
   let cameraBack=chaseBackCurrent;
   if(trackWallGrids[selectedTrack]){
     for(let d=1.8;d<=chaseBackCurrent;d+=.4){
       if(venueWallHit(selectedTrack,carX,carZ,carX-fx*d,carZ-fz*d)){cameraBack=Math.max(1.8,d-.5);break;}
     }
   }
   const slope=selectedTrack==='spa'?Math.tan(playerKerbSusp.pitch):0;
   const cameraGround=trackGroundY(carX-fx*cameraBack,carZ-fz*cameraBack);
   const cameraY=Math.max(groundY+chaseHeightCurrent-cameraBack*slope,cameraGround+.55);
   eye=[carX-fx*cameraBack,cameraY+playerVisualSuspension.heave*.14,carZ-fz*cameraBack];
   center=[carX+fx*chaseLookAheadCurrent,.48+groundY,carZ+fz*chaseLookAheadCurrent];
   fovDegrees=chaseFovCurrent;
 }else if(cameraMode==='cockpit'||cameraMode==='halo'||cameraMode==='frontwing'||cameraMode==='rear'){
   const fx=Math.cos(carHeading),fz=Math.sin(carHeading);
   const gy=(['shanghai','silverstone','spa','singapore'].includes(selectedTrack))?playerRideY:trackGroundY(carX,carZ);
   const bump=playerVisualSuspension.heave*.18;
   // World-space mounts: share terrain elevation with the car, not with the orbit camera.
   if(cameraMode==='cockpit'||cameraMode==='halo'){
     const mounted=cockpitCamera(playerBodyFrame(),cameraMode);
     if(mounted){
       eye=mounted.eye;center=mounted.center;cameraUp=mounted.up;
       fovDegrees=mounted.fov;nearPlane=mounted.near;
     }else{
       eye=[carX+fx*.45,gy+1.85+bump,carZ+fz*.45];
       center=[eye[0]+fx*22,eye[1]-.07,eye[2]+fz*22];fovDegrees=66;
     }
   }else if(cameraMode==='frontwing'){
     eye=[carX+fx*2.25,gy+.40+bump,carZ+fz*2.25];
     center=[eye[0]+fx*24,eye[1]-.04,eye[2]+fz*24];fovDegrees=76;
   }else{
     eye=[carX-fx*1.2,gy+1.36+bump,carZ-fz*1.2];
     center=[eye[0]-fx*25,eye[1]-.08,eye[2]-fz*25];fovDegrees=75;
   }
 }else{
   const cp=Math.cos(pitch),sp=Math.sin(pitch);
   const target=(cameraMode==='track')?(selectedTrack==='spa'?[0,15,-420]:(selectedTrack==='singapore'?[0,45,0]:(selectedTrack==='silverstone'?[0,.12,0]:(selectedTrack==='shanghai'?[70,.12,-300]:[0,.12,27])))):[carX,((['shanghai','silverstone','spa','singapore'].includes(selectedTrack))?playerRideY:trackGroundY(carX,carZ))+.65,carZ];
   eye=[target[0]+distance*cp*Math.sin(yaw),target[1]+distance*sp,target[2]+distance*cp*Math.cos(yaw)];
   center=target;
 }
 const view=lookAt(eye,center,cameraUp),proj=perspective(fovDegrees*rad,aspect,nearPlane,(['silverstone','shanghai','spa','singapore'].includes(selectedTrack))?12000:650),mvp=multiply(proj,view);
 activeCarCameraPosition=eye;
 renderAtmosphericSky(eye,center,aspect,fovDegrees,cameraUp);
 renderSunDisc(mvp,eye,h);gl.useProgram(prog);
 gl.uniformMatrix4fv(locMvp,false,mvp);
 gl.uniformMatrix4fv(locModel,false,IDENTITY);gl.uniform1f(locOpacity,1);
 renderShanghaiOutskirts(mvp,eye); // decorative skyline sits beyond authored buildings, before track and shadows
 const shadowStencilReady=cachedStencilBits>=2;
 // Keep the legacy single-pass receivers on Oval/Silverstone. Shanghai has
 // separate ground-only geometry so vertical walls never receive shadows.
 if(shadowStencilReady&&selectedTrack!=='shanghai'){
  gl.enable(gl.STENCIL_TEST);gl.stencilMask(255);
  gl.stencilFunc(gl.ALWAYS,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);
 }
 if(selectedTrack==='silverstone')renderOriginalSilverstone(mvp);else if(selectedTrack==='spa'||selectedTrack==='singapore')renderImportedCircuit(selectedTrack,mvp);else{bindMesh(trackBuffers);gl.drawArrays(gl.TRIANGLES,0,trackBuffers.count);}
 if(shadowStencilReady&&selectedTrack!=='shanghai')gl.disable(gl.STENCIL_TEST);
 if(shadowStencilReady&&selectedTrack==='shanghai'&&shanghaiGroundShadowReceiver){
  // Invisible stencil-only pass, depth tested against the already drawn scene:
  // ground behind a visible barrier cannot overwrite that barrier's silhouette.
  gl.enable(gl.STENCIL_TEST);gl.stencilMask(1);
  gl.stencilFunc(gl.ALWAYS,1,1);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);
  gl.colorMask(false,false,false,false);gl.depthMask(false);
  gl.depthFunc(gl.LEQUAL);
  gl.bindBuffer(gl.ARRAY_BUFFER,shanghaiGroundShadowReceiver.pb);
  gl.enableVertexAttribArray(locPos);gl.vertexAttribPointer(locPos,3,gl.FLOAT,false,0,0);
  // Same program, but color output is masked. Keep colour attrib disabled.
  gl.disableVertexAttribArray(locCol);gl.vertexAttrib3f(locCol,1,1,1);
  gl.drawArrays(gl.TRIANGLES,0,shanghaiGroundShadowReceiver.count);
  gl.colorMask(true,true,true,true);gl.depthMask(true);
  gl.disable(gl.STENCIL_TEST);gl.stencilMask(255);
 }
 renderRealCarShadows(mvp);
 drawNpcCar(mvp);
  if(!['frontwing','rear'].includes(cameraMode)&&!drawCustomCar(mvp)){
   const carM=carModelMatrix(carX,.077+((['shanghai','silverstone','spa','singapore'].includes(selectedTrack))?playerRideY:trackGroundY(carX,carZ)),carZ,carHeading);
   gl.uniformMatrix4fv(locModel,false,carM);bindMesh(carBuffers);gl.drawArrays(gl.TRIANGLES,0,carBuffers.count);
   bindMesh(wheelBuffers);
   const wheelSet=[{x:-1.337,z:-.96,front:false},{x:-1.337,z:.96,front:false},{x:1.093,z:-.96,front:true},{x:1.093,z:.96,front:true}];
   for(const wheel of wheelSet){let wm=multiply(carM,translationMatrix(wheel.x,.34,wheel.z));if(wheel.front)wm=multiply(wm,carModelMatrix(0,0,0,frontWheelSteer));wm=multiply(wm,rotationZMatrix(wheelSpin));gl.uniformMatrix4fv(locModel,false,wm);gl.drawArrays(gl.TRIANGLES,0,wheelBuffers.count);}
 }
 requestAnimationFrame(loop);
}
function clearDriveKeys(){for(const k in keys)keys[k]=false;}
let countdownActive=false, lightsStartedAt=0;
const START_LIGHT_STEP_SECONDS=0.65, START_LIGHTS_OUT_SECONDS=4.15;
let practiceConfigured=false;
let timingActive=false, sessionStartedAt=0, lapStartedAt=0, lapTimes=[], lastLapDeltaMs=null, previousLapProgress=null, lastLapCrossAt=0;
let currentPlayerLapSamples=[],lastPlayerLapSamples=[],npcLapReplay=null,npcReplayStartAt=0,npcReplayDurationMs=0;
let npcGhostActive=false,bestLapMs=Infinity,bestLapSamples=[],playerLapDistance=0;
let lastDriveX=null,lastDriveZ=null;
const MIN_GHOST_LAP_DISTANCE={spa:650,silverstone:450,singapore:350,shanghai:200,oval:65};
function samplePlayerForGhost(now){
 if(!timingActive)return;
 if(lastDriveX!==null){const delta=Math.hypot(carX-lastDriveX,carZ-lastDriveZ);
  if(delta<30)playerLapDistance+=delta;}
 lastDriveX=carX;lastDriveZ=carZ;
 const elapsed=now-lapStartedAt,tail=currentPlayerLapSamples[currentPlayerLapSamples.length-1];
 if(!tail||elapsed-tail.t>=50)currentPlayerLapSamples.push(makePlayerLapSample(elapsed));
}
function spawnBestLapGhost(now){
 if(!bestLapSamples.length)return;
 npcLapReplay=bestLapSamples;npcReplayDurationMs=bestLapMs;npcReplayStartAt=now;
 npcGhostActive=true;
 const ghostLabel=document.getElementById('ghostState');if(ghostLabel)ghostLabel.textContent='GHOST: BEST '+formatStopwatch(bestLapMs)+' · replaying';
 const first=bestLapSamples[0];npcX=first.x;npcZ=first.z;
 npcHeading=first.heading;npcWheelSpin=first.wheelSpin||0;
 npcFrontWheelSteer=first.frontWheelSteer||0;npcSpeedKmh=first.speedKmh||0;
 npcRideY=rideTargetY(npcX,npcZ);
}
function finishRecordedPlayerLap(now){
 const ms=now-lapStartedAt;
 // A start-grid-to-finish shortcut is not a full lap: restart recording at the line.
 const enough=playerLapDistance>=(MIN_GHOST_LAP_DISTANCE[selectedTrack]||100)&&ms>8000;
 if(enough){
  const samples=currentPlayerLapSamples.slice();samples.push(makePlayerLapSample(ms));
  if(samples.length>=3 && ms<bestLapMs){
   bestLapMs=ms;bestLapSamples=samples;
   spawnBestLapGhost(now);
  }
  lastLapDeltaMs=lapTimes.length?ms-lapTimes[lapTimes.length-1]:null;
  lapTimes.push(ms);renderLapHistory();
  console.info('COMPLETED LAP',selectedTrack,'lap',lapTimes.length,'best',Math.round(bestLapMs),'ghost active',npcGhostActive);
 }else console.info('Crossed start/finish; waiting for a complete lap',selectedTrack,Math.round(playerLapDistance));
 lapStartedAt=now;lastLapCrossAt=now;playerLapDistance=0;
 currentPlayerLapSamples=[makePlayerLapSample(0)];lastDriveX=carX;lastDriveZ=carZ;
}

let gamePaused=false, resumeCountdownActive=false, resumeCountdownStartedAt=0, pauseStartedAt=0;
const pauseOverlay=document.createElement('div');
pauseOverlay.style.cssText='position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(3,8,13,.64);color:#f5fbff;font-family:Arial,Helvetica,sans-serif;text-align:center;pointer-events:auto;';
pauseOverlay.innerHTML='<div style="padding:30px 48px;border:1px solid #48606e;border-radius:18px;background:rgba(8,18,27,.96);box-shadow:0 18px 70px #0008"><div id="pauseTitle" style="font-size:38px;font-weight:900;letter-spacing:4px">PAUSED</div><div id="pauseSubtitle" style="margin-top:12px;font-size:14px;letter-spacing:1px;color:#9feaf0">Press SPACE to resume</div></div>';
pauseOverlay.id='pauseOverlay';
const pauseActions=document.createElement('div');pauseActions.id='pauseActions';
pauseActions.innerHTML='<button id="pauseQuit">QUIT</button><button id="pauseTrack">VIEW TRACK</button><button id="pauseSettings">SETTINGS</button>';
pauseOverlay.firstElementChild.appendChild(pauseActions);
document.body.appendChild(pauseOverlay);
let pausePage='menu',pauseCameraMode='chase';
const pauseBack=document.createElement('button');pauseBack.id='pauseBack';pauseBack.textContent='BACK TO PAUSE MENU · ESC';pauseBack.hidden=true;document.body.appendChild(pauseBack);
function showPauseMenu(){
 pausePage='menu';pauseBack.hidden=true;closeSettings();cameraMode=pauseCameraMode;syncCameraChoice();
 showPauseOverlay('PAUSED','ESC / SPACE · resume with a 3-second countdown');
}
function resumePractice(){
 pauseBack.hidden=true;closeSettings();cameraMode=pauseCameraMode;syncCameraChoice();
 resumeCountdownActive=true;resumeCountdownStartedAt=performance.now();
 showPauseOverlay('RESUMING IN 3','Wait for the 3-second countdown');
}
pauseBack.addEventListener('click',showPauseMenu);
document.getElementById('pauseTrack').addEventListener('click',()=>{pausePage='track';hidePauseOverlay();pauseBack.hidden=false;fullTrack();});
document.getElementById('pauseSettings').addEventListener('click',()=>{pausePage='settings';hidePauseOverlay();pauseBack.hidden=false;settingsPanel.hidden=false;settingsToggle.setAttribute('aria-expanded','true');});
document.getElementById('pauseQuit').addEventListener('click',()=>{
 gameStarted=false;practiceConfigured=false;gamePaused=false;resumeCountdownActive=false;countdownActive=false;pauseStartedAt=0;
 clearDriveKeys();clearPracticeTiming();hidePauseOverlay();pauseBack.hidden=true;closeSettings();
 document.getElementById('startLights').classList.add('hidden');document.getElementById('practiceTiming').classList.add('hidden');
 document.getElementById('teamScreen').classList.add('hidden');document.getElementById('trackScreen').classList.remove('hidden');fullTrack();
});
function showPauseOverlay(title,subtitle){document.getElementById('pauseTitle').textContent=title;document.getElementById('pauseSubtitle').textContent=subtitle;pauseActions.hidden=resumeCountdownActive;pauseOverlay.style.display='flex';}
function hidePauseOverlay(){pauseOverlay.style.display='none';}
function makePlayerLapSample(t){
 const kmh=carSpeed<0?Math.abs(carSpeed)*3.6:(Math.abs(carSpeed)/MAX_WORLD_SPEED)*MAX_DASH_SPEED;
 return {t,x:carX,z:carZ,heading:carHeading,travelHeading,wheelSpin,frontWheelSteer,speedKmh:kmh};
}
function setLightCount(count){document.querySelectorAll('#startLights .light-lamp').forEach((lamp,i)=>lamp.classList.toggle('lit',i<count));}
function formatStopwatch(ms){
 const safe=Math.max(0,Math.floor(ms||0)),minutes=Math.floor(safe/60000),seconds=Math.floor(safe/1000)%60,millis=safe%1000;
 return String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0')+'.'+String(millis).padStart(3,'0');
}
function clearPracticeTiming(){
 timingActive=false;sessionStartedAt=0;lapStartedAt=0;lapTimes=[];lastLapDeltaMs=null;previousLapProgress=null;lastLapCrossAt=0;singaporePreviousTimingPosition=null;spaPreviousTimingPosition=null;silverstonePreviousTimingPosition=null;
 // Reset every transient effect and the recorded lap ghost along with the lap-time table.
 currentPlayerLapSamples=[];lastPlayerLapSamples=[];npcLapReplay=null;npcReplayStartAt=0;npcReplayDurationMs=0;
 npcGhostActive=false;bestLapMs=Infinity;bestLapSamples=[];playerLapDistance=0;lastDriveX=null;lastDriveZ=null;
 const ghostLabel=document.getElementById('ghostState');if(ghostLabel)ghostLabel.textContent='GHOST: waiting for your first valid lap';
 renderLapHistory();updatePracticeTimingDisplay(0);
}
function updatePracticeTimingDisplay(now){
 const totalEl=document.getElementById('sessionTime'),currentEl=document.getElementById('currentLapTime'),lastEl=document.getElementById('lastLapTime'),deltaEl=document.getElementById('lapDelta'),lapNoEl=document.getElementById('timingLapNumber');
 if(!totalEl)return;
 const total=timingActive?now-sessionStartedAt:0,current=timingActive?now-lapStartedAt:0;
 totalEl.textContent=formatStopwatch(total);currentEl.textContent=formatStopwatch(current);
 lapNoEl.textContent='LAP '+(lapTimes.length+1);
 lastEl.textContent=lapTimes.length?formatStopwatch(lapTimes[lapTimes.length-1]):'—';
 deltaEl.classList.remove('faster','slower');
 if(lastLapDeltaMs===null){deltaEl.textContent='—';}
 else {deltaEl.textContent=(lastLapDeltaMs>0?'+':'−')+formatStopwatch(Math.abs(lastLapDeltaMs));deltaEl.classList.add(lastLapDeltaMs>0?'slower':'faster');}
}
function renderLapHistory(){
 const box=document.getElementById('lapHistory');if(!box)return;
 if(!lapTimes.length){box.innerHTML='<div class="lap-empty">No completed laps yet</div>';return;}
 const rows=lapTimes.map((time,i)=>{
   const delta=i===0?null:time-lapTimes[i-1];
   let deltaText='—',cls='';
   if(delta!==null){deltaText=(delta>0?'+':'−')+formatStopwatch(Math.abs(delta));cls=delta>0?'slower':'faster';}
   return '<div class="lap-history-row"><span>LAP '+String(i+1).padStart(2,'0')+'</span><span class="lap-time">'+formatStopwatch(time)+'</span><span class="lap-delta '+cls+'">'+deltaText+'</span></div>';
 }).join('');
 box.innerHTML=rows;box.scrollTop=box.scrollHeight;
}
function ovalLapProgress(x,z){
 // Project to the closest of the oval's two straights and two semicircles.
 let bestDist=Infinity,bestRaw=0;
 function offer(px,pz,raw){const d=(x-px)*(x-px)+(z-pz)*(z-pz);if(d<bestDist){bestDist=d;bestRaw=raw;}}
 const tb=clamp(x+L,0,SW);offer(-L+tb,0,tb);
 const ar=clamp(Math.atan2(z-R,x-L),-Math.PI/2,Math.PI/2);offer(L+R*Math.cos(ar),R+R*Math.sin(ar),SW+(ar+Math.PI/2)*R);
 const tt=clamp(L-x,0,SW);offer(L-tt,2*R,SW+Math.PI*R+tt);
 let al=Math.atan2(z-R,x+L);if(al<Math.PI/2)al+=Math.PI*2;al=clamp(al,Math.PI/2,Math.PI*1.5);offer(-L+R*Math.cos(al),R+R*Math.sin(al),2*SW+Math.PI*R+(al-Math.PI/2)*R);
 return ((bestRaw-SW/2+TOTAL)%TOTAL+TOTAL)%TOTAL;
}
function playerLapProgress(){
 if(selectedTrack==='silverstone'){
   const n=silverstoneNearest(carX,carZ);
   return ((n.index*SILVERSTONE_PATH_STEP)%SILVERSTONE_LOOP_LENGTH+SILVERSTONE_LOOP_LENGTH)%SILVERSTONE_LOOP_LENGTH;
 }
 if(selectedTrack==='shanghai'){
   const n=shanghaiNearest(carX,carZ);
   return ((SHANGHAI_LOOP_LENGTH-n.progressIndex*SHANGHAI_PATH_STEP)%SHANGHAI_LOOP_LENGTH+SHANGHAI_LOOP_LENGTH)%SHANGHAI_LOOP_LENGTH;
 }
 return ovalLapProgress(carX,carZ);
}
 // Singapore .020 is an authored finish EMPTY, not grid slot 20. Its quaternion
 // determines the infinite timing plane, and its local X axis is the cross-track
 // width. The marker is world-space and must not inherit the GLB mesh's 2.1 scale.
 const SINGAPORE_FINISH_WIDTH=80.0; // 40 units to each side of the center
 const SINGAPORE_FINISH_GEOMETRY=(()=>{
   const f=SINGAPORE_SEMANTIC_META.finish;
   const q=f.rotation||[0,0,0,1];
   const tangentX=1-2*(q[1]*q[1]+q[2]*q[2]);
   const tangentZ=2*(q[0]*q[2]-q[3]*q[1]);
   let nx=-tangentZ,nz=tangentX; // perpendicular to the marker's local X
   const p0=markedTrackGrid('singapore',0).position;
   const dx=f.position[0]-p0[0],dz=f.position[2]-p0[2];
   if(dx*nx+dz*nz<0){nx=-nx;nz=-nz;}
   const L=Math.hypot(nx,nz)||1;nx/=L;nz/=L;
   return {x:f.position[0],z:f.position[2],nx,nz,tx:-nz,tz:nx,halfWidth:SINGAPORE_FINISH_WIDTH/2};
 })();
 let singaporePreviousTimingPosition=null;
 function singaporeFinishCrossed(start,end){
   const g=SINGAPORE_FINISH_GEOMETRY;
   const a=(start.x-g.x)*g.nx+(start.z-g.z)*g.nz;
   const b=(end.x-g.x)*g.nx+(end.z-g.z)*g.nz;
   // Count an actual crossing in EITHER direction; the previous sign-only logic
   // silently rejected valid laps when the model's marker was reversed.
   if(!((a<0&&b>=0)||(a>0&&b<=0))||Math.abs(b-a)<0.005)return false;
   const fraction=-a/(b-a);
   const hitX=start.x+(end.x-start.x)*fraction;
   const hitZ=start.z+(end.z-start.z)*fraction;
   const lateral=(hitX-g.x)*g.tx+(hitZ-g.z)*g.tz;
   return Math.abs(lateral)<=g.halfWidth;
 }
 // Spa marker GRID_000 through GRID_025 and FINISH_LINE__empty.026 are all authored
 // in the same exported GLB space. Derive the finish plane from the grid straight,
 // not the legacy oval raceline (the old source of incorrect / missing timing).
 const SPA_FINISH_GEOMETRY=(()=>{
   const p=SPA_SEMANTIC_META.finish.position;
   const a=markedTrackGrid('spa',0).position,b=markedTrackGrid('spa',2).position;
   const len=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
   const nx=(b[0]-a[0])/len,nz=(b[2]-a[2])/len;
   return {x:p[0],z:p[2],nx,nz,tx:-nz,tz:nx,halfWidth:30};
 })();
 let spaPreviousTimingPosition=null;
 function spaFinishCrossed(start,end){
   const g=SPA_FINISH_GEOMETRY;
   const a=(start.x-g.x)*g.nx+(start.z-g.z)*g.nz;
   const b=(end.x-g.x)*g.nx+(end.z-g.z)*g.nz;
   if(!((a<0&&b>=0)||(a>0&&b<=0))||Math.abs(b-a)<0.005)return false;
   const t=-a/(b-a),x=start.x+(end.x-start.x)*t,z=start.z+(end.z-start.z)*t;
   return Math.abs((x-g.x)*g.tx+(z-g.z)*g.tz)<=g.halfWidth;
 }
 function updateSpaTiming(now){
   const current={x:carX,z:carZ},last=spaPreviousTimingPosition;
   spaPreviousTimingPosition=current;
   if(last && now-lastLapCrossAt>4000 && spaFinishCrossed(last,current))finishRecordedPlayerLap(now);
 updatePracticeTimingDisplay(now);
 }
 function updateSingaporeTiming(now){
   const current={x:carX,z:carZ};
   const last=singaporePreviousTimingPosition;
   singaporePreviousTimingPosition=current;
   if(last && now-lastLapCrossAt>4000 && singaporeFinishCrossed(last,current))finishRecordedPlayerLap(now);
 updatePracticeTimingDisplay(now);
 }
// Silverstone 2024 has no authored FINISH empty. Define a provisional cross-track
// plane on the visible pit straight, ahead of the verified player grid. Unlike the
// obsolete Silverstone spline it uses the CURRENT original-model start geometry.
const SILVERSTONE_FINISH_GEOMETRY=(()=>{
 const h=2.19+Math.PI,forward=73,left=-3.5;
 const sx=-423+Math.cos(h)*forward-Math.sin(h)*left;
 const sz=295+Math.sin(h)*forward+Math.cos(h)*left;
 return {x:sx+Math.cos(h)*42,z:sz+Math.sin(h)*42,nx:Math.cos(h),nz:Math.sin(h),tx:-Math.sin(h),tz:Math.cos(h),halfWidth:20};
})();
let silverstonePreviousTimingPosition=null;
function silverstoneFinishCrossed(start,end){
 const g=SILVERSTONE_FINISH_GEOMETRY;
 const before=(start.x-g.x)*g.nx+(start.z-g.z)*g.nz;
 const after=(end.x-g.x)*g.nx+(end.z-g.z)*g.nz;
 if(!(before<0&&after>=0)||after-before<.005)return false;
 const t=-before/(after-before),x=start.x+(end.x-start.x)*t,z=start.z+(end.z-start.z)*t;
 return Math.abs((x-g.x)*g.tx+(z-g.z)*g.tz)<=g.halfWidth;
}
function updateSilverstoneTiming(now){
 const p={x:carX,z:carZ},last=silverstonePreviousTimingPosition;
 silverstonePreviousTimingPosition=p;
 if(last && now-lastLapCrossAt>4000 && silverstoneFinishCrossed(last,p))finishRecordedPlayerLap(now);
 updatePracticeTimingDisplay(now);
}
function updatePracticeTiming(now){
 if(!timingActive)return;
 if(selectedTrack==='spa'){updateSpaTiming(now);return;}
 if(selectedTrack==='silverstone'){updateSilverstoneTiming(now);return;}
 if(selectedTrack==='singapore'){updateSingaporeTiming(now);return;}
 const len=selectedTrack==='shanghai'?SHANGHAI_LOOP_LENGTH:TOTAL;
 const progress=playerLapProgress();
 const crossing=previousLapProgress!==null&&carSpeed>.25&&previousLapProgress>len*.84&&progress<len*.16&&now-lastLapCrossAt>4000;
 if(crossing)finishRecordedPlayerLap(now);
 previousLapProgress=progress;
 updatePracticeTimingDisplay(now);
}

function startPracticeCountdown(resetCars){
 gamePaused=false;resumeCountdownActive=false;resumeCountdownStartedAt=0;pauseStartedAt=0;hidePauseOverlay();
 if(resetCars){resetCar();resetNpcToGrid();}
 clearDriveKeys();clearPracticeTiming();
 document.getElementById('practiceTiming').classList.remove('hidden');
 const lights=document.getElementById('startLights');lights.classList.remove('hidden');setLightCount(1);
 lightsStartedAt=performance.now();countdownActive=true;gameStarted=false;
}
function beginPracticeStart(difficulty){
 const cfg=NPC_DIFFICULTIES[difficulty||selectedNpcDifficulty]||NPC_DIFFICULTIES.normal;
 selectedNpcDifficulty=difficulty||selectedNpcDifficulty;
 selectedPlayerTeam=document.getElementById('playerTeamSelect').value||'mclaren';
 selectedNpcTeam=document.getElementById('npcTeamSelect').value||'redbull';
 NPC_STRAIGHT_KMH=cfg.straight;NPC_CORNER_KMH=cfg.corner;NPC_BRAKE_ZONE=cfg.brakeZone;
 practiceConfigured=true;
 cameraMode='chase';chase();
 document.getElementById('teamScreen').classList.add('hidden');
 document.querySelector('.sub').textContent='PLAYER: '+teamDisplayName(selectedPlayerTeam)+' · GHOST: AFTER YOUR FIRST VALID LAP';
 startPracticeCountdown(true);
}
function updateStartLights(now){
 if(!countdownActive)return;
 const elapsed=Math.max(0,(now-lightsStartedAt)/1000);
 const count=Math.min(5,1+Math.floor(elapsed/START_LIGHT_STEP_SECONDS));
 setLightCount(count);
 if(elapsed>=START_LIGHTS_OUT_SECONDS){
   setLightCount(0);document.getElementById('startLights').classList.add('hidden');
   countdownActive=false;gameStarted=true;clearDriveKeys();
   timingActive=true;sessionStartedAt=now;lapStartedAt=now;previousLapProgress=(selectedTrack==='singapore'||selectedTrack==='spa')?null:playerLapProgress();lastLapCrossAt=now;
   singaporePreviousTimingPosition=selectedTrack==='singapore'?{x:carX,z:carZ}:null;
   spaPreviousTimingPosition=selectedTrack==='spa'?{x:carX,z:carZ}:null;
   silverstonePreviousTimingPosition=selectedTrack==='silverstone'?{x:carX,z:carZ}:null;
   currentPlayerLapSamples=[makePlayerLapSample(0)];
   updatePracticeTimingDisplay(now);
 }
}
function updateResumeCountdown(now){
 if(!resumeCountdownActive)return;
 const elapsed=Math.max(0,(now-resumeCountdownStartedAt)/1000);
 if(elapsed>=3){
   const pausedFor=Math.max(0,now-pauseStartedAt);
   sessionStartedAt+=pausedFor;lapStartedAt+=pausedFor;lastLapCrossAt+=pausedFor;
   if(npcLapReplay&&npcReplayStartAt)npcReplayStartAt+=pausedFor;
   resumeCountdownActive=false;gamePaused=false;pauseStartedAt=0;clearDriveKeys();hidePauseOverlay();
   updatePracticeTimingDisplay(now);
 }else{
   const remaining=Math.max(1,3-Math.floor(elapsed));
   showPauseOverlay('RESUMING IN '+remaining,'SPACE · 3-second restart countdown');
 }
}
coreModelLoadPromise=Promise.all([loadCustomCar(),loadNpcCar(),loadFerrariCar(),loadMercedesCar()]);
const silverstoneSelectButton=document.getElementById('selectSilverstoneTrack');if(silverstoneSelectButton){silverstoneSelectButton.disabled=true;const action=silverstoneSelectButton.querySelector('.mode-action');if(action)action.textContent='LOADING TRACK MODEL…';}
loadSilverstoneTrack();
loadShanghaiTrack();

let gameAudioContext,gameAudioEngine;
const audioControls=document.createElement('div');
audioControls.className='settings-section';
audioControls.innerHTML='<label>ENGINE SOUND · 引擎声浪<input id="engineAudioFile" type="file" accept="video/*,audio/*"></label><p id="engineAudioStatus">选择实验台用的约 75 秒录音，即可开启声浪</p><label>音量 <input id="engineAudioVolume" type="range" min="0" max="1" step="0.01" value="0.3"></label>';
const audioSetup=document.createElement('div');audioSetup.id='audioSetup';audioSetup.setAttribute('role','dialog');audioSetup.setAttribute('aria-modal','true');audioSetup.setAttribute('aria-labelledby','audioSetupTitle');
audioSetup.innerHTML='<div class="audio-setup-card"><h1 id="audioSetupTitle">开启引擎声浪</h1><p>选择你在声浪实验台使用的原视频或音频。读取完成后，点“进入游戏”。</p><div id="audioSetupControls"></div><div class="audio-setup-actions"><button id="audioSetupContinue" disabled>进入游戏</button><button id="audioSetupSkip">暂时跳过</button></div></div>';
document.body.append(audioSetup);document.getElementById('audioSetupControls').append(audioControls);
document.getElementById('audioSetupContinue').onclick=document.getElementById('audioSetupSkip').onclick=()=>{audioSetup.hidden=true;document.getElementById('practiceMode').focus();};
for(const parent of [document.getElementById('settingsPanel'),document.querySelector('#modeScreen .mode-panel')]){const open=document.createElement('button');open.textContent='ENGINE SOUND · 引擎声浪';open.onclick=()=>{audioSetup.hidden=false;document.getElementById('engineAudioFile').focus();};parent.append(open);}
const audioInput=document.getElementById('engineAudioFile'),audioStatus=document.getElementById('engineAudioStatus');
audioInput.onchange=async()=>{const file=audioInput.files[0];if(!file)return;audioInput.disabled=true;
 try{gameAudioContext??=new AudioContext();await gameAudioContext.resume();audioStatus.textContent='正在读取引擎声浪…';
 const decoded=await gameAudioContext.decodeAudioData(await file.arrayBuffer());if(Math.abs(decoded.duration-75.392)>.2)throw Error('请选择实验台用的约 75 秒原录音');
 gameAudioEngine?.dispose();gameAudioEngine=new MarkedAudio(gameAudioContext,decoded,APPROVED_AUDIO.banks);audioStatus.textContent='已载入你确认的标记 · 换挡计时与调试台共用';document.getElementById('audioSetupContinue').disabled=false;
 }catch(error){audioStatus.textContent=error.message||'无法读取音轨，请尝试 MP3 或 M4A';}finally{audioInput.disabled=false;}};
function updateGameAudio(dt){if(!gameAudioEngine)return;const active=gameStarted&&!gamePaused&&!resumeCountdownActive&&!document.hidden&&audioSetup.hidden;
 if(!gameStarted)gameAudioEngine.reset();
 gameAudioEngine.update({active,throttle:!!(keys.w||keys.arrowup),brake:!!(keys.s||keys.arrowdown),auto:true,volume:Number(document.getElementById('engineAudioVolume').value)});
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&gameAudioEngine)gameAudioEngine.update({active:false});});
document.getElementById('resetCar').addEventListener('click',()=>gameAudioEngine?.reset());
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r'&&practiceConfigured&&!gamePaused&&!resumeCountdownActive)gameAudioEngine?.reset();});

let previous=performance.now();function loop(t){const dt=Math.min(.04,Math.max(0,(t-previous)/1000));previous=t;updateStartLights(t);updateResumeCountdown(t);if(gameStarted&&!gamePaused&&!resumeCountdownActive){update(dt);samplePlayerForGhost(t);updateNpc(dt);updateRideHeights(dt);}updateGameAudio(dt);draw(t,dt);updateFrameRateMeter(t);}requestAnimationFrame(loop);

 const settingsToggle=document.getElementById('settingsToggle'),settingsPanel=document.getElementById('settingsPanel');
 function closeSettings(){settingsPanel.hidden=true;settingsToggle.setAttribute('aria-expanded','false');}
 settingsToggle.addEventListener('click',()=>{settingsPanel.hidden=!settingsPanel.hidden;settingsToggle.setAttribute('aria-expanded',String(!settingsPanel.hidden));});
 document.getElementById('settingsClose').addEventListener('click',()=>{if(gamePaused&&pausePage==='settings')showPauseMenu();else closeSettings();});
 settingsPanel.addEventListener('click',e=>e.stopPropagation());
 document.addEventListener('pointerdown',e=>{if(!settingsPanel.hidden&&!settingsPanel.contains(e.target)&&e.target!==settingsToggle)closeSettings();});
 // Escape is handled by the practice pause controller above.
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!gameStarted)closeSettings();});
 document.querySelectorAll('.camera-choice').forEach(btn=>btn.addEventListener('click',()=>{setCameraView(btn.dataset.view);closeSettings();}));
 syncCameraChoice();
 const helpToggle=document.getElementById('helpToggle'),gameInfo=document.getElementById('gameInfo');
 helpToggle.addEventListener('click',()=>{const collapsed=gameInfo.classList.toggle('help-collapsed');helpToggle.setAttribute('aria-expanded',String(!collapsed));helpToggle.textContent=collapsed?'ⓘ HELP':'✕ CLOSE HELP';});

document.getElementById('chaseView').addEventListener('click',chase);
document.getElementById('topView').addEventListener('click',orbitCar);
document.getElementById('fullTrackView').addEventListener('click',fullTrack);
document.getElementById('resetView').addEventListener('click',resetOrbit);
document.getElementById('ferrariUvToggle').addEventListener('click',()=>{ferrariUvMode=(ferrariUvMode+1)%4;document.getElementById('ferrariUvToggle').textContent='FERRARI UV: '+ferrariUvModeNames[ferrariUvMode];});
// Render-resolution quality control: GPU pixel workload only, no simulation or asset changes.
const renderResolutionOptions=[1,0.75,0.5,'auto'];
let renderResolutionIndex=0,renderResolutionScale=1;
const fpsReadout=document.createElement('span');
fpsReadout.id='fpsStat';fpsReadout.style.cssText='font:700 11px Arial;color:#9dd2dc;align-self:center;padding:8px';
fpsReadout.textContent='FPS: --';
document.getElementById('renderQuality').insertAdjacentElement('afterend',fpsReadout);
let fpsSampleStart=0,fpsSampleFrames=0,lastAutoQualityUpdate=0,measuredFps=60;
function cycleRenderResolution(){
 renderResolutionIndex=(renderResolutionIndex+1)%renderResolutionOptions.length;
 if(renderResolutionIndex===3){
   // Start heavy original-GLB circuits at 75%; improve or reduce only after measured performance stabilizes.
   renderResolutionScale=['spa','singapore','silverstone'].includes(selectedTrack)?0.75:1.0;
   lastAutoQualityUpdate=performance.now();
 }else renderResolutionScale=renderResolutionOptions[renderResolutionIndex];
 document.getElementById('renderQuality').textContent=renderResolutionIndex===3?'RES: AUTO ('+Math.round(renderResolutionScale*100)+'%)':'RES: '+Math.round(renderResolutionScale*100)+'%';
}
function updateFrameRateMeter(t){
 if(!fpsSampleStart){fpsSampleStart=t;return;}
 fpsSampleFrames++;
 const elapsed=t-fpsSampleStart;
 if(elapsed<1200)return;
 measuredFps=fpsSampleFrames*1000/elapsed;
 fpsSampleFrames=0;fpsSampleStart=t;
 fpsReadout.textContent='FPS: '+Math.round(measuredFps);
 if(renderResolutionIndex===3 && gameStarted && !gamePaused && t-lastAutoQualityUpdate>=5000){
   const steps=[0.50,0.75,1.0];let idx=steps.findIndex(v=>Math.abs(v-renderResolutionScale)<0.01);
   if(idx<0)idx=1;
   if(measuredFps<40&&idx>0)idx--;
   else if(measuredFps>56&&idx<steps.length-1)idx++;
   if(steps[idx]!==renderResolutionScale){
     renderResolutionScale=steps[idx];lastAutoQualityUpdate=t;
     document.getElementById('renderQuality').textContent='RES: AUTO ('+Math.round(renderResolutionScale*100)+'%)';
   }
 }
}
document.getElementById('renderQuality').addEventListener('click',cycleRenderResolution);
document.getElementById('resetCar').addEventListener('click',resetPracticeGrid);
canvas.addEventListener('pointerdown',e=>{if(cameraMode==='chase')resetOrbit();drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-lastX)*.006;pitch=Math.max(.12,Math.min(1.5,pitch+(e.clientY-lastY)*.005));lastX=e.clientX;lastY=e.clientY});
canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(cameraMode==='chase'){/* chase distance remains stable for consistent driving */}else distance=Math.max(4.5,Math.min((['silverstone','shanghai','spa','singapore'].includes(selectedTrack))?8500:260,distance*Math.exp(e.deltaY*.001)))},{passive:false});
window.addEventListener('resize',()=>{if(cameraMode==='orbit'&&!drag)fit();else if(cameraMode==='track'&&!drag)fitTrack();});
document.getElementById('practiceMode').addEventListener('click',()=>{
 document.getElementById('modeScreen').classList.add('hidden');
 document.getElementById('trackScreen').classList.remove('hidden');
 cameraMode='track';fullTrack();
});
function chooseCircuit(name){
 selectedTrack=name;
 if(['spa','singapore','silverstone'].includes(name)&&renderResolutionIndex===0){renderResolutionIndex=3;renderResolutionScale=0.75;lastAutoQualityUpdate=performance.now();document.getElementById('renderQuality').textContent='RES: AUTO (75%)';}
 trackBuffers=selectedTrack==='silverstone'?silverstoneTrackBuffers:(selectedTrack==='shanghai'?shanghaiTrackBuffers:ovalTrackBuffers); // imported tracks render through their own GLB batch path
 cameraMode='track';fullTrack();
 document.getElementById('trackScreen').classList.add('hidden');
 document.getElementById('teamScreen').classList.remove('hidden');
}
 document.getElementById('selectSpaTrack').addEventListener('click',async()=>{try{await loadImportedCircuit('spa');chooseCircuit('spa');}catch(e){alert('Spa model load failed: '+e.message);}});
 document.getElementById('selectSingaporeTrack').addEventListener('click',async()=>{try{await loadImportedCircuit('singapore');chooseCircuit('singapore');}catch(e){alert('Singapore model load failed: '+e.message);}});
 document.getElementById('selectOvalTrack').addEventListener('click',()=>chooseCircuit('oval'));
 document.getElementById('selectSilverstoneTrack').addEventListener('click',()=>{if(silverstoneTrackBuffers)chooseCircuit('silverstone');});
 document.getElementById('selectShanghaiTrack').addEventListener('click',()=>{if(shanghaiTrackBuffers)chooseCircuit('shanghai');});
 document.getElementById('backFromTrackSelect').addEventListener('click',()=>{
  document.getElementById('trackScreen').classList.add('hidden');
  document.getElementById('modeScreen').classList.remove('hidden');
 });
document.getElementById('confirmTeamSelection').addEventListener('click',async function(){
 const button=this,status=document.getElementById('teamLoadStatus');
 if(button.dataset.loading==='1')return;
 button.dataset.loading='1';button.disabled=true;
 try{
  const playerTeam=document.getElementById('playerTeamSelect').value||'mclaren';
  const npcTeam=document.getElementById('npcTeamSelect').value||'redbull';
  if(status)status.textContent='LOADING '+teamDisplayName(playerTeam)+' + '+teamDisplayName(npcTeam)+'…';
  await Promise.all([ensureTeamModelReady(playerTeam),ensureTeamModelReady(npcTeam)]);
  if(status)status.textContent='CARS READY · START LIGHTS NEXT';
  beginPracticeStart(selectedNpcDifficulty);
 }catch(err){if(status)status.textContent='CAR LOAD ERROR · '+err.message;console.error('Could not prepare selected grid:',err);}
 finally{button.disabled=false;delete button.dataset.loading;}
});
document.getElementById('backToDifficulty').addEventListener('click',()=>{
 document.getElementById('teamScreen').classList.add('hidden');
 document.getElementById('trackScreen').classList.remove('hidden');
});
document.getElementById('grandPrixMode').addEventListener('click',()=>{
 const card=document.getElementById('grandPrixMode');
 const tag=card.querySelector('.mode-tag');
 if(tag)tag.textContent='COMING SOON';
 card.style.borderColor='#8aa0aa';
 document.querySelector('.mode-footer').textContent='GRAND PRIX IS RESERVED FOR A FUTURE UPDATE · PRACTICE IS AVAILABLE NOW';
});
})();

}
