// ==UserScript==
// @name         FreakRating DJ player
// @namespace    https://github.com/Dm5Xia9/freakrating-dj
// @version      1.0.1
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
  panel.style.cssText = 'position:fixed!important;z-index:2147483647!important;right:16px!important;bottom:16px!important;top:auto!important;left:auto!important;background:#171923!important;color:#fff!important;padding:12px!important;border:1px solid #646b80!important;border-radius:10px!important;font:14px sans-serif!important;display:flex!important;gap:8px!important;align-items:center!important;box-shadow:0 4px 18px #0008!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Песня');
  select.style.cssText = 'max-width:240px;padding:7px;border-radius:6px';
  const play = document.createElement('button'); play.textContent = '▶ Играть';
  const stop = document.createElement('button'); stop.textContent = '■ Стоп';
  const status = document.createElement('span'); status.textContent = 'Загрузка…';
  [play, stop].forEach(b => { b.style.cssText = 'padding:7px 10px;border:0;border-radius:6px;cursor:pointer'; });
  panel.append(select, play, stop, status);
  const mountPanel = () => {
    // In Fullscreen API mode, only descendants of the fullscreen element are visible.
    const host = document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : document.body;
    if (host && panel.parentElement !== host) host.append(panel);
  };
  mountPanel();
  document.addEventListener('fullscreenchange', mountPanel);

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
