// On-screen controls for phones and tablets (landscape).
//
// Nothing in the game's own input code is changed: every button fires the same
// keyboard events the keyboard does (W throttle, S brake / reverse, A / D steer,
// V camera, Esc pause / resume), so keyboard play keeps working exactly as before.
//
// Layout (landscape):  top-left EXIT  ·  top-right camera + settings
//                      bottom-left steer ◀ ▶  ·  bottom-right BRAKE, GAS (rightmost)
//
// Enabled on touch devices (coarse pointer). Add ?touch=1 to the address to force
// it on (for testing on a computer) or ?touch=0 to force it off.
//
// Everything lives in one exported object so the offline exporter can paste this
// file into one script without top-level name clashes.
export const touchControls = (() => {
  const REPEAT_MS = 90;     // re-send held keys, like keyboard auto-repeat
  const held = new Map();   // key -> { code, timer }
  let started = false;
  let enabled = false;
  let steerDirection = null;

  const ICON_LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_EXIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5zM15 10.5l5.5-3v9l-5.5-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

  function shouldEnable() {
    const forced = new URLSearchParams(window.location.search).get('touch');
    if (forced === '1') return true;
    if (forced === '0') return false;
    const media = window.matchMedia ? (query) => window.matchMedia(query).matches : () => false;
    return media('(pointer: coarse)') || ('ontouchstart' in window && !media('(hover: hover)'));
  }

  // ---- Keyboard events the game already understands ----
  function fire(type, key, code, repeat = false) {
    window.dispatchEvent(new KeyboardEvent(type, { key, code, repeat, bubbles: true, cancelable: true }));
  }
  function press(key, code) {
    if (held.has(key)) return;
    fire('keydown', key, code);
    held.set(key, { code, timer: setInterval(() => fire('keydown', key, code, true), REPEAT_MS) });
    if (navigator.vibrate) navigator.vibrate(8);
  }
  function release(key) {
    const entry = held.get(key);
    if (!entry) return;
    clearInterval(entry.timer);
    held.delete(key);
    fire('keyup', key, entry.code);
  }
  function releaseAll() {
    for (const key of [...held.keys()]) release(key);
    setSteer(null);
  }
  function tap(key, code) {
    fire('keydown', key, code);
    fire('keyup', key, code);
    if (navigator.vibrate) navigator.vibrate(8);
  }

  // ---- Buttons ----
  function holdButton(element, key, code) {
    const down = (event) => {
      event.preventDefault();
      element.classList.add('down');
      if (element.setPointerCapture && event.pointerId !== undefined) { try { element.setPointerCapture(event.pointerId); } catch { /* ignore */ } }
      press(key, code);
    };
    const up = () => { element.classList.remove('down'); release(key); };
    element.addEventListener('pointerdown', down);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(type, up);
  }

  // Left and right share one zone, so a thumb can slide from one side to the other.
  function setSteer(direction, zone) {
    if (direction === steerDirection) return;
    if (steerDirection) release(steerDirection);
    steerDirection = direction;
    if (direction) press(direction, direction === 'a' ? 'KeyA' : 'KeyD');
    const root = zone || document.getElementById('touchSteer');
    if (root) {
      root.querySelector('.tc-left').classList.toggle('down', direction === 'a');
      root.querySelector('.tc-right').classList.toggle('down', direction === 'd');
    }
  }
  function steerZone(zone) {
    const pick = (event) => {
      const box = zone.getBoundingClientRect();
      setSteer(event.clientX < box.left + box.width / 2 ? 'a' : 'd', zone);
    };
    zone.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (zone.setPointerCapture && event.pointerId !== undefined) { try { zone.setPointerCapture(event.pointerId); } catch { /* ignore */ } }
      pick(event);
    });
    zone.addEventListener('pointermove', (event) => { if (steerDirection) pick(event); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(type, () => setSteer(null, zone));
  }

  function build() {
    const controls = document.createElement('div');
    controls.id = 'touchControls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Touch controls');
    controls.innerHTML =
      '<div id="touchSteer" class="tc-steer">' +
        '<div class="tc-btn tc-left" role="button" aria-label="Steer left (A)">' + ICON_LEFT + '</div>' +
        '<div class="tc-btn tc-right" role="button" aria-label="Steer right (D)">' + ICON_RIGHT + '</div>' +
      '</div>' +
      '<div class="tc-pedals">' +
        '<div id="touchBrake" class="tc-pedal tc-brake" role="button" aria-label="Brake (S)"><span>BRAKE</span></div>' +
        '<div id="touchGas" class="tc-pedal tc-gas" role="button" aria-label="Throttle (W)"><span>GAS</span></div>' +
      '</div>' +
      '<div class="tc-rotate">ROTATE YOUR PHONE TO LANDSCAPE</div>';
    document.body.append(controls);

    // EXIT sits outside the controls layer so it stays above the pause menu.
    const exit = document.createElement('button');
    exit.id = 'touchExit';
    exit.type = 'button';
    exit.className = 'tc-exit';
    exit.setAttribute('aria-label', 'Exit / pause (Esc)');
    exit.innerHTML = ICON_EXIT + '<span>EXIT</span>';
    exit.addEventListener('pointerdown', (event) => { event.preventDefault(); });
    exit.addEventListener('click', () => tap('Escape', 'Escape'));
    document.body.append(exit);

    // Camera icon next to SETTINGS (top right).
    const camera = document.createElement('button');
    camera.id = 'touchCamera';
    camera.type = 'button';
    camera.className = 'tc-camera';
    camera.title = 'Change camera view (V)';
    camera.setAttribute('aria-label', 'Change camera view (V)');
    camera.innerHTML = ICON_CAMERA;
    camera.addEventListener('pointerdown', (event) => { event.preventDefault(); });
    camera.addEventListener('click', () => tap('v', 'KeyV'));
    const settings = document.getElementById('settingsToggle');
    if (settings && settings.parentNode) settings.parentNode.insertBefore(camera, settings); else document.body.append(camera);

    holdButton(controls.querySelector('#touchGas'), 'w', 'KeyW');
    holdButton(controls.querySelector('#touchBrake'), 's', 'KeyS');
    steerZone(controls.querySelector('#touchSteer'));
    for (const element of [controls, exit, camera]) element.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  // Safe to call more than once.
  function init() {
    if (started) return enabled;
    started = true;
    enabled = shouldEnable();
    if (!enabled) return false;
    document.body.classList.add('touch-mode');
    build();
    // Let go of every key the moment driving stops (pause, replay, quit) or the tab loses focus.
    new MutationObserver(() => { if (!document.body.classList.contains('drive-active')) releaseAll(); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
    return true;
  }

  return { init, get enabled() { return enabled; } };
})();
