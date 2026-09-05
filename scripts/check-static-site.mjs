import { access, readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function source(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

async function exists(path) {
  await access(new URL(path, ROOT));
}

const [index, boot, app, app2, app3, app4, app6, worker] = await Promise.all([
  source('index.html'), source('boot.js'), source('app.js'), source('app-2.js'), source('app-3.js'), source('app-4.js'), source('app-6.js'), source('service-worker.js')
]);

for (const file of ['ui.html', 'app.js', 'app-1.js', 'app-2.js', 'app-3.js', 'app-4.js', 'app-5.js', 'app-6.js', 'app-7.js', 'app-8.js', 'app-9.js', 'data/preqin-literature.json']) {
  await exists(file);
}

assert(index.includes('boot.js?v=20260905-13'), 'index.html does not load the current boot.js version');
assert(index.includes('styles.css?v=20260905-13') && index.includes('theme.css?v=20260905-13'), 'stylesheet versions are inconsistent');
assert(boot.includes("ui.html?v=20260905-13") && boot.includes("app.js?v=20260905-13"), 'boot.js resource versions are inconsistent');
assert(app.includes("src+'?v=20260905-13'") && app.includes("'app-9.js'"), 'split application scripts are not on the current version');
assert(!app.includes('vocab-patch.js'), 'The retired vocabulary patch is still loaded');
assert(app2.includes('/vocabularies/ielts_core.json'), 'IELTS does not use the verified ielts_core.json URL');
assert(app2.includes("manifest:'data/toeic-manifest.json'"), 'TOEIC does not use the same-origin manifest');
assert(!app3.includes('huggingface.co') && !app3.includes('datasets-server'), 'Runtime code still downloads TOEIC from Hugging Face');
assert(app3.includes("progressKey(deck.id,w.word)"), 'Built-in progress key contract changed');
assert(worker.includes("{ignoreSearch:true}"), 'Offline cache does not ignore version query strings');
assert(worker.includes("CACHE='english-memory-lab-v5-ui-20260905-13'") && worker.includes('app-9.js'), 'Service Worker cache version was not bumped');
for (const mascot of ['hello', 'thinking', 'celebrate', 'active', 'reading', 'rest']) await exists(`assets/mascot/wanwang-${mascot}.webp`);
assert(worker.includes('wanwang-hello.webp') && worker.includes('wanwang-celebrate.webp'), 'Active mascot states are not cached for offline use');
assert(worker.includes('data/preqin-literature.json') && worker.includes('app-6.js'), 'Question Engine assets are not cached for offline use');
assert(app6.includes('course.allowedTypes'), 'Question Engine does not read project-specific allowed question types');
assert(app2.includes("addEventListener('voiceschanged',refreshSpeechVoices)"), 'TTS voice loading compatibility is missing');
assert(app2.includes("{userInitiated:true}"), 'Manual TTS actions are not marked as user initiated');
assert(!app4.includes('setTimeout(()=>speak('), 'Vocabulary auto-read still loses the user gesture through setTimeout');

const manifest = JSON.parse(await source('data/toeic-manifest.json'));
await exists(manifest.core.file);
for (const chunk of manifest.full.chunks) await exists(chunk.file);

console.log('Validated static entrypoints, vocabulary sources, cache fallback, and progress-key compatibility.');
