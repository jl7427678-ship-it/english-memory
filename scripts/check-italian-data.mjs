import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
function assert(condition, message) { if (!condition) throw new Error(message); }
async function raw(path) { return readFile(new URL(path, ROOT), 'utf8'); }

const manifest = JSON.parse(await raw('data/italian-manifest.json'));
assert(manifest.sources.some(source => source.license.includes('CC BY-SA')), 'Italian sources must include explicit licenses');
const full = [];
const core = [];
for (const chunkMeta of manifest.full.chunks) {
  const chunkRaw = await raw(chunkMeta.file);
  assert(createHash('sha256').update(chunkRaw).digest('hex') === chunkMeta.sha256, `${chunkMeta.file} checksum mismatch`);
  const chunk = JSON.parse(chunkRaw);
  assert(chunk.version === manifest.version, `${chunkMeta.file} version mismatch`);
  assert(chunk.words.length === chunkMeta.count, `${chunkMeta.file} count mismatch`);
  full.push(...chunk.words);
  if (manifest.core.chunks.some(item => item.file === chunkMeta.file)) core.push(...chunk.words);
}
assert(manifest.core.chunks.length > 0, 'Italian Core has no static chunks');
assert(manifest.core.chunks.every((item, index) => item.file === manifest.full.chunks[index].file), 'Italian Core chunks must be the ranked Full prefix');
assert(core.length === manifest.core.count && core.length === 4000, `Expected 4000 Italian Core words, got ${core.length}`);
assert(full.length === manifest.full.count, 'Italian Full count mismatch');
const seen = new Set();
full.forEach((item, index) => {
  const key = item.word.normalize('NFC').toLocaleLowerCase('it');
  assert(item.word && /[\u3400-\u9fff]/.test(item.meaning), `Italian word ${index} lacks Chinese meaning`);
  assert(!seen.has(key), `Duplicate Italian word: ${item.word}`);
  assert(Number.isInteger(item.rank) && item.rank > 0, `Italian word ${item.word} lacks rank`);
  seen.add(key);
});
assert(core.every((item, index) => item.word === full[index].word), 'Italian Core is not the ranked prefix of Full');
assert(JSON.parse(await raw(manifest.core.chunks[0].file)).speechLang === 'it-IT', 'Italian Core TTS language is not it-IT');
const [app2, app3, app4, worker, ui] = await Promise.all([raw('app-2.js'), raw('app-3.js'), raw('app-4.js'), raw('service-worker.js'), raw('ui.html')]);
assert(app2.includes("projectId:'italiano'") && app2.includes("speechLang:'it-IT'"), 'Italian decks are not registered with it-IT TTS');
assert(app3.includes("meta.kind==='static-italian'") && app3.includes('fetchStaticItalian'), 'Italian static adapter is missing');
assert(app3.includes("progressKey(deck.id,w.word)"), 'Italian progress is not isolated by deckId|word');
assert(app4.includes("speak(w.word,{lang:d.speechLang})"), 'Italian automatic TTS does not use the deck language');
assert(ui.includes('id="italianoCourseShelf"'), 'Italiano Learning Library entry is missing');
assert(worker.includes('data/italian-manifest.json') && !worker.includes('data/italian-core.json') && !worker.includes('data/italian-full-01.json'), 'Italian data cache policy is incorrect');
console.log(`Validated Italian Core ${core.length} and Full ${full.length} (${manifest.full.chunks.length} shared chunks).`);
