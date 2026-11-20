// Перехват голоса ставится раньше всего, как @require в userscript.
import '../src/voice-hook.js';
// Локальное превью HUD: фейковый guitarPlayer с теми же событиями, что и src/guitar-player.js.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const emit = (state, extra = {}) => window.dispatchEvent(new CustomEvent('guitarplayer', { detail: { state, ...extra } }));
let run = 0, task = Promise.resolve();
const stop = () => { run++; };
// Звук мока: тихий аккомпанемент + громкие удары strike() — чтобы проверять ритм-игру без игры.
let ac;
const midi = n => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); return m ? 12 * (+m[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) : 60; };
function pluck(note, durMs, vol) {
  ac ||= new AudioContext();
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.value = 440 * 2 ** ((midi(note) - 69) / 12);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(2, durMs / 1000 + 0.1));
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 2.1);
  return () => { g.gain.cancelScheduledValues(ac.currentTime); g.gain.setTargetAtTime(0, ac.currentTime, 0.02); };
}
async function play(score, { bpm = 120, loop = false, until = 0 } = {}) {
  stop();
  await task;
  const id = run;
  emit('waiting');
  task = (async () => {
    await sleep(1500);
    if (id !== run) { emit('ended'); return; }
    const end = Math.max(until, ...score.map(e => Number(e.at) + Number(e.dur ?? 1)));
    const beat = 60000 / bpm, durationMs = end * beat, t0 = performance.now();
    emit('playing', { durationMs, loop });
    const evs = [...score].sort((a, b) => a.at - b.at);
    let i = 0;
    while (id === run && (loop || performance.now() - t0 < durationMs)) {
      const el = performance.now() - t0;
      while (i < evs.length && evs[i].at * beat <= el) { const e = evs[i++]; for (const n of e.notes || []) pluck(n, (e.dur ?? 1) * beat, 0.04); }
      await sleep(10);
    }
    emit('ended');
  })();
  return task;
}
const strike = (notes, durMs) => { const r = notes.map(n => pluck(n, durMs, 0.16)); return () => r.forEach(f => f()); };
// Клавиша G в превью — «сесть/встать» за гитару (в игре это определяет guitar-player.js).
let seated = false;
window.addEventListener('keydown', e => { if (e.code === 'KeyG' && !(e.target instanceof HTMLInputElement)) seated = !seated; });
window.guitarPlayer = { play, stop, strike, seated: () => seated, playTab: (tab, o) => play([{ at: 0, dur: 64 }], o) };

// Демо-«цифровая» пластинка: синтезированный WAV-луп.
function demoWav(seconds = 12, rate = 22050) {
  const n = seconds * rate, buf = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o, s) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true);
  buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); str(36, 'data'); buf.setUint32(40, n * 2, true);
  const notes = [57, 60, 64, 67, 69, 67, 64, 60];
  for (let i = 0; i < n; i++) {
    const t = i / rate, step = Math.floor(t * 4), local = t * 4 - step;
    const f = 440 * 2 ** ((notes[step % 8] - 69) / 12);
    const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-local * 3) * 0.25;
    buf.setInt16(44 + i * 2, v * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

const libs = import.meta.glob('../lib/play-*.js', { query: '?raw', import: 'default' });
await import('../src/dj-hud.js');
window.FreakDJ.start({
  listSongs: async () => Object.keys(libs).map(url => ({ file: url.split('/').pop(), url })),
  loadText: url => (libs[url] ? libs[url]() : fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })),
  loadBinary: url => fetch(url).then(r => r.arrayBuffer()),
  libBase: '/freakrating-dj/lib/',
  loadConverter: () => import('../src/web/convert.js'),
  extraTracks: [{ type: 'digital', title: 'chill vibes.wav', url: demoWav() }],
});

// Имитация игры: клик захватывает курсор, потеря захвата = пауза (как в engine.onLockChange).
const game = document.createElement('div');
game.style.cssText = 'position:fixed;inset:0;z-index:0';
const pause = document.createElement('div');
pause.textContent = 'ПАУЗА — кликни, чтобы продолжить';
pause.style.cssText = 'position:fixed;inset:0;display:none;place-items:center;background:#0008;color:#fff;font:600 22px system-ui;pointer-events:none';
document.body.prepend(game, pause);
game.addEventListener('mousedown', () => { if (!document.pointerLockElement) game.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { pause.style.display = document.pointerLockElement ? 'none' : 'grid'; });
