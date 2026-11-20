import './style.css';
import { convertGp } from './convert.js';

const input = document.querySelector('#file-input');
const fileLabel = document.querySelector('#file-label');
const button = document.querySelector('#convert');
const status = document.querySelector('#status');
const zone = document.querySelector('#drop-zone');
let file;

function setFile(value) {
  if (!value) return;
  file = value;
  fileLabel.textContent = value.name;
  button.disabled = false;
  status.textContent = 'Файл выбран. Нажми кнопку для конвертации.';
}

input.addEventListener('change', () => setFile(input.files[0]));
zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('dragging'); });
zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('dragging'); setFile(event.dataTransfer.files[0]); });
button.addEventListener('click', async () => {
  if (!file) return;
  button.disabled = true;
  status.textContent = 'Конвертирую…';
  try {
    const result = convertGp(new Uint8Array(await file.arrayBuffer()), file.name, Number(document.querySelector('#voices').value));
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.slug}.json`;
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = `Готово: ${result.score.length} событий. JSON скачан.`;
  } catch (error) {
    status.textContent = `Не удалось конвертировать: ${error.message}`;
    console.error(error);
  } finally { button.disabled = false; }
});
