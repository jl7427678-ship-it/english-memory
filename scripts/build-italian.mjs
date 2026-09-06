import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Converter } from 'opencc-js';

const DICTIONARY_URL = 'https://kaikki.org/zhwiktionary/%E6%84%8F%E5%A4%A7%E5%88%A9%E8%AA%9E/kaikki.org-dictionary-%E6%84%8F%E5%A4%A7%E5%88%A9%E8%AA%9E.jsonl';
const FREQUENCY_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/it/it_50k.txt';
const VERSION = '2026.09.06-static.1';
const CORE_COUNT = 4000;
const CHUNK_SIZE = 2000;
const OUTPUT_DIR = new URL('../data/', import.meta.url);
const toSimplified = Converter({ from: 'tw', to: 'cn' });

function normalized(value) {
  return String(value || '').normalize('NFC').trim().toLocaleLowerCase('it');
}

function cleanText(value) {
  return toSimplified(String(value || ''))
    .replace(/==[^=]+==/g, '')
    .replace(/:Template:[^\s，；。]*/g, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bestEntry(entries) {
  return [...entries].sort((a, b) => Number(a.pos === 'unknown') - Number(b.pos === 'unknown'))[0];
}

function grammar(entry, word) {
  const tags = new Set(entry.tags || []);
  const forms = entry.forms || [];
  const gender = tags.has('masculine') ? 'masculine' : tags.has('feminine') ? 'feminine' : '';
  const plural = forms.find(item => (item.tags || []).includes('plural'))?.form || '';
  const formOf = (entry.senses || []).flatMap(sense => sense.form_of || []).map(item => item.word).find(Boolean) || '';
  const infinitive = entry.pos === 'verb' ? (/(?:are|ere|ire|rre)$/i.test(word) ? word : formOf) : '';
  const phonetic = (entry.sounds || []).find(item => item.ipa)?.ipa || '';
  return { gender, plural, infinitive, phonetic };
}

async function download(url, path) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

async function dictionaryMap(path) {
  const map = new Map();
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    const glosses = (entry.senses || []).flatMap(sense => sense.glosses || []).map(cleanText).filter(text => text && /[\u3400-\u9fff]/.test(text));
    if (!glosses.length) continue;
    const key = normalized(entry.word);
    const current = map.get(key) || [];
    current.push({ ...entry, cleanedGlosses: glosses });
    map.set(key, current);
  }
  return map;
}

function buildWords(frequencyText, dictionary) {
  const seen = new Set();
  const words = [];
  frequencyText.trim().split(/\r?\n/).forEach((line, sourceIndex) => {
    const match = line.match(/^(.*?)\s+(\d+)$/);
    if (!match) return;
    const word = match[1].normalize('NFC').trim();
    const key = normalized(word);
    if (seen.has(key) || !/^[A-Za-zÀ-ÖØ-öø-ÿ'’ -]+$/.test(word)) return;
    const entries = dictionary.get(key);
    if (!entries?.length) return;
    const entry = bestEntry(entries);
    const meanings = [...new Set(entries.flatMap(item => item.cleanedGlosses))].slice(0, 3);
    if (!meanings.length) return;
    const meta = grammar(entry, word);
    const example = (entry.senses || []).flatMap(sense => sense.examples || []).find(item => item.text && item.translation);
    seen.add(key);
    words.push({
      word,
      meaning: meanings.join('；').slice(0, 120),
      pos: entry.pos === 'unknown' ? '' : entry.pos,
      phonetic: meta.phonetic,
      gender: meta.gender,
      plural: meta.plural,
      infinitive: meta.infinitive,
      frequency: Number(match[2]),
      rank: sourceIndex + 1,
      example: example?.text || '',
      exampleZh: cleanText(example?.translation || ''),
      tags: ['Italiano']
    });
  });
  return words;
}

function deck(id, title, words) {
  return { id, title, language: 'it', speechLang: 'it-IT', targetLanguage: 'zh-CN', version: VERSION, words };
}

function json(value) { return `${JSON.stringify(value)}\n`; }
function sha256(content) { return createHash('sha256').update(content).digest('hex'); }

async function writeDeck(filename, value) {
  const content = json(value);
  await writeFile(new URL(filename, OUTPUT_DIR), content, 'utf8');
  return { file: `data/${filename}`, count: value.words.length, sha256: sha256(content) };
}

async function main() {
  const temporary = await mkdtemp(join(tmpdir(), 'english-memory-italian-'));
  try {
    const dictionaryPath = process.env.ITALIAN_DICTIONARY_FILE || join(temporary, 'zhwiktionary-italian.jsonl');
    const frequencyPath = process.env.ITALIAN_FREQUENCY_FILE || join(temporary, 'it_50k.txt');
    if (!process.env.ITALIAN_DICTIONARY_FILE) await download(DICTIONARY_URL, dictionaryPath);
    if (!process.env.ITALIAN_FREQUENCY_FILE) await download(FREQUENCY_URL, frequencyPath);
    const [dictionary, frequencyText] = await Promise.all([dictionaryMap(dictionaryPath), readFile(frequencyPath, 'utf8')]);
    const words = buildWords(frequencyText, dictionary);
    if (words.length < CORE_COUNT) throw new Error(`Only ${words.length} usable Italian words; need at least ${CORE_COUNT}`);
    await mkdir(OUTPUT_DIR, { recursive: true });
    const chunks = [];
    for (let index = 0; index < words.length; index += CHUNK_SIZE) {
      const filename = `italian-full-${String(chunks.length + 1).padStart(2, '0')}.json`;
      chunks.push(await writeDeck(filename, deck('italian_full', 'Italiano Full', words.slice(index, index + CHUNK_SIZE))));
    }
    await rm(new URL('italian-core.json', OUTPUT_DIR), { force: true });
    const coreChunks = chunks.slice(0, Math.ceil(CORE_COUNT / CHUNK_SIZE));
    const core = { count: CORE_COUNT, chunks: coreChunks };
    const manifest = {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
      sources: [
        { name: 'Chinese Wiktionary via Kaikki/Wiktextract', url: DICTIONARY_URL, license: 'CC BY-SA 4.0 and GFDL' },
        { name: 'hermitdave/FrequencyWords Italian 50k', url: FREQUENCY_URL, license: 'CC BY-SA 4.0' }
      ],
      core,
      full: { count: words.length, chunks }
    };
    await writeFile(new URL('italian-manifest.json', OUTPUT_DIR), json(manifest), 'utf8');
    console.log(`Generated Italian Core ${core.count} and Full ${words.length} in ${chunks.length} chunks.`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

await main();
