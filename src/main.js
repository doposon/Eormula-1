import startGame from './game.js?v=surface2';
import { enableOfflineDownload } from './offline.js?v=surface2';

// Keep the original decoders and driving code intact. Binary files contain
// exactly the bytes formerly embedded as base64 strings, including compression.
export function encodeBase64(bytes) {
  const pieces = [];
  // Divisible by three: concatenated base64 chunks must not contain padding.
  const chunkSize = 24576;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    pieces.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))));
  }
  return pieces.join('');
}

const overlay = document.createElement('div');
overlay.className = 'asset-loading';
overlay.setAttribute('role', 'status');
const label = document.createElement('p');
label.textContent = 'LOADING FORMULA RACING…';
overlay.append(label);
document.body.append(overlay);

async function checkedFetch(url) {
  const response = await fetch(url, {cache:'no-cache'});
  if (!response.ok) throw new Error(`Resource request failed (${response.status}): ${url.pathname}`);
  return response;
}

try {
  const manifest = await (await checkedFetch(new URL('../assets/manifest.json', import.meta.url))).json();
  if (manifest.version !== 1 || !Array.isArray(manifest.assets)) throw new Error('Unsupported resource manifest');
  const assets = Object.create(null);
  let next = 0;
  let finished = 0;
  async function worker() {
    while (next < manifest.assets.length) {
      const entry = manifest.assets[next++];
      const response = await checkedFetch(new URL(`../${entry.path}`, import.meta.url));
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== entry.bytes) throw new Error(`Incomplete resource: ${entry.label}`);
      assets[entry.id] = encodeBase64(bytes);
      label.textContent = `LOADING FORMULA RACING… ${++finished} / ${manifest.assets.length}`;
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  startGame(assets);
  enableOfflineDownload(assets);
  overlay.remove();
} catch (error) {
  console.error('Game initialization failed:', error);
  label.textContent = 'Unable to load the game. Check the local server and resource files, then reload.';
  overlay.setAttribute('role', 'alert');
}
