// ==UserScript==
// @name         FreakRating DJ player
// @namespace    https://github.com/Dm5Xia9/freakrating-dj
// @version      1.3.0
// @description  Record-crate HUD: choose a vinyl and play it on the in-game guitar.
// @match        https://freakrating.lol/*
// @match        https://www.freakrating.lol/*
// @match        https://*.freakrating.lol/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/Dm5Xia9/freakrating-dj/main/src/voice-hook.js
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// @run-at       document-start
// ==/UserScript==

(async function () {
  'use strict';

  const BASE = 'https://raw.githubusercontent.com/Dm5Xia9/freakrating-dj/main';
  const PLAYER_URL = `${BASE}/src/guitar-player.js`;
  const HUD_URL = `${BASE}/src/dj-hud.js`;
  const CONVERTER_URL = `${BASE}/src/generated/gp-converter.js`;
  const API_URL = 'https://api.github.com/repos/Dm5Xia9/freakrating-dj/contents/lib';

  function get(url) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'GET', url, onload: r => r.status >= 200 && r.status < 300 ? resolve(r.responseText) : reject(new Error(`HTTP ${r.status}: ${url}`)),
      onerror: () => reject(new Error(`Не удалось загрузить ${url}`)),
    }));
  }

  // voice-hook.js (@require) уже перехватил отправителей голоса — до кода игры. HUD ждёт DOM.
  if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));

  // Функция-обёртка: async IIFE из скрипта возвращает промис, чтобы ловить ошибки.
  const run = code => { const holder = {}; new Function('__dj', code.replace(/^\(async\b/m, '__dj.p=(async'))(holder); return holder.p; };

  try {
    run(await get(HUD_URL));
    window.FreakDJ.start({
      loadText: get,
      // Конвертер GP грузится только при первом приложенном файле.
      loadConverter: async () => new Function(`${await get(CONVERTER_URL)}\nreturn FreakDJConvert;`)().convertGp,
      async listSongs() {
        const files = JSON.parse(await get(API_URL)).filter(f => f.type === 'file' && /^play-.*\.js$/i.test(f.name));
        return files.map(f => ({ file: f.name, url: f.download_url }));
      },
    });
  } catch (e) { console.error('[FreakRating DJ] HUD', e); }

  if (!window.guitarPlayer) {
    try { await run(await get(PLAYER_URL)); } catch (e) { console.error('[FreakRating DJ] player', e); }
  }
})();
