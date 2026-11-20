// Touch controls test: runs src/touch-controls.mjs against the real index.html in jsdom.
// Needs jsdom (not a runtime dependency):  npm i --no-save jsdom
// Usage: node tools/touch.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); } catch { console.error('jsdom is required: npm i --no-save jsdom'); process.exit(2); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// matches: which media queries answer true (jsdom has no matchMedia of its own).
function setup(url, matches = {}) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  dom.window.matchMedia = (query) => ({ matches: Boolean(matches[query]) });
  for (const key of ['window', 'document', 'navigator', 'localStorage', 'MutationObserver', 'KeyboardEvent', 'URLSearchParams']) {
    try { globalThis[key] = dom.window[key]; } catch { Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true }); }
  }
  return dom;
}
const load = (tag) => import(path.join(root, 'src/touch-controls.mjs') + '?' + tag);
const log = [];
const record = () => { log.length = 0; for (const type of ['keydown', 'keyup']) window.addEventListener(type, (e) => log.push(`${type}:${e.key}:${e.code}${e.repeat ? ':repeat' : ''}`)); };
const pointer = (element, type, x = 0) => { const e = new window.Event(type, { bubbles: true, cancelable: true }); e.clientX = x; e.pointerId = 1; element.dispatchEvent(e); };

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
let dom, touch;

test('stays completely off on a computer (mouse, hover)', async () => {
  setup('http://localhost/', { '(hover: hover)': true });
  const fresh = (await load('off')).touchControls;
  assert.equal(fresh.init(), false);
  assert.equal(document.getElementById('touchControls'), null);
  assert.equal(document.getElementById('touchCamera'), null);
  assert.equal(document.body.classList.contains('touch-mode'), false);
});

test('turns itself on for a phone (coarse pointer, no hover)', async () => {
  setup('http://localhost/', { '(pointer: coarse)': true });
  const fresh = (await load('phone')).touchControls;
  assert.equal(fresh.init(), true);
  assert.ok(document.getElementById('touchGas'));
});

test('?touch=0 forces it off even on a phone', async () => {
  setup('http://localhost/?touch=0', { '(pointer: coarse)': true });
  const fresh = (await load('forced-off')).touchControls;
  assert.equal(fresh.init(), false);
  assert.equal(document.getElementById('touchGas'), null);
});

test('?touch=1 builds throttle, brake, steering, camera and exit', async () => {
  dom = setup('http://localhost/?touch=1', { '(hover: hover)': true });
  touch = (await load('on')).touchControls;
  assert.equal(touch.init(), true);
  assert.ok(document.body.classList.contains('touch-mode'));
  for (const id of ['touchGas', 'touchBrake', 'touchSteer', 'touchExit', 'touchCamera']) assert.ok(document.getElementById(id), id);
  assert.equal(touch.init(), true); // safe to call twice
  assert.equal(document.querySelectorAll('#touchGas').length, 1);
  record();
});

test('layout: gas is the rightmost pedal with brake next to it; steering is its own zone', () => {
  const pedals = [...document.querySelector('.tc-pedals').children].map((el) => el.id);
  assert.deepEqual(pedals, ['touchBrake', 'touchGas']);
  assert.ok(document.getElementById('touchSteer').querySelector('.tc-left'));
  assert.ok(document.getElementById('touchSteer').querySelector('.tc-right'));
});

test('camera icon sits next to SETTINGS', () => {
  const camera = document.getElementById('touchCamera');
  assert.equal(camera.nextElementSibling, document.getElementById('settingsToggle'));
});

test('GAS = hold W, release lets go', async () => {
  const gas = document.getElementById('touchGas');
  log.length = 0;
  pointer(gas, 'pointerdown');
  assert.deepEqual(log, ['keydown:w:KeyW']);
  await flush(250);
  assert.ok(log.some((entry) => entry === 'keydown:w:KeyW:repeat'), 'held key keeps repeating');
  pointer(gas, 'pointerup');
  assert.equal(log.at(-1), 'keyup:w:KeyW');
  const count = log.length; await flush(250);
  assert.equal(log.length, count, 'no events after release');
});

test('BRAKE = hold S', () => {
  log.length = 0;
  const brake = document.getElementById('touchBrake');
  pointer(brake, 'pointerdown'); pointer(brake, 'pointerup');
  assert.deepEqual(log, ['keydown:s:KeyS', 'keyup:s:KeyS']);
});

test('gas and brake can be held together', () => {
  log.length = 0;
  pointer(document.getElementById('touchGas'), 'pointerdown');
  pointer(document.getElementById('touchBrake'), 'pointerdown');
  pointer(document.getElementById('touchGas'), 'pointerup');
  pointer(document.getElementById('touchBrake'), 'pointerup');
  assert.deepEqual(log, ['keydown:w:KeyW', 'keydown:s:KeyS', 'keyup:w:KeyW', 'keyup:s:KeyS']);
});

test('steering: left = A, right = D, and a thumb can slide across', () => {
  const zone = document.getElementById('touchSteer');
  zone.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 100 });
  log.length = 0;
  pointer(zone, 'pointerdown', 150);              // right half
  pointer(zone, 'pointermove', 160);              // still right: nothing new
  pointer(zone, 'pointermove', 40);               // slide to left half
  pointer(zone, 'pointerup', 40);
  assert.deepEqual(log, ['keydown:d:KeyD', 'keyup:d:KeyD', 'keydown:a:KeyA', 'keyup:a:KeyA']);
  assert.equal(zone.querySelector('.tc-left').classList.contains('down'), false);
});

test('camera icon = tap V, EXIT = tap Escape', () => {
  log.length = 0;
  document.getElementById('touchCamera').click();
  document.getElementById('touchExit').click();
  assert.deepEqual(log, ['keydown:v:KeyV', 'keyup:v:KeyV', 'keydown:Escape:Escape', 'keyup:Escape:Escape']);
});

test('keys are released when driving stops (pause / replay / quit)', async () => {
  document.body.classList.add('drive-active'); await flush();
  log.length = 0;
  pointer(document.getElementById('touchGas'), 'pointerdown');
  document.body.classList.remove('drive-active'); await flush();
  assert.equal(log.at(-1), 'keyup:w:KeyW');
  const count = log.length; await flush(250);
  assert.equal(log.length, count);
});

test('keys are released when the page loses focus', () => {
  log.length = 0;
  pointer(document.getElementById('touchBrake'), 'pointerdown');
  window.dispatchEvent(new window.Event('blur'));
  assert.equal(log.at(-1), 'keyup:s:KeyS');
});

test('the game keyboard handler sees the same events as real keys', () => {
  // Mirrors game.js: keys[e.key.toLowerCase()] set on keydown, cleared on keyup.
  const keys = Object.create(null);
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  pointer(document.getElementById('touchGas'), 'pointerdown');
  assert.equal(keys.w, true);
  pointer(document.getElementById('touchGas'), 'pointerup');
  assert.equal(keys.w, false);
});

test('labels are translated in Chinese mode', async () => {
  const { i18n } = await import(path.join(root, 'src/i18n.mjs'));
  for (const [en, zh] of [['GAS', '油门'], ['BRAKE', '刹车'], ['EXIT', '退出'], ['Throttle (W)', '油门 (W)'], ['Brake (S)', '刹车 (S)'],
    ['Steer left (A)', '向左转 (A)'], ['Steer right (D)', '向右转 (D)'], ['Change camera view (V)', '切换镜头视角 (V)'],
    ['Exit / pause (Esc)', '退出 / 暂停 (Esc)'], ['ROTATE YOUR PHONE TO LANDSCAPE', '请将手机横屏使用']]) assert.equal(i18n.translate(en), zh, en);
  i18n.init(); i18n.setLanguage('zh', false); await flush();
  assert.equal(document.querySelector('#touchGas span').textContent, '油门');
  assert.equal(document.querySelector('#touchExit span').textContent, '退出');
  assert.equal(document.getElementById('touchCamera').getAttribute('aria-label'), '切换镜头视角 (V)');
});

let failed = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log('ok   ' + name); }
  catch (error) { failed++; console.log('FAIL ' + name + '\n     ' + String(error.message).split('\n').join('\n     ')); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
