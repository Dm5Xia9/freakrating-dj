// ==UserScript==
// @name         FreakRating DJ player
// @namespace    https://github.com/Dm5Xia9/freakrating-dj
// @version      1.0.0
// @description  Choose and play songs from the FreakRating DJ library.
// @match        https://freakrating.lol/*
// @match        https://www.freakrating.lol/*
// @match        https://*.freakrating.lol/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const BASE = 'https://raw.githubusercontent.com/Dm5Xia9/freakrating-dj/main';
  const PLAYER_URL = `${BASE}/src/guitar-player.js`;
  const API_URL = 'https://api.github.com/repos/Dm5Xia9/freakrating-dj/contents/lib';

  function get(url) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'GET', url, onload: r => r.status >= 200 && r.status < 300 ? resolve(r.responseText) : reject(new Error(`HTTP ${r.status}: ${url}`)),
      onerror: () => reject(new Error(`Не удалось загрузить ${url}`)),
    }));
  }

  const panel = document.createElement('section');
  panel.id = 'freakrating-dj-panel';
  panel.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;background:#171923;color:#fff;padding:12px;border:1px solid #646b80;border-radius:10px;font:14px sans-serif;display:flex;gap:8px;align-items:center;box-shadow:0 4px 18px #0008';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Песня');
  select.style.cssText = 'max-width:240px;padding:7px;border-radius:6px';
  const play = document.createElement('button'); play.textContent = '▶ Играть';
  const stop = document.createElement('button'); stop.textContent = '■ Стоп';
  const status = document.createElement('span'); status.textContent = 'Загрузка…';
  [play, stop].forEach(b => { b.style.cssText = 'padding:7px 10px;border:0;border-radius:6px;cursor:pointer'; });
  panel.append(select, play, stop, status); document.body.append(panel);

  try {
    if (!window.guitarPlayer) (new Function(await get(PLAYER_URL)))();
    const files = JSON.parse(await get(API_URL)).filter(f => f.type === 'file' && /^play-.*\.js$/i.test(f.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    for (const f of files) { const o = document.createElement('option'); o.value = f.download_url; o.textContent = f.name.replace(/^play-/, '').replace(/\.js$/i, '').replace(/-/g, ' '); select.append(o); }
    status.textContent = `${files.length} песен`;
  } catch (e) { status.textContent = 'Ошибка загрузки'; console.error('[FreakRating DJ]', e); }

  play.addEventListener('click', async () => {
    try { status.textContent = 'Загрузка песни…'; (new Function(await get(select.value)))(); status.textContent = 'Ожидаю гитару…'; }
    catch (e) { status.textContent = 'Ошибка'; console.error('[FreakRating DJ]', e); }
  });
  stop.addEventListener('click', () => { window.guitarPlayer?.stop(); status.textContent = 'Остановлено'; });
})();
