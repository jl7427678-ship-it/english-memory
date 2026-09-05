import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const runtimeFiles = ['app-1.js', 'app-2.js', 'app-3.js', 'app-4.js', 'app-5.js'];
const ui = await readFile(new URL('ui.html', ROOT), 'utf8');
const runtime = (await Promise.all(runtimeFiles.map(file => readFile(new URL(file, ROOT), 'utf8')))).join('\n');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function matches(source, pattern) {
  return [...source.matchAll(pattern)].map(match => match[1]);
}

const staticIds = matches(ui, /\bid="([^"]+)"/g);
const duplicateIds = staticIds.filter((id, index) => staticIds.indexOf(id) !== index);
assert(!duplicateIds.length, `Duplicate UI ids: ${[...new Set(duplicateIds)].join(', ')}`);

const declaredIds = new Set([...staticIds, ...matches(runtime, /\bid=["']([^"']+)["']/g)]);
const selectedIds = new Set(matches(runtime, /\$\('#([A-Za-z0-9_-]+)'\)/g));
const missingSelectors = [...selectedIds].filter(id => !declaredIds.has(id));
assert(!missingSelectors.length, `Runtime selectors without matching UI: ${missingSelectors.join(', ')}`);

const pages = new Set(matches(ui, /\bid="page-([^"]+)"/g));
const pageTargets = new Set([
  ...matches(ui, /\bdata-page="([^"]+)"/g),
  ...matches(ui, /\bdata-go-page="([^"]+)"/g)
]);
const missingPages = [...pageTargets].filter(page => !pages.has(page));
assert(!missingPages.length, `Navigation targets without pages: ${missingPages.join(', ')}`);

for (const page of ['today', 'library', 'training', 'plan', 'me', 'study', 'vocab', 'exam', 'review', 'stats', 'settings']) {
  assert(pages.has(page), `Required page is missing: ${page}`);
}
for (const label of ['TOEIC 背词', 'TOEIC 串题', 'Italiano', '考研政治', '汉语言', '土地资源管理']) {
  assert(runtime.includes(label), `Today project is missing: ${label}`);
}
assert(ui.includes('🔊 朗读') && ui.includes('🎙️ 语音识别'), 'TTS and speech recognition are not clearly distinguished');

console.log(`Validated ${staticIds.length} unique UI ids, ${pages.size} pages, and all navigation targets.`);
