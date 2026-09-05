import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, ROOT), 'utf8');
const [app1, app5, app6, worker] = await Promise.all([
  read('app-1.js'), read('app-5.js'), read('app-6.js'), read('service-worker.js')
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const runtime = [app1, app5, app6].join('\n');
assert((runtime.match(/localStorage\.setItem\(/g) || []).length === 1, 'localStorage writes must be centralized');
assert(app1.includes('STATE_WRITE_MIN_INTERVAL=5000'), 'state write coalescing is missing');
assert(app1.includes("addEventListener('pagehide',()=>persistStateNow())"), 'pagehide state flush is missing');
assert(app6.includes('setTimeout(()=>saveCourseDraft(question,false),800)'), 'course draft debounce is missing');
assert(app5.includes("crypto.subtle.digest('SHA-256',buffer)"), 'SHA-256 import deduplication is missing');
assert(app5.includes('retained:false'), 'parsed documents must record that the original file was not retained');
assert(!runtime.includes('setInterval('), 'runtime contains a periodic interval; verify it does not write storage');
assert(!runtime.includes('timeupdate'), 'runtime contains audio timeupdate persistence');
assert(!/['"`]\.\/?[^'"`]+\.(?:pdf|mp3|wav|m4a)['"`]/i.test(worker), 'large document/audio file found in Service Worker precache');

console.log('Validated coalesced state writes, debounced drafts, SHA-256 dedupe, and large-file cache exclusions.');
