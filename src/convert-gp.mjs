#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTimeline, parseGuitarPro, scheduleTrack } from 'guitarpro-parser';

const args = process.argv.slice(2);
const positional = args.filter(arg => !arg.startsWith('--'));
const input = positional[0];
const output = positional[1];
const maxVoices = Number(args.find(arg => arg.startsWith('--max-voices='))?.split('=')[1] ?? 8);
const trackArg = args.find(arg => arg.startsWith('--track='))?.split('=')[1];

if (!input || args.includes('--help') || args.includes('-h')) {
  console.log(`Использование: npm run convert -- <файл.gp3|gp4|gp5|gpx|gp> [выход.js] [--track=номер] [--max-voices=8]\n\nПо умолчанию объединяются все не ударные партии. Номер партии начинается с 0.`);
  process.exit(input ? 0 : 1);
}
if (!Number.isInteger(maxVoices) || maxVoices < 1 || maxVoices > 8) throw new Error('--max-voices должен быть от 1 до 8');

const inputPath = path.resolve(input);
let bytes = fs.readFileSync(inputPath);
let song;
let repairedFrets = 0;
let trimmedBytes = 0;
for (let attempt = 0; attempt < 130 && !song; attempt++) {
  try {
    song = parseGuitarPro(bytes);
  } catch (error) {
    const reason = String(error?.reason ?? error?.message);
    if (reason.includes('follow the last bar') && trimmedBytes < 16) {
      bytes = bytes.subarray(0, bytes.length - 1);
      trimmedBytes++;
      continue;
    }
    const invalidFret = /a note is on fret -(\d+)/.exec(reason);
    const offset = error?.location?.byteOffset;
    if (invalidFret && Number.isInteger(offset) && offset > 0 && offset <= bytes.length && repairedFrets < 128) {
      // Repair a malformed negative fret in memory as an open string; never modify the source file.
      bytes = Buffer.from(bytes);
      bytes[offset - 1] = 0;
      repairedFrets++;
      continue;
    }
    throw error;
  }
}
if (!song) throw new Error('Не удалось разобрать файл после исправления известных ошибок GP4.');

const repairText = text => {
  if (!/[ÐÑÃÂ]/.test(text)) return text;
  try { return new TextDecoder('windows-1251').decode(Buffer.from(text, 'latin1')) || text; } catch { return text; }
};
const safeName = value => String(value).normalize('NFKD').replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'song';
const title = repairText(song.info.title || path.basename(inputPath, path.extname(inputPath)));
const timeline = buildTimeline(song);
const chosenTracks = trackArg === undefined
  ? song.tracks.map((track, index) => ({ track, index })).filter(({ track }) => track.kind !== 'percussion')
  : (() => {
      const index = Number(trackArg);
      if (!Number.isInteger(index) || !song.tracks[index] || song.tracks[index].kind === 'percussion') throw new Error(`Нет мелодической партии с индексом ${trackArg}`);
      return [{ track: song.tracks[index], index }];
    })();
if (!chosenTracks.length) throw new Error('В файле нет мелодических партий');

const rankFor = name => /lead|melody|solo|vocal/i.test(name) ? 4 : /rhythm|guitar|acoustic/i.test(name) ? 3 : /bass/i.test(name) ? 1 : 2;
const noteEvents = [];
for (const { track, index } of chosenTracks) {
  const priority = rankFor(track.name);
  for (const event of scheduleTrack(song, track, timeline)) {
    const start = Math.max(0, event.startMs), end = Math.max(start, event.endMs);
    if (end <= start) continue;
    let midi = event.note.midi;
    while (midi < 48) midi += 12;
    while (midi > 84) midi -= 12;
    noteEvents.push({ start, end, midi, priority, track: index });
  }
}
if (!noteEvents.length) throw new Error('В выбранных партиях нет нот');

// Sweep note boundaries and trim the least prominent voices only where the game limit is exceeded.
const boundaries = [...new Set(noteEvents.flatMap(note => [note.start, note.end]))].sort((a, b) => a - b);
const kept = Array.from({ length: noteEvents.length }, () => []);
const startsAt = new Map(), endsAt = new Map();
for (let id = 0; id < noteEvents.length; id++) {
  const note = noteEvents[id];
  if (!startsAt.has(note.start)) startsAt.set(note.start, []);
  if (!endsAt.has(note.end)) endsAt.set(note.end, []);
  startsAt.get(note.start).push(id);
  endsAt.get(note.end).push(id);
}
const active = new Set();
let droppedSpans = 0;
for (let i = 0; i < boundaries.length - 1; i++) {
  const start = boundaries[i], end = boundaries[i + 1];
  for (const id of endsAt.get(start) ?? []) active.delete(id);
  for (const id of startsAt.get(start) ?? []) active.add(id);
  if (end <= start) continue;
  const ordered = [...active].sort((a, b) => noteEvents[b].priority - noteEvents[a].priority || noteEvents[b].midi - noteEvents[a].midi || noteEvents[a].track - noteEvents[b].track);
  if (ordered.length > maxVoices) droppedSpans++;
  for (const id of ordered.slice(0, maxVoices)) {
    const spans = kept[id], previous = spans.at(-1);
    if (previous && Math.abs(previous[1] - start) < 0.01) previous[1] = end;
    else spans.push([start, end]);
  }
}

const pitchNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = midi => `${pitchNames[midi % 12]}${Math.floor(midi / 12) - 1}`;
const grouped = new Map();
for (let id = 0; id < noteEvents.length; id++) {
  for (const [startMs, endMs] of kept[id]) {
    const at = Number((startMs / 500).toFixed(4));
    const dur = Number(((endMs - startMs) / 500).toFixed(4));
    const key = `${at}/${dur}`;
    if (!grouped.has(key)) grouped.set(key, { at, dur, notes: new Set() });
    grouped.get(key).notes.add(noteName(noteEvents[id].midi));
  }
}
const score = [...grouped.values()].sort((a, b) => a.at - b.at || a.dur - b.dur).map(event => ({ at: event.at, dur: event.dur, notes: [...event.notes] }));
const defaultOutput = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib', `play-${safeName(path.basename(inputPath, path.extname(inputPath)))}.js`);
const outputPath = path.resolve(output ?? defaultOutput);
const trackNames = chosenTracks.map(({ track, index }) => `${index}: ${repairText(track.name)}`).join(', ');
const sourceTempo = song.tempoChanges[0]?.bpm ?? 120;
const js = `// ${title} — конвертация из Guitar Pro для guitar-player.js.\n// Источник: ${path.basename(inputPath)}; партии: ${trackNames}; исходный темп: ${sourceTempo} BPM.\n(async () => {\n  if (!window.guitarPlayer) throw new Error('Сначала запусти guitar-player.js');\n  const score = ${JSON.stringify(score)};\n  console.info(${JSON.stringify(`${title}: ${score.length} событий, максимум ${maxVoices} голосов.`)});\n  await window.guitarPlayer.play(score, {bpm:120, loop:false, humanizeMs:3});\n})();\n`;
fs.writeFileSync(outputPath, js);
console.log(`Создан: ${outputPath}`);
console.log(`Партии: ${trackNames}`);
console.log(`Событий: ${score.length}; нот до ограничения: ${noteEvents.length}; участков с превышением ${maxVoices} голосов: ${droppedSpans}.`);
if (repairedFrets || trimmedBytes) console.log(`Коррекция повреждённых данных в памяти: ладов ${repairedFrets}, лишних байтов ${trimmedBytes}; исходный файл не изменён.`);
