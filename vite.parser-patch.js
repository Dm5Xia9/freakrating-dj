// guitarpro-parser читает микшер GP3–GP5 (громкость, панорама каналов), но выбрасывает его.
// Плагин на лету дописывает эти поля в партии (track.volume / track.balance, значения 0–16 как в файле),
// чтобы пластинки звучали с балансом оригинала. Пакет в node_modules не меняется.
const PATCHES = [
  ['r.skip(8);\n    channels.push({ program: program === -1 ? null : program });',
    'const volume = r.u8(), balance = r.u8();\n    r.skip(6);\n    channels.push({ program: program === -1 ? null : program, volume, balance });'],
  ['return { program: channels[index].program, percussionChannel: isPercussionChannel(index) };',
    'return { program: channels[index].program, volume: channels[index].volume, balance: channels[index].balance, percussionChannel: isPercussionChannel(index) };'],
  ['const { program, percussionChannel } = readChannelProgram(ctx, channels);',
    'const { program, percussionChannel, volume, balance } = readChannelProgram(ctx, channels);'],
  ['return { name, percussion: (flags & PERCUSSION_FLAG) !== 0 || percussionChannel, tuning, fretCount, capo, program };',
    'return { name, percussion: (flags & PERCUSSION_FLAG) !== 0 || percussionChannel, tuning, fretCount, capo, program, volume, balance };'],
  ['const base = { index, name: raw.name, shortName: "", program: raw.program, lyrics: lyricsFor(ctx, song, index) };',
    'const base = { index, name: raw.name, shortName: "", program: raw.program, volume: raw.volume, balance: raw.balance, lyrics: lyricsFor(ctx, song, index) };'],
];

export default function parserMixerPatch() {
  return {
    name: 'guitarpro-parser-mixer',
    enforce: 'pre',
    transform(code, id) {
      if (!/guitarpro-parser[\\/]dist[\\/]index\.js/.test(id)) return null;
      let out = code;
      for (const [from, to] of PATCHES) {
        if (!out.includes(from)) throw new Error(`guitarpro-parser изменился: не нашёл «${from.slice(0, 60)}…» — обнови vite.parser-patch.js`);
        out = out.replace(from, to);
      }
      return { code: out, map: null };
    },
  };
}
