import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const BAD_MEANING = /^(?:n\/?a|na|none|null|undefined|暂无释义|暂无|无|-)$/i;

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateWords(words, label) {
  const seen = new Set();
  words.forEach((item, index) => {
    const word = String(item.word || '').trim();
    const meaning = String(item.meaning || '').trim();
    const key = word.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
    assert(word, `${label}[${index}] has no word`);
    assert(meaning && !BAD_MEANING.test(meaning), `${label}[${index}] has an invalid meaning`);
    assert(/[\u3400-\u9fff]/.test(meaning), `${label}[${index}] has no Chinese meaning`);
    assert(!seen.has(key), `${label} contains duplicate word: ${word}`);
    seen.add(key);
  });
}

const manifest = await readJson('data/toeic-manifest.json');
const core = await readJson(manifest.core.file);
assert(core.version === manifest.version, 'Core version does not match manifest');
assert(core.words.length === 1250, `Expected 1250 core words, got ${core.words.length}`);
validateWords(core.words, 'core');

const all = [];
for (const chunkMeta of manifest.full.chunks) {
  const chunk = await readJson(chunkMeta.file);
  assert(chunk.version === manifest.version, `${chunkMeta.file} version does not match manifest`);
  assert(chunk.words.length === chunkMeta.count, `${chunkMeta.file} count does not match manifest`);
  all.push(...chunk.words);
}
assert(all.length === 11154, `Expected 11154 full words, got ${all.length}`);
validateWords(all, 'full');
assert(core.words.every((item, index) => item.word === all[index].word), 'Core is not the first 1250 ranked full-deck words');

console.log(`Validated TOEIC Core ${core.words.length} and Full ${all.length} (${manifest.full.chunks.length} chunks).`);
