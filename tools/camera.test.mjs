import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carBodyFrame, cockpitCamera, bodyDirection, DRIVING_CAMERAS } from '../src/camera.mjs';

const teams = ['redbull','ferrari'];
const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-9, `${a} != ${b}`);
const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);

test('V cycles only the four driving views', () => {
  assert.deepEqual(DRIVING_CAMERAS, ['chase','cockpit','frontwing','rear']);
});

test('all team origins face forward, with the seat below the Halo', () => {
  for (const team of teams) for (const heading of [0, Math.PI/2, Math.PI, -.7]) {
    const frame = carBodyFrame(team, 100, 40, -70, heading, {pitch:0,roll:0});
    const c = cockpitCamera(frame);
    const seat = -.1;
    close(c.eye[0],100+seat*Math.cos(heading));
    close(c.eye[1],40+.72);
    close(c.eye[2],-70+seat*Math.sin(heading));
    const forward = c.center.map((x,i)=>x-c.eye[i]);
    assert.ok(dot(forward,[Math.cos(heading),0,Math.sin(heading)])>21);
    assert.ok(c.near<.1, 'Nearby steering wheel must survive near clipping, including Silverstone');
  }
});

test('camera remains rigid to the rendered chassis on slopes and road feedback', () => {
  for (const team of teams) for (const pitch of [-.32,0,.32]) for(const roll of [-.12,.12]) {
    const frame = carBodyFrame(team, -250, 64.3, 700, 1.2, {pitch,roll});
    const c=cockpitCamera(frame);
    const axes=[[1,0,0],[0,1,0],[0,0,1]].map(v=>bodyDirection(frame,v));
    const offset=c.eye.map((v,i)=>v-[frame.x,frame.y,frame.z][i]);
    close(dot(offset,axes[0]),-.1*frame.sign);
    close(dot(offset,axes[1]),.72-frame.originY);
    close(dot(offset,axes[2]),0);
    close(Math.hypot(...c.up),1);
    const direction=c.center.map((v,i)=>v-c.eye[i]);
    close(dot(direction,axes[0]),22*Math.cos(2*Math.PI/180)*frame.sign);
    close(dot(direction,axes[1]),-22*Math.sin(2*Math.PI/180));
    assert.ok([...c.eye,...c.center,...c.up].every(Number.isFinite));
  }
});

test('other teams keep their existing cockpit camera', () => {
 for (const team of ['mclaren','mercedes','williams','alpine','audi','haas','racingbulls','astonmartin','cadillac']) {
  assert.equal(cockpitCamera(carBodyFrame(team,0,0,0,0,{pitch:0,roll:0})),null);
 }
});
