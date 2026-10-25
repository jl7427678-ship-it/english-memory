import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const manifest=JSON.parse(read('data/ielts-listening-300-audio.json')),examples=JSON.parse(read('data/vocab-dictation-examples.json')),deck=JSON.parse(read('data/ielts-listening-300.json'));
assert.equal(manifest.count,300);assert.equal(manifest.voice,'af_heart');
let totalBytes=0;
for(const word of deck.words){
  const key=word.word.toLowerCase(),entry=manifest.entries[key];assert.ok(entry,'Missing '+key);
  assert.equal(entry.sentence,examples.entries[key].sentence,'audio matches the displayed example');
  const bytes=fs.readFileSync(new URL('../'+entry.file,import.meta.url));totalBytes+=bytes.length;
  assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);assert.ok(entry.duration>.5&&entry.duration<30);
  assert.equal(bytes[0],255);assert.equal(bytes[1]&224,224,'MP3 frame sync');
  // The fixed encoder writes MPEG-2 Layer III, 64 kbps, 24 kHz mono.
  for(let offset=0;offset<bytes.length;offset+=192){assert.equal(bytes[offset],255,'complete MP3 frame');assert.equal(bytes[offset+1]&254,242);assert.equal(bytes[offset+2]&252,132)}
}
assert.equal(manifest.totalBytes,totalBytes);
const fixture=word=>({word,sentence:manifest.entries[word].sentence});
const cachesMap=new Map(),network=[],played=[];
let offline=false,decodeGate=null,onEvent=()=>{},failSaving=false;
class Cache{
  constructor(){this.items=new Map()}
  async match(key){return this.items.get(typeof key==='string'?key:key.url)?.clone()}
  async put(key,response){if(failSaving)throw Error('QuotaExceededError');this.items.set(typeof key==='string'?key:key.url,response.clone())}
  async delete(key){return this.items.delete(typeof key==='string'?key:key.url)}
}
const caches={open:async name=>{if(!cachesMap.has(name))cachesMap.set(name,new Cache());return cachesMap.get(name)}};
class Context{
  state='running';
  resume(){this.state='running';return Promise.resolve()}
  async decodeAudioData(bytes){if(decodeGate)await decodeGate;return {length:bytes.byteLength}}
  createBufferSource(){return {playbackRate:{value:1},connect(){},start(){played.push(this)},stop(){this.stopped=true}}}
}
function harness(){
  const window={AudioContext:Context,dispatchEvent:event=>onEvent(event.detail)};
  const ctx={window,document:{baseURI:'https://test.local/english-memory/'},URL,Map,JSON,Number,String,Promise,Error,Array,Uint8Array,Response,crypto:webcrypto,caches,CustomEvent:function(name,options){this.detail=options.detail},fetch:async url=>{
    network.push(String(url));if(offline)throw Error('Offline');
    const name=new URL(url).pathname.replace('/english-memory/','');
    if(name==='data/ielts-listening-300-audio.json')return new Response(JSON.stringify(manifest),{headers:{'content-type':'application/json'}});
    const entry=Object.values(manifest.entries).find(entry=>entry.file===name);
    if(!entry)return new Response('Not found',{status:404});
    return new Response(fs.readFileSync(new URL('../'+entry.file,import.meta.url)),{headers:{'content-type':'audio/mpeg','content-length':String(entry.bytes)}});
  }};
  vm.createContext(ctx);vm.runInContext(read('dictation-audio.js'),ctx);return ctx.window.DictationAudio;
}
const audio=harness();await audio.load();
assert.ok(audio.entryFor(fixture('booking')));assert.equal(audio.entryFor({word:'booking',sentence:'Not this sentence.'}),null);
assert.equal(await audio.play(fixture('booking'),{speed:.9}),true);assert.equal(played.at(-1).playbackRate.value,1);
const downloaded=network.length;offline=true;
assert.equal(await audio.play(fixture('booking'),{speed:1.08}),true);assert.equal(network.length,downloaded,'cached first replay avoids network');assert.equal(played.at(-1).playbackRate.value,1.2);
audio.stop();assert.ok(played.at(-1).stopped);
offline=false;onEvent=detail=>{if(detail.downloading&&detail.cached===1)audio.cancelDownload()};
await audio.downloadAll();assert.equal(audio.getStatus().downloading,false);assert.match(audio.getStatus().message,/暂停/);
onEvent=()=>{};await audio.downloadAll();assert.equal(audio.getStatus().cached,300);
offline=true;const restored=harness();await restored.load();assert.equal(restored.getStatus().cached,300);
for(const word of ['reservation','conscience','guarantee'])assert.equal(await restored.play(fixture(word)),true,'offline playback '+word);
// Cancelling while a decode is pending must never start stale audio.
let release;decodeGate=new Promise(resolve=>release=resolve);const before=played.length;
const pending=restored.play(fixture('tenant'));await new Promise(resolve=>setImmediate(resolve));restored.stop();release();await pending;decodeGate=null;assert.equal(played.length,before);
const cache=await caches.open('english-memory-dictation-audio-v1'),entry=manifest.entries.booking,url='https://test.local/english-memory/'+entry.file;
await cache.put(url,new Response('bad audio',{headers:{'content-type':'audio/mpeg'}}));
const corrupted=harness();await corrupted.load();assert.equal(await corrupted.play(fixture('booking')),false,'corrupt offline audio is not played');
offline=false;assert.equal(await corrupted.play(fixture('booking')),true,'re-download repairs corrupt audio');
const worker=read('service-worker.js');assert.match(worker,/DICTATION_AUDIO_CACHE/);assert.match(worker,/Content-Range/);assert.ok(!worker.includes(manifest.entries.booking.file),'large audio pack is not automatically precached');
assert.match(read('app.js'),/'dictation-audio.js','vocab-dictation.js'/);
const sw={self:{location:{origin:'https://test.local'},addEventListener(){}},URL,Request,Response,caches,fetch:async()=>{throw Error('offline')}};
vm.createContext(sw);vm.runInContext(worker,sw);
const ranged=await sw.dictationAudioResponse(new Request(url,{headers:{Range:'bytes=0-191'}}),new URL(url));
assert.equal(ranged.status,206);assert.equal((await ranged.arrayBuffer()).byteLength,192);assert.equal(ranged.headers.get('content-range'),'bytes 0-191/'+entry.bytes);
const invalid=await sw.dictationAudioResponse(new Request(url,{headers:{Range:'bytes=9999999-'}}),new URL(url));assert.equal(invalid.status,416);
const suffix=await sw.dictationAudioResponse(new Request(url,{headers:{Range:'bytes=-192'}}),new URL(url));assert.equal((await suffix.arrayBuffer()).byteLength,192);
console.log('PASS: 300 complete MP3s ('+(totalBytes/1048576).toFixed(2)+' MB), exact sentence/hash checks, direct playback without a model, offline reload, resumable download, corrupt-file rejection, stop safety and voice-rate playback.');
