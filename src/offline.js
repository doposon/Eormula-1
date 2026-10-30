// Build the same self-contained HTML as tools/export_standalone.py, using
// assets already loaded in memory. No server or separate files are needed later.
export function enableOfflineDownload(assets) {
  const button = document.getElementById('downloadOffline');
  const menuButton = button.cloneNode(true);menuButton.id='downloadOfflineMenu';
  document.querySelector('#modeScreen .mode-panel').appendChild(menuButton);
  menuButton.addEventListener('click',()=>button.click());
  button.addEventListener('click', async () => {
    button.disabled = true;menuButton.disabled=true;menuButton.textContent='PREPARING DOWNLOAD…';
    button.textContent = 'PREPARING DOWNLOAD…';
    try {
      const root = new URL('../', import.meta.url);
      const files = ['index.html', 'src/styles.css', 'src/ui.css', 'src/camera.mjs', 'src/game.js', 'src/marked-audio.mjs'];
      const [template, styles, ui, camera, game, markedAudio] = await Promise.all(files.map(async path => {
        const response = await fetch(new URL(path, root), {cache:'no-cache'});
        if (!response.ok) throw new Error('Could not load '+path);
        return response.text();
      }));
      const statement = "import { DRIVING_CAMERAS, carBodyFrame, cockpitCamera } from './camera.mjs';";
      if (!game.includes(statement)) throw new Error('Unsupported game version');
      const source = game.replace(statement, '').replace("import { MarkedAudio, APPROVED_AUDIO } from './marked-audio.mjs?v=surface2';", '').replace('export default function startGame', 'function startGame');
      // Blob parts avoid creating a second giant concatenated source string.
      const parts = [];
      const script = "(()=>{\n'use strict';\n"+camera.replaceAll('export ', '')+'\n'+markedAudio.replaceAll('export ', '')+'\n'+source+'\nstartGame();\n})();';
      let html = template.replace('<link rel="stylesheet" href="src/styles.css">', '<style>'+styles+'</style>')
        .replace('<link rel="stylesheet" href="src/ui.css">', '<style>'+ui+'</style>')
        .replace('id="downloadOffline"', 'id="downloadOffline" hidden');
      const marker = '<script type="module" src="src/main.js?v=surface2"></script>';
      if (!html.includes(marker)) throw new Error('Unsupported page version');
      const [before, after] = html.split(marker);
      parts.push(before, '<script>\n');
      let last = 0;
      for (const match of script.matchAll(/__embeddedAssets\["(asset-\d+)"\]/g)) {
        if (!assets[match[1]]) throw new Error('Missing '+match[1]);
        parts.push(script.slice(last, match.index), '"', assets[match[1]], '"');
        last = match.index+match[0].length;
      }
      parts.push(script.slice(last), '\n</script>', after);
      const url = URL.createObjectURL(new Blob(parts, {type:'text/html;charset=utf-8'}));
      const link = document.createElement('a');link.href=url;link.download='Formula-Racing-2.17.6.html';
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 60000);
      button.textContent = 'DOWNLOAD OFFLINE HTML';
    } catch (error) {
      console.error('Offline download failed:', error);
      button.textContent = 'DOWNLOAD FAILED · CLICK TO RETRY';
    } finally { button.disabled = false;menuButton.disabled=false;menuButton.textContent=button.textContent; }
  });
}
