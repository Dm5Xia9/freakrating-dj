import { buildTimeline, parseGuitarPro, scheduleTrack } from 'guitarpro-parser';

const fixText = text => {
  if (!/[ÐÑÃÂ]/.test(text)) return text;
  try { return new TextDecoder('windows-1251').decode(Uint8Array.from(text, c => c.charCodeAt(0))) || text; } catch { return text; }
};
const slugify = value => String(value).normalize('NFKD').replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'song';
const priority = name => /lead|melody|solo|vocal/i.test(name) ? 4 : /rhythm|guitar|acoustic/i.test(name) ? 3 : /bass/i.test(name) ? 1 : 2;

export function convertGp(inputBytes, filename, maxVoices = 8) {
  if (!Number.isInteger(maxVoices) || maxVoices < 1 || maxVoices > 8) throw new Error('Максимум нот должен быть от 1 до 8.');
  let bytes = inputBytes;
  let song;
  let repairedFrets = 0;
  let trimmedBytes = 0;
  for (let attempt = 0; attempt < 130 && !song; attempt++) {
    try { song = parseGuitarPro(bytes); }
    catch (error) {
      const reason = String(error?.reason ?? error?.message);
      if (reason.includes('follow the last bar') && trimmedBytes < 16) { bytes = bytes.subarray(0, bytes.length - 1); trimmedBytes++; continue; }
      const invalidFret = /a note is on fret -(\d+)/.exec(reason);
      const offset = error?.location?.byteOffset;
      if (invalidFret && Number.isInteger(offset) && offset > 0 && offset <= bytes.length && repairedFrets < 128) {
        bytes = bytes.slice(); bytes[offset - 1] = 0; repairedFrets++; continue;
      }
      throw error;
    }
  }
  if (!song) throw new Error('Не удалось разобрать Guitar Pro файл.');
  const fallbackTitle = filename.replace(/\.[^.]+$/, '');
  const title = fixText(song.info.title || fallbackTitle);
  const timeline = buildTimeline(song);
  const tracks = song.tracks.map((track, index) => ({ track, index })).filter(({ track }) => track.kind !== 'percussion');
  if (!tracks.length) throw new Error('В файле нет мелодических партий.');
  const events = [];
  for (const { track, index } of tracks) for (const event of scheduleTrack(song, track, timeline)) {
    const start = Math.max(0, event.startMs), end = Math.max(start, event.endMs);
    if (end <= start) continue;
    let midi = event.note.midi;
    while (midi < 48) midi += 12;
    while (midi > 84) midi -= 12;
    events.push({ start, end, midi, priority: priority(track.name), track: index });
  }
  if (!events.length) throw new Error('В выбранных партиях нет нот.');
  const boundaries = [...new Set(events.flatMap(note => [note.start, note.end]))].sort((a, b) => a - b);
  const kept = events.map(() => []), starts = new Map(), ends = new Map();
  events.forEach((note, id) => {
    if (!starts.has(note.start)) starts.set(note.start, []);
    if (!ends.has(note.end)) ends.set(note.end, []);
    starts.get(note.start).push(id); ends.get(note.end).push(id);
  });
  const active = new Set();
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i], end = boundaries[i + 1];
    for (const id of ends.get(start) ?? []) active.delete(id);
    for (const id of starts.get(start) ?? []) active.add(id);
    const chosen = [...active].sort((a, b) => events[b].priority - events[a].priority || events[b].midi - events[a].midi || events[a].track - events[b].track).slice(0, maxVoices);
    for (const id of chosen) {
      const spans = kept[id], previous = spans.at(-1);
      if (previous && Math.abs(previous[1] - start) < 0.01) previous[1] = end;
      else spans.push([start, end]);
    }
  }
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const grouped = new Map();
  events.forEach((note, id) => kept[id].forEach(([start, end]) => {
    const at = Number((start / 500).toFixed(4)), dur = Number(((end - start) / 500).toFixed(4));
    const key = `${at}/${dur}`;
    if (!grouped.has(key)) grouped.set(key, { at, dur, notes: new Set() });
    grouped.get(key).notes.add(`${names[note.midi % 12]}${Math.floor(note.midi / 12) - 1}`);
  }));
  const score = [...grouped.values()].sort((a, b) => a.at - b.at || a.dur - b.dur).map(event => ({ at: event.at, dur: event.dur, notes: [...event.notes] }));
  return { format: 'freakrating-dj-score', version: 1, title, slug: slugify(title), source: filename, bpm: 120, originalBpm: song.tempoChanges[0]?.bpm ?? 120, maxVoices, score, ...(repairedFrets || trimmedBytes ? { repairs: { frets: repairedFrets, trimmedBytes } } : {}) };
}
