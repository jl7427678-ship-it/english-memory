import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const messages=[],generated=[];
const ctx={Map,JSON,Number,String,Promise,Error,console,self:{},postMessage:message=>messages.push(message)};
vm.createContext(ctx);vm.runInContext(read('kokoro-worker.js'),ctx);
ctx.model={generate:async(text,options)=>{generated.push({text,...options});return {toBlob:()=>({size:12000,text})}}};
vm.runInContext('loadModel=async()=>model',ctx);
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
const send=data=>ctx.self.onmessage({data});
const first='The library closes at six.',second='Please bring your passport.';
send({type:'speak',id:1,text:first,voice:'af_heart',speed:.9,nextText:second});await flush();
assert.deepEqual(generated.map(item=>item.text),[first,second],'next sentence is generated once in the background');
assert.equal(messages.filter(item=>item.type==='audio').length,1,'prefetch never plays or reveals the next answer');
send({type:'cancel',id:2});send({type:'speak',id:3,text:first,voice:'af_heart',speed:.9});await flush();
assert.equal(generated.length,2,'replay survives stop and does not run inference');
assert.ok(messages.some(item=>item.type==='speech-start'&&item.id===3&&item.cached));
send({type:'speak',id:4,text:second,voice:'af_heart',speed:.9});await flush();
assert.equal(generated.length,2,'next question uses prefetched audio');
send({type:'speak',id:5,text:first,voice:'bf_emma',speed:.9});await flush();
send({type:'speak',id:6,text:first,voice:'bf_emma',speed:1.1});await flush();
assert.equal(generated.length,4,'voice and rate are part of the cache key');
for(let i=0;i<30;i++){send({type:'speak',id:10+i,text:`Sentence ${i}.`,voice:'af_heart',speed:1});await flush()}
assert.ok(vm.runInContext('audioCache.size<=24 && audioCacheBytes<=AUDIO_CACHE_BYTES',ctx),'bounded memory');

// A foreground cached replay must not wait behind an in-flight background generation.
let release;ctx.model.generate=(text)=>{generated.push({text});return new Promise(resolve=>{release=()=>resolve({toBlob:()=>({size:100,text})})})};
send({type:'speak',id:50,text:'Sentence 29.',voice:'af_heart',speed:1,nextText:'A slow future sentence.'});await flush();
assert.ok(release);const before=messages.length;
send({type:'cancel',id:51});send({type:'speak',id:52,text:'Sentence 29.',voice:'af_heart',speed:1});
assert.ok(messages.slice(before).some(item=>item.type==='audio'&&item.id===52),'cached playback bypasses background inference');
release();await flush();assert.ok(!messages.some(item=>item.type==='audio'&&item.id===50&&item.blob.text==='A slow future sentence.'),'cancelled prefetch stays silent');

// Main-thread duplicate clicks do not cancel or restart generation.
const workers=[],events=[];
const main={window:{dispatchEvent:event=>events.push(event.detail)},document:{addEventListener(){}},CustomEvent:function(name,options){this.detail=options.detail},caches:{open:async()=>({match:async()=>true})},Worker:class{constructor(){this.messages=[];workers.push(this)}postMessage(message){this.messages.push(message)}terminate(){}},console};
vm.createContext(main);vm.runInContext(read('kokoro-speech.js'),main);await flush();
const speech=main.window.KokoroSpeech;
const preparing=speech.prepare();await flush();workers[0].onmessage({data:{type:'ready'}});await preparing;
await speech.speak(first,{voice:'af_heart',speed:.9,nextText:second});
await speech.speak(first,{voice:'af_heart',speed:.9,nextText:second});
assert.equal(workers[0].messages.filter(message=>message.type==='speak').length,1);
const request=workers[0].messages.find(message=>message.type==='speak');assert.equal(request.nextText,second);
speech.stop();workers[0].onmessage({data:{type:'audio',id:request.id,blob:{}}});
assert.notEqual(speech.getStatus().state,'speaking','old audio ignored after Stop');
console.log('PASS: cached replay and next-question audio avoid repeat inference; background stays silent; voice/rate isolation, bounded cache, stop safety and duplicate-click protection.');
