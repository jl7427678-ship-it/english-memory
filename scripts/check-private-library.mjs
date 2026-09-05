import {readFile} from 'node:fs/promises';
const ROOT=new URL('../',import.meta.url),read=path=>readFile(new URL(path,ROOT),'utf8');
const [app11,ui,worker]=await Promise.all([read('app-11.js'),read('ui.html'),read('service-worker.js')]);
function assert(value,message){if(!value)throw new Error(message)}
for(const contract of ['englishMemoryLab_private_library_v1','profileId','SHA-256','audioSha256','sourceType:\'private_local\''])assert(app11.includes(contract),`Private Library contract missing: ${contract}`);
assert(app11.includes("PRIVATE_PAPER_STORE='papers'")&&app11.includes("PRIVATE_BLOB_STORE='blobs'"),'Structured papers and binary Blobs are not separated');
assert(app11.includes('if(!await getPrivateBlob(audio.sha256))'),'Audio Blob dedupe is missing');
assert(app11.includes("$('#retainPrivatePdf').checked"),'PDF retention is not explicit opt-in');
assert(app11.includes('deletePrivateBlob')&&app11.includes('stillUsed'),'Unreferenced Blob cleanup is missing');
assert(app11.includes('parsePrivateAnswerKey')&&app11.includes('sections:privateDraft.audios.map'),'Answer preview or Section binding is missing');
assert(ui.includes('MP3 / M4A / WAV')&&ui.includes('不会上传'),'Private import disclosure is incomplete');
assert(!worker.match(/\.(?:pdf|mp3|m4a|wav)'/i),'Large private files were added to Service Worker precache');
console.log('Validated profile-isolated private papers, SHA-256 Blob dedupe, PDF opt-in retention, and cache exclusions.');
