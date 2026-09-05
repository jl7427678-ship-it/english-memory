import {readFile} from 'node:fs/promises';
const ROOT=new URL('../',import.meta.url),read=path=>readFile(new URL(path,ROOT),'utf8');const [app12,app14,ui,worker]=await Promise.all([read('app-12.js'),read('app-14.js'),read('ui.html'),read('service-worker.js')]);function assert(value,message){if(!value)throw new Error(message)}
for(const feature of ['getPrivateBlob','replayWrongAudio','MediaRecorder','getUserMedia','setupRecognition','skillsDictationPlay','speak(sentence,{userInitiated:true})'])assert(app14.includes(feature),`English skill feature missing: ${feature}`);
assert(app12.includes('audio:question.audio'),'Wrong listening questions do not retain their local audio reference');
assert(app14.includes('URL.revokeObjectURL')&&app14.includes("getTracks().forEach"),'Temporary audio resources are not released');
assert(!app14.includes('putPrivateBlob')&&!app14.includes('localStorage.setItem'),'Speaking recordings are persisted unexpectedly');
assert(app14.includes('audio.ontimeupdate')&&!app14.match(/ontimeupdate[^\n]*save\(/),'Wrong-audio replay writes timeupdate progress');
for(const label of ['听 · Listening','说 · Speaking','读 · Reading','写 · Writing'])assert(ui.includes(label),`Skills hub section missing: ${label}`);
assert(!worker.match(/\.(?:mp3|m4a|wav)'/i),'Audio was added to Service Worker precache');
console.log('Validated listening/dictation/replay, speech recognition, memory-only recording, reading, and writing entrypoints.');
