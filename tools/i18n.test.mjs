// Language layer test: runs src/i18n.mjs against the real index.html in jsdom.
// Needs jsdom (not a runtime dependency):  npm i --no-save jsdom
// Usage: node tools/i18n.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); } catch { console.error('jsdom is required: npm i --no-save jsdom'); process.exit(2); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'localStorage', 'MutationObserver', 'Node']) globalThis[key] = dom.window[key];
const { i18n } = await import(path.join(root, 'src/i18n.mjs'));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const $ = (selector) => document.querySelector(selector);
const text = (selector) => $(selector).textContent.trim();

// Text that may legitimately stay in Latin letters (units, keys, codes).
const ALLOWED = /^(?:[A-Z]{1,3}|KM\/H|km\/h|m|ESC|WASD|A \/ D|\d.*)$/;
const hasChinese = (value) => /[\u4e00-\u9fff]/.test(value);
function leftovers() {
  const found = [];
  const walker = document.createTreeWalker(document.documentElement, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName) || parent.closest('[data-no-i18n]')) continue;
    const value = node.nodeValue.trim();
    if (value && /[A-Za-z]{3,}/.test(value) && !hasChinese(value) && !ALLOWED.test(value)) found.push(value.slice(0, 90));
  }
  for (const element of document.querySelectorAll('[aria-label],[title],[alt]')) {
    if (element.closest('[data-no-i18n]')) continue;
    for (const attribute of ['aria-label', 'title', 'alt']) {
      const value = element.getAttribute(attribute);
      if (value && /[A-Za-z]{3,}/.test(value) && !hasChinese(value)) found.push(`@${attribute}: ${value.slice(0, 80)}`);
    }
  }
  return found;
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('starts in English and keeps the original text', async () => {
  i18n.init();
  assert.equal(i18n.language, 'en');
  assert.equal(text('#practiceMode strong'), 'PRACTICE');
  assert.equal(document.documentElement.lang, 'en');
});

test('the start screen has the language switch under the footer', () => {
  const panel = $('#modeScreen .mode-panel');
  const children = [...panel.children];
  assert.ok(children.indexOf($('#modeScreen .lang-switch')) > children.indexOf($('#modeScreen .mode-footer')));
  assert.equal(document.querySelectorAll('.lang-switch [data-lang]').length, 4);
});

test('clicking 中文 translates the start screen', async () => {
  $('#modeScreen [data-lang="zh"]').click();
  assert.equal(i18n.language, 'zh');
  assert.equal(document.documentElement.lang, 'zh-CN');
  assert.equal(text('#practiceMode strong'), '练习赛');
  assert.equal(text('#grandPrixMode strong'), '大奖赛');
  assert.match(text('#modeTitle'), /选择你的\s*比赛模式/);
  assert.equal(text('#modeScreen [data-lang="zh"]'), '中文');
  assert.equal($('#modeScreen [data-lang="zh"]').getAttribute('aria-pressed'), 'true');
  assert.equal(localStorage.getItem('formulaLanguage'), 'zh');
  assert.match(document.title, /方程式赛车/);
});

test('every screen is fully translated (no English left over)', () => {
  const missing = leftovers();
  assert.deepEqual(missing, [], 'untranslated text:\n' + missing.join('\n'));
});

test('text the game writes later is translated', async () => {
  // These mirror the strings game.js writes while playing.
  if (!$('#weatherStatus')) { const status = document.createElement('span'); status.id = 'weatherStatus'; $('#telemetry').append(status); }
  const cases = [
    ['#timingLapNumber', 'LAP 3 / 5', '第 3 / 5 圈'],
    ['#timingLapNumber', 'LAP 2 / ∞', '第 2 / ∞ 圈'],
    ['#timingLapNumber', 'FINISHED · 5 / 5', '已完成 · 5 / 5'],
    ['#ghostState', 'GHOST: BEST 01:23.456 · replaying', '幽灵车：最佳 01:23.456 · 回放中'],
    ['#surface', 'KERB RUMBLE', '路肩震动'],
    ['#surface', 'GRASS', '草地'],
    ['#lockupAlert', 'LOCK-UP', '抱死'],
    ['#weatherStatus', 'LIGHT RAIN · ROAD GRIP 82%', '小雨 · 路面抓地力 82%'],
    ['#sunAngleButton', 'SUN: EVENING', '光照：傍晚'],
    ['#ferrariUvToggle', 'FERRARI UV: FLIP U+V', '法拉利 UV：翻转 U+V'],
    ['#renderQuality', 'RES: AUTO (75%)', '分辨率：自动 (75%)'],
    ['#tyreMode', 'INTERMEDIATE · I · WEAR OFF', '半雨胎 · I · 磨损关闭'],
    ['#teamLoadStatus', 'LOADING McLAREN + RED BULL…', '正在加载 迈凯伦 + 红牛…'],
    ['#teamLoadStatus', 'CARS READY · START LIGHTS NEXT', '赛车已就绪 · 接下来是起步灯'],
    ['#teamLoadStatus', 'LOADING ASTON MARTIN MODEL…', '正在加载 阿斯顿·马丁 模型…'],
    ['#teamLoadStatus', 'ALPINE MODEL READY', '阿尔派 模型已就绪'],
    ['#modelStatus', 'RED BULL RB22 READY · 41 MATERIAL PARTS', '红牛 RB22 已就绪 · 41 个材质部件'],
    ['#npcModelStatus', 'FERRARI SF26 READY · 9 MATERIAL BATCHES', '法拉利 SF26 已就绪 · 9 个材质批次'],
    ['.sub', 'PLAYER: FERRARI · GHOST: AFTER YOUR FIRST VALID LAP', '玩家：法拉利 · 幽灵车：完成第一个有效圈后出现']
  ];
  for (const [selector, english, chinese] of cases) {
    const element = $(selector);
    element.textContent = english;      // exactly how game.js writes it
    await flush();
    assert.equal(element.textContent, chinese, `${selector}: ${english}`);
  }
});

test('dynamic elements created by the game are translated', async () => {
  const overlay = document.createElement('div');
  overlay.innerHTML = '<div id="pauseTitle">PAUSED</div><div id="pauseSubtitle">ESC / SPACE · resume with a 3-second countdown</div><button>VIEW TRACK</button><select id="replayLap"><option>LAP 2 · 01:23.456</option></select><span>Complete a lap to unlock replay.</span><select aria-label="Replay camera"><option>Halo / T-Cam</option></select>';
  document.body.append(overlay);
  await flush();
  assert.equal(overlay.querySelector('#pauseTitle').textContent, '已暂停');
  assert.equal(overlay.querySelector('#pauseSubtitle').textContent, 'ESC / 空格 · 以 3 秒倒计时继续');
  assert.equal(overlay.querySelector('button').textContent, '查看赛道');
  assert.equal(overlay.querySelector('option').textContent, '第 2 圈 · 01:23.456');
  assert.equal(overlay.querySelector('select[aria-label]').getAttribute('aria-label'), '回放镜头');
  const row = document.createElement('div');row.textContent = 'LAP 3  01:22.100';overlay.append(row);
  const title = document.createElement('strong');title.textContent = '3 LAPS COMPLETE · 04:10.500';overlay.append(title);
  await flush();
  assert.equal(row.textContent, '第 3 圈 01:22.100');
  assert.equal(title.textContent, '3 圈完成 · 04:10.500');
  overlay.remove();
});

test('numbers and times are never altered', async () => {
  const speed = $('#speed');
  speed.textContent = '245'; await flush();
  assert.equal(speed.textContent, '245');
  $('#sessionTime').textContent = '01:02.345'; await flush();
  assert.equal($('#sessionTime').textContent, '01:02.345');
});

test('the game can keep rewriting a node without loops or stale text', async () => {
  const surface = $('#surface');
  for (const [english, chinese] of [['ROAD', '路面'], ['GRASS', '草地'], ['ROAD', '路面']]) {
    surface.textContent = english; await flush();
    assert.equal(surface.textContent, chinese);
  }
});

test('switching back restores every English original', async () => {
  $('#modeScreen [data-lang="en"]').click();
  assert.equal(i18n.language, 'en');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(text('#practiceMode strong'), 'PRACTICE');
  assert.match(text('#modeTitle'), /CHOOSE YOUR\s*RACE MODE/);
  assert.equal($('#modeScreen [data-lang="en"]').getAttribute('aria-pressed'), 'true');
  assert.equal(document.title, 'Formula Racing 2.17.6 · Cockpit Camera');
  assert.equal($('#tyreHud').getAttribute('hidden'), '');
  assert.equal($('[aria-label="Choose your team"]') !== null, true);
  // Text written while in Chinese mode that was English at the time returns to English too.
  assert.equal(text('#timingLapNumber'), 'FINISHED · 5 / 5');
  assert.equal(text('#teamLoadStatus'), 'ALPINE MODEL READY');
  assert.equal(localStorage.getItem('formulaLanguage'), 'en');
});

test('English mode no longer rewrites text', async () => {
  $('#surface').textContent = 'WALL IMPACT'; await flush();
  assert.equal($('#surface').textContent, 'WALL IMPACT');
});

test('settings-panel switch works and the choice is remembered', async () => {
  $('#settingsPanel [data-lang="zh"]').click();
  assert.equal(text('#settingsPanel .settings-head strong'), '游戏设置');
  assert.equal($('#modeScreen [data-lang="zh"]').getAttribute('aria-pressed'), 'true');
  assert.equal(localStorage.getItem('formulaLanguage'), 'zh');
});

test('the language switch itself is never translated', () => {
  assert.equal($('.lang-switch .lang-label').textContent, 'LANGUAGE / 语言');
  assert.equal($('.lang-switch [data-lang="en"]').textContent, 'English');
});

test('translate() keeps surrounding whitespace and ignores unknown text', () => {
  assert.equal(i18n.translate('  PAUSED  '), '  已暂停  ');
  assert.equal(i18n.translate('00:00.000'), null);
  assert.equal(i18n.translate('Some unknown English text'), null);
  assert.equal(i18n.translate(' '), null);
  assert.equal(i18n.translate('SPACE · 3-second restart countdown'), '空格 · 3 秒重新开始倒计时');
  assert.equal(i18n.translate('LOADING WILLIAMS MODEL…'), '正在加载 威廉姆斯 模型…');
  assert.equal(i18n.translate('Racing Bulls · Available'), '红牛二队 · 可用');
});

let failed = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log('ok   ' + name); }
  catch (error) { failed++; console.log('FAIL ' + name + '\n     ' + String(error.message).split('\n').join('\n     ')); }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
