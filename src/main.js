import { createLoadingScreen } from './loading-screen.js?v=audio13';
import startGame from './game.js?v=audio13';
import { enableOfflineDownload } from './offline.js?v=audio13';

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
document.body.append(overlay);
const splash=document.getElementById('studioSplash');
if(splash){await Promise.race([splash.querySelector('img').decode().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);await new Promise(r=>setTimeout(r,1500));splash.remove();}
const story=await createLoadingScreen(overlay,new URL('../assets/loading/',import.meta.url));
const label={set textContent(value){const counter=value.match(/(\d+) \/ (\d+)/);if(counter)story.update(Number(counter[1]),Number(counter[2]),counter[0]+' FILES');else{const status=overlay.querySelector('[role="status"]');status.textContent=value;}},setAttribute(name,value){overlay.setAttribute(name,value);}};
story.update(0,28);

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
