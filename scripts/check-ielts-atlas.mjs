import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('data/ielts-atlas-manifest.json', ROOT), 'utf8'));
const app = await readFile(new URL('app-15.js', ROOT), 'utf8');
const worker = await readFile(new URL('service-worker.js', ROOT), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(manifest.source.repository === 'https://github.com/sallowayma-git/IELTS-practice', 'Atlas repository attribution changed');
assert(/^[0-9a-f]{40}$/.test(manifest.source.commit), 'Atlas source must be pinned to a commit');
assert(manifest.stats.examCount === 234 && manifest.exams.length === 234, 'Atlas exam count changed unexpectedly');
assert(manifest.stats.passageCount === 234, 'Atlas passage count changed unexpectedly');
assert(manifest.stats.questionCount === 3143, 'Atlas answer-field count changed unexpectedly');
assert(manifest.stats.explanationCount === 227, 'Atlas explanation coverage changed unexpectedly');
assert(new Set(manifest.exams.map(exam => exam.id)).size === manifest.exams.length, 'Atlas exam ids are not unique');
for (const exam of manifest.exams) {
  assert(exam.examPath.startsWith('assets/generated/reading-exams/'), `Invalid Atlas exam path: ${exam.id}`);
  assert(exam.questionCount > 0, `Atlas exam has no answer key: ${exam.id}`);
}
assert(app.includes("ATLAS_MANIFEST_PATH='data/ielts-atlas-manifest.json'") && app.includes('fetch(ATLAS_MANIFEST_PATH'), 'Atlas manifest is not loaded on demand');
assert(app.includes('rawBase+path'), 'Atlas shards are not loaded from the pinned upstream source');
assert(!worker.match(/reading-exams\/p\d/i), 'Atlas question shards must not be precached');
assert(worker.includes('data/ielts-atlas-manifest.json'), 'Atlas manifest is missing from PWA core cache');

console.log(`Validated IELTS Atlas adapter: ${manifest.stats.examCount} exams, ${manifest.stats.questionCount} answer fields, ${manifest.stats.explanationCount} explanations.`);
