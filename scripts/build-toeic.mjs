import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Converter } from 'opencc-js';

const SOURCE_URL = 'https://huggingface.co/datasets/kknono668/toeic-vocab-tw/resolve/main/data/toeic_vocabulary.json';
const SOURCE_NAME = 'kknono668/toeic-vocab-tw';
const VERSION = '2026.09.05-static.1';
const CORE_COUNT = 1250;
const FULL_COUNT = 11154;
const FULL_CHUNK_COUNT = 12;
const OUTPUT_DIR = new URL('../data/', import.meta.url);
const BAD_MEANING = /^(?:n\/?a|na|none|null|undefined|暂无释义|暂无|无|-)$/i;
const toSimplified = Converter({ from: 'tw', to: 'cn' });

function normalizeWord(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ');
}

function compactMeaning(value) {
  let meaning = String(value || '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (meaning.length > 46) {
    meaning = meaning.slice(0, 46).replace(/[，,；;][^，,；;]*$/, '') + '…';
  }
  return meaning;
}

function validMeaning(value) {
  const meaning = String(value || '').trim();
  return Boolean(meaning && !BAD_MEANING.test(meaning) && /[\u3400-\u9fff]/.test(meaning));
}

async function downloadSource() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch(SOURCE_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`TOEIC source download failed: ${lastError?.message || 'unknown error'}`);
}

function normalizeRows(rows) {
  const seen = new Set();
  const words = [];

  rows.forEach((row, sourceIndex) => {
    const word = String(row.english_word || '').trim();
    const key = normalizeWord(word);
    const meaning = compactMeaning(toSimplified(String(row.chinese_definition || '')));
    if (!word || !key || !validMeaning(meaning) || seen.has(key)) return;
    seen.add(key);

    const sourceExample = Array.isArray(row.examples) ? row.examples[0] || {} : {};
    const category = toSimplified(String(row.category || '').trim());
    const parts = Array.isArray(row.parts_of_speech)
      ? row.parts_of_speech.map(item => String(item || '').trim()).filter(Boolean)
      : [];

    words.push({
      word,
      meaning,
      phonetic: '',
      pos: parts.join('/'),
      example: String(sourceExample.english || '').trim(),
      exampleZh: toSimplified(String(sourceExample.chinese || '').trim()),
      tags: ['TOEIC', ...(category ? [category] : [])],
      star: Number(row.star_rating || 0),
      sourceIndex
    });
  });

  words.sort((a, b) => (b.star - a.star) || (a.sourceIndex - b.sourceIndex));
  return words.map(({ star, sourceIndex, ...word }, index) => ({ ...word, rank: index + 1 }));
}

function deck(id, title, words) {
  return {
    id,
    title,
    language: 'en',
    targetLanguage: 'zh-CN',
    version: VERSION,
    source: SOURCE_NAME,
    license: 'CC BY-SA 4.0',
    words
  };
}

function json(value) {
  return `${JSON.stringify(value)}\n`;
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function writeJson(filename, value) {
  const content = json(value);
  await writeFile(new URL(filename, OUTPUT_DIR), content, 'utf8');
  return { file: `data/${filename}`, count: value.words.length, sha256: sha256(content) };
}

async function main() {
  const source = await downloadSource();
  if (!Array.isArray(source)) throw new Error('TOEIC source is not an array');

  const words = normalizeRows(source);
  if (words.length !== FULL_COUNT) {
    throw new Error(`Expected ${FULL_COUNT} unique valid words, got ${words.length}`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const core = await writeJson('toeic-core.json', deck('toeic_core', 'TOEIC 核心 1250', words.slice(0, CORE_COUNT)));
  const chunkSize = Math.ceil(FULL_COUNT / FULL_CHUNK_COUNT);
  const chunks = [];

  for (let index = 0; index < FULL_CHUNK_COUNT; index += 1) {
    const filename = `toeic-full-${String(index + 1).padStart(2, '0')}.json`;
    const chunkWords = words.slice(index * chunkSize, (index + 1) * chunkSize);
    chunks.push(await writeJson(filename, deck('toeic_full', 'TOEIC 完整 11154', chunkWords)));
  }

  const manifest = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    source: { name: SOURCE_NAME, url: SOURCE_URL, license: 'CC BY-SA 4.0' },
    schemaVersion: 1,
    core,
    full: { count: FULL_COUNT, chunks }
  };
  await writeFile(new URL('toeic-manifest.json', OUTPUT_DIR), json(manifest), 'utf8');
  console.log(`Generated ${core.count} core words and ${chunks.reduce((sum, item) => sum + item.count, 0)} full words in ${chunks.length} chunks.`);
}

await main();
