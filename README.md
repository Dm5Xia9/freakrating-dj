# FreakRating DJ

- `src/` — исходники проигрывателя и конвертера Guitar Pro.
- `lib/` — готовые песни для `window.guitarPlayer.play`.
- `lib/sources/` — исходные табулатуры Guitar Pro и PDF.

## Конвертация песни

Один раз установи зависимость: `npm install`.

```sh
npm run convert -- lib/sources/song.gp5
```

Готовый скрипт появится в `lib/`. В DevTools Console страницы Forest сначала запусти `src/guitar-player.js`, затем нужный `lib/play-*.js`.

Для отдельной партии можно передать номер, начиная с нуля: `npm run convert -- lib/sources/song.gp5 --track=0`. При необходимости можно указать путь результата: `npm run convert -- lib/sources/song.gp5 lib/custom-song.js`.
