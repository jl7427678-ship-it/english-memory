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

const [index, boot, app, app2, app3, app4, app5, app6, ui, worker, kokoroSpeech, kokoroWorker] = await Promise.all([
  source('index.html'), source('boot.js'), source('app.js'), source('app-2.js'), source('app-3.js'), source('app-4.js'), source('app-5.js'), source('app-6.js'), source('ui.html'), source('service-worker.js'), source('kokoro-speech.js'), source('kokoro-worker.js')
]);

for (const file of ['ui.html', 'app.js', 'app-1.js', 'kokoro-speech.js', 'kokoro-worker.js', 'app-2.js', 'app-3.js', 'app-4.js', 'app-5.js', 'app-6.js', 'app-7.js', 'app-8.js', 'app-9.js', 'app-10.js', 'app-11.js', 'app-12.js', 'app-13.js', 'app-14.js', 'app-15.js', 'app-16.js', 'app-17.js', 'app-18.js', 'app-19.js', 'app-20.js', 'app-21.js', 'app-22.js', 'app-23.js', 'app-24.js', 'ielts-full-exam.css', 'data/preqin-literature.json', 'data/exam-practice.json', 'data/ielts-atlas-manifest.json', 'data/ielts-custom-manifest.json', 'data/ielts-speaking-2026-09.json', 'data/italian-manifest.json', 'data/italian-course.json', 'THIRD_PARTY_NOTICES.md']) {
  await exists(file);
}

assert(index.includes('boot.js?v=20260930-42'), 'index.html does not load the current boot.js version');
assert(index.includes('styles.css?v=20260930-42') && index.includes('theme.css?v=20260930-42') && index.includes('ielts-full-exam.css?v=20260930-42'), 'stylesheet versions are inconsistent');
assert(boot.includes("ui.html?v=20260930-42") && boot.includes("app.js?v=20260930-42"), 'boot.js resource versions are inconsistent');
assert(app.includes("src+'?v=20260930-42'") && app.includes("'kokoro-speech.js'") && app.includes("'app-24.js'"), 'split application scripts are not on the current version');
assert(!app.includes('vocab-patch.js'), 'The retired vocabulary patch is still loaded');
assert(app2.includes('/vocabularies/ielts_core.json'), 'IELTS does not use the verified ielts_core.json URL');
assert(app2.includes("manifest:'data/toeic-manifest.json'"), 'TOEIC does not use the same-origin manifest');
assert(!app3.includes('huggingface.co') && !app3.includes('datasets-server'), 'Runtime code still downloads TOEIC from Hugging Face');
assert(app3.includes("progressKey(deck.id,w.word)"), 'Built-in progress key contract changed');
assert(worker.includes("{ignoreSearch:true}"), 'Offline cache does not ignore version query strings');
assert(worker.includes("CACHE='english-memory-lab-v5-ui-20260930-47'") && worker.includes('kokoro-speech.js') && worker.includes('kokoro-worker.js') && worker.includes('app-24.js') && worker.includes('ielts-full-exam.css') && worker.includes('data/ielts-atlas-manifest.json') && worker.includes('data/ielts-speaking-2026-09.json') && worker.includes('data/italian-manifest.json'), 'Service Worker cache version was not bumped');
assert(kokoroWorker.includes("dtype:'q8'") && kokoroWorker.includes("device:'wasm'") && kokoroWorker.includes('splitText'), 'Kokoro worker is missing tablet-safe inference or long-text chunking');
assert(kokoroSpeech.includes('AudioContext') && kokoroSpeech.includes('voiceOptions'), 'Kokoro playback or voice selection is missing');
assert(kokoroSpeech.includes('unlockAudio') && app2.includes('speechChunks') && app2.includes('systemVoice'), 'Tablet audio unlock or lightweight long-form speech is missing');
assert(app2.includes("$('#speakDocument')") && ui.includes('id="speakDocument"') && ui.includes('id="stopSpeech"'), 'Whole-document speech controls are missing');
assert(app5.includes('id="speechEngine"') && app5.includes('id="systemVoice"') && app5.includes('id="kokoroVoice"') && app5.includes('试听整句'), 'Speech engine or voice settings are incomplete');
assert(!worker.includes('Kokoro-82M-v1.0-ONNX'), 'Large Kokoro model must not be precached by the site Service Worker');
assert(!worker.includes('data/italian-core.json') && !worker.includes('data/italian-full-01.json'), 'Italian word data must remain on-demand, not precached');
for (const mascot of ['hello', 'thinking', 'celebrate', 'active', 'reading', 'rest']) await exists(`assets/mascot/wanwang-${mascot}.webp`);
assert(worker.includes('wanwang-hello.webp') && worker.includes('wanwang-celebrate.webp'), 'Active mascot states are not cached for offline use');
assert(worker.includes('data/preqin-literature.json') && worker.includes('app-6.js'), 'Question Engine assets are not cached for offline use');
assert(app6.includes('course.allowedTypes'), 'Question Engine does not read project-specific allowed question types');
assert(app2.includes("addEventListener('voiceschanged',voicesChanged)"), 'TTS voice loading compatibility is missing');
assert(app2.includes("{userInitiated:true}"), 'Manual TTS actions are not marked as user initiated');
assert(!app4.includes('setTimeout(()=>speak('), 'Vocabulary auto-read still loses the user gesture through setTimeout');

const manifest = JSON.parse(await source('data/toeic-manifest.json'));
await exists(manifest.core.file);
for (const chunk of manifest.full.chunks) await exists(chunk.file);

console.log('Validated static entrypoints, vocabulary sources, cache fallback, and progress-key compatibility.');
