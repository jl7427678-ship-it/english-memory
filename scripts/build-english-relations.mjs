import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WordNet = require('node-wordnet');
const WORDNET_DIR = require('wordnet-db').path;
const VERSION = '2026.09.06-wordnet.1';
const DATA_DIR = new URL('../data/', import.meta.url);
const IELTS_URL = 'https://raw.githubusercontent.com/grhliu/wordtyper-vocabularies/main/vocabularies/ielts_core.json';
const KAOYAN_URL = 'https://raw.githubusercontent.com/grhliu/wordtyper-vocabularies/main/vocabularies/kaoyan.json';
const CONFUSABLES_API = 'https://en.wikipedia.org/w/api.php?action=parse&page=List_of_commonly_misused_English_words&prop=wikitext%7Crevid&format=json&origin=*';
const CONFUSABLES_URL = 'https://en.wikipedia.org/wiki/List_of_commonly_misused_English_words';
const POS = { n: 'n.', v: 'v.', a: 'adj.', s: 'adj.', r: 'adv.' };

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/_/g, ' ').replace(/\((?:a|p|ip)\)$/i, '').replace(/\s+/g, ' ');
}

function shardKey(word) {
  const first = normalize(word).charAt(0);
  return /[a-z]/.test(first) ? first : '_';
}

function unique(items, key, limit = 12) {
  const seen = new Set();
  return items.filter(item => {
    const value = normalize(item[key]);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  }).slice(0, limit);
}

async function fetchWords(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.words)) throw new Error(`${url}: words is not an array`);
  return data.words.map(item => item.word);
}

function plainWikitext(value) {
  return String(value || '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function briefDifference(value) {
  const clean = plainWikitext(value);
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  let result = '';
  for (const sentence of sentences.slice(0, 2)) {
    if ((result + sentence).length > 280) break;
    result += sentence.trim() + ' ';
  }
  let brief = (result.trim() || clean.slice(0, 280).replace(/\s+\S*$/, '')).trim();
  const missingParens = (brief.match(/\(/g) || []).length - (brief.match(/\)/g) || []).length;
  if (missingParens > 0) brief += ')'.repeat(missingParens);
  return brief;
}

async function fetchConfusables() {
  const response = await fetch(CONFUSABLES_API);
  if (!response.ok) throw new Error(`Wikipedia confusables: HTTP ${response.status}`);
  const parsed = (await response.json()).parse;
  const groups = [];
  for (const line of String(parsed?.wikitext?.['*'] || '').split('\n')) {
    if (!/^\*\s*'{0,3}\[\[wikt:/i.test(line)) continue;
    const words = [];
    const tokenized = line.replace(/\[\[wikt:([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/gi, (_, target, label) => {
      const word = normalize(plainWikitext(label || target));
      words.push(word);
      return `__W${words.length - 1}__`;
    });
    const headMatch = tokenized.match(/^\*\s*(.+?)(?:\.\s|:\s)/);
    const head = headMatch?.[1] || '';
    const indexes = [...head.matchAll(/__W(\d+)__/g)].map(match => Number(match[1]));
    const terms = [...new Set(indexes.map(index => words[index]).filter(Boolean))];
    if (terms.length < 2 || terms.length > 5) continue;
    const rawDifference = tokenized.slice(headMatch?.[0].length || 0).replace(/__W(\d+)__/g, (_, index) => words[Number(index)] || '');
    const difference = briefDifference(rawDifference);
    if (difference.length < 12) continue;
    groups.push({ terms, difference });
  }
  return { groups, revision: parsed?.revid || null };
}

async function localToeicWords() {
  const manifest = JSON.parse(await readFile(new URL('toeic-manifest.json', DATA_DIR), 'utf8'));
  const words = [];
  for (const chunk of manifest.full.chunks) {
    const deck = JSON.parse(await readFile(new URL(chunk.file.replace(/^data\//, ''), DATA_DIR), 'utf8'));
    words.push(...deck.words.map(item => item.word));
  }
  return words;
}

function mergeRelations(base = {}, extra = {}) {
  const result = {};
  for (const key of ['family', 'synonyms', 'collocations', 'confusables']) {
    const field = key === 'collocations' ? 'text' : 'word';
    const items = unique([...(base[key] || []), ...(extra[key] || [])], field);
    if (items.length) result[key] = items;
  }
  return result;
}

async function wordNetRelations(wordnet, word) {
  let synsets;
  try {
    synsets = await wordnet.lookupAsync(word);
  } catch {
    return null;
  }
  if (!synsets?.length) return null;

  const synonyms = [];
  const family = [];
  for (const synset of synsets) {
    for (const synonym of synset.synonyms || []) {
      const value = normalize(synonym);
      if (value && value !== normalize(word)) synonyms.push({ word: value, sense: synset.def || '', source: 'wordnet-3.0' });
    }
    const queryIndex = (synset.synonyms || []).findIndex(item => normalize(item) === normalize(word)) + 1;
    for (const pointer of (synset.ptrs || []).filter(item => item.pointerSymbol === '+')) {
      const sourceIndex = Number.parseInt(pointer.sourceTarget.slice(0, 2), 16);
      if (sourceIndex && sourceIndex !== queryIndex) continue;
      try {
        const target = await wordnet.getAsync(pointer.synsetOffset, pointer.pos);
        const targetIndex = Number.parseInt(pointer.sourceTarget.slice(2), 16);
        const values = targetIndex ? [target.synonyms?.[targetIndex - 1]] : target.synonyms;
        for (const value of values || []) {
          const related = normalize(value);
          if (related && related !== normalize(word)) family.push({ word: related, pos: POS[target.pos] || target.pos, relation: 'derivationally related', source: 'wordnet-3.0' });
        }
      } catch {
        // A broken pointer should not prevent the remaining licensed data from building.
      }
    }
  }

  const relations = mergeRelations({
    family: unique(family, 'word'),
    synonyms: unique(synonyms, 'word', 8)
  });
  return Object.keys(relations).length ? relations : null;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  const [toeic, ielts, kaoyan, seedText, confusableSource] = await Promise.all([
    localToeicWords(),
    fetchWords(IELTS_URL),
    fetchWords(KAOYAN_URL),
    readFile(new URL('english-word-relations-seed.json', DATA_DIR), 'utf8'),
    fetchConfusables()
  ]);
  const seed = JSON.parse(seedText);
  const requested = [...new Set([...toeic, ...ielts, ...kaoyan].map(normalize).filter(Boolean))].sort();
  const requestedSet = new Set(requested);
  const confusables = {};
  for (const group of confusableSource.groups) {
    for (const word of group.terms.filter(term => requestedSet.has(term))) {
      const others = group.terms.filter(term => term !== word);
      for (const other of others) (confusables[word] ||= []).push({ word: other, difference: group.difference, source: 'wikipedia-misused-words' });
    }
  }
  const entries = {};
  let cursor = 0;
  const workers = Array.from({ length: 24 }, async () => {
    const wordnet = new WordNet(WORDNET_DIR);
    while (cursor < requested.length) {
      const word = requested[cursor++];
      const wordnetRelations = await wordNetRelations(wordnet, word);
      const supplemental = seed.entries[word];
      const supplementalRelations = Object.fromEntries(Object.entries(supplemental?.relations || {}).map(([key,items])=>[key,items.map(item=>({...item,source:item.source||'wiktionary-seed'}))]));
      const relations = mergeRelations(mergeRelations(wordnetRelations || {}, supplementalRelations), { confusables: confusables[word] || [] });
      if (!Object.keys(relations).length) continue;
      entries[word] = {
        sources: [
          ...(wordnetRelations ? ['https://wordnet.princeton.edu/'] : []),
          ...(supplemental ? [supplemental.source] : []),
          ...(confusables[word]?.length ? [CONFUSABLES_URL] : [])
        ],
        relations
      };
    }
    wordnet.close();
  });
  await Promise.all(workers);

  const grouped = {};
  for (const [word, entry] of Object.entries(entries)) (grouped[shardKey(word)] ||= {})[word] = entry;
  const shards = {};
  for (const key of Object.keys(grouped).sort()) {
    const body = `${JSON.stringify({ version: VERSION, entries: grouped[key] })}\n`;
    const filename = `english-relations-${key}.json`;
    await writeFile(new URL(filename, DATA_DIR), body, 'utf8');
    shards[key] = { file: `data/${filename}`, count: Object.keys(grouped[key]).length, bytes: Buffer.byteLength(body), sha256: sha256(body) };
  }

  const familyCount = Object.values(entries).filter(item => item.relations.family?.length).length;
  const synonymCount = Object.values(entries).filter(item => item.relations.synonyms?.length).length;
  const confusableCount = Object.values(entries).filter(item => item.relations.confusables?.length).length;
  const totals = Object.values(entries).reduce((sum,item)=>{for(const key of ['family','synonyms','confusables'])sum[key]+=(item.relations[key]||[]).length;return sum},{family:0,synonyms:0,confusables:0});
  const sourceRelationCount=(source,key)=>Object.values(entries).reduce((sum,item)=>sum+(item.relations[key]||[]).filter(relation=>relation.source===source).length,0);
  const manifest = {
    version: VERSION,
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    coverage: {
      requestedUniqueWords: requested.length,
      matchedWords: Object.keys(entries).length,
      wordsWithFamily: familyCount,
      wordFamilyRelations: totals.family,
      wordsWithSynonyms: synonymCount,
      synonymRelations: totals.synonyms,
      wordsWithConfusables: confusableCount,
      confusableRelations: totals.confusables,
      wordsWithoutRelations: requested.length-Object.keys(entries).length,
      note: 'Only source-backed relations are included; unavailable relation groups remain hidden.'
    },
    sources: [
      { id: 'wordnet-3.0', name: 'Princeton WordNet 3.0', url: 'https://wordnet.princeton.edu/', license: 'WordNet License', attribution: 'Princeton University', redistribution: true },
      { id: 'wiktionary-seed', name: 'English Wiktionary supplemental seed', url: seed.source, license: seed.license, attribution: seed.attribution, redistribution: true },
      { id: 'wikipedia-misused-words', name: 'Wikipedia: List of commonly misused English words', url: CONFUSABLES_URL, license: 'CC BY-SA 4.0', attribution: 'Wikipedia contributors', redistribution: true, revision: confusableSource.revision }
    ],
    sourceContributions: {
      wordnet: { words: Object.values(entries).filter(item=>item.sources.includes('https://wordnet.princeton.edu/')).length, familyRelations: sourceRelationCount('wordnet-3.0','family'), synonymRelations: sourceRelationCount('wordnet-3.0','synonyms') },
      wiktionarySeed: { words: Object.values(entries).filter(item=>item.sources.some(source=>source.startsWith('https://en.wiktionary.org/'))).length, relations: ['family','synonyms','collocations','confusables'].reduce((sum,key)=>sum+sourceRelationCount('wiktionary-seed',key),0) },
      wikipediaConfusables: { words: confusableCount, relations: sourceRelationCount('wikipedia-misused-words','confusables') }
    },
    shards
  };
  await writeFile(new URL('english-word-relations.json', DATA_DIR), `${JSON.stringify(manifest)}\n`, 'utf8');
  console.log(`Generated ${Object.keys(entries).length}/${requested.length} English relation entries in ${Object.keys(shards).length} shards.`);
  console.log(`${familyCount} words have family relations; ${synonymCount} have synonyms.`);
  console.log(`${confusableCount} words have ${totals.confusables} source-backed confusable relations.`);
}

await main();
