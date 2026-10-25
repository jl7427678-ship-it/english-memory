import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const examples=JSON.parse(read('data/vocab-dictation-examples.json'));
const source=read('vocab-dictation.js'),logic=source.slice(0,source.indexOf('const baseDictationCards='));
const listening=JSON.parse(read('data/ielts-listening-300.json'));
function harness(saved=null,cached=null){
 const nodes=new Map(),played=[],notices=[];let requests=0,saveCount=0;
 const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,style:{},focus(){},scrollIntoView(){}});return nodes.get(id)};
 $('#dictationDeck').value='ielts_listening_300';$('#dictationScope').value='weak-first';$('#dictationSize').value='10';
 const deck={id:'ielts_listening_300',title:'Listening 300',speechLang:'en-GB',words:listening.words.slice(0,12).map((word,i)=>({...word,id:'w'+i,correct:0,wrong:i===2?1:0,level:0,screenClass:i===2?'wrong':'new'}))};
 const state=saved||{vocab:{decks:[deck],progress:{'other|word':[1,2,3]},session:{phase:'screen',queue:['unchanged'],index:0}},settings:{}};
 const ctx={state,$,Date,URLSearchParams,location:{search:''},BUILTIN_VOCAB:{},builtinDeckCache:new Map(),vocabAdvanceTimer:null,clearTimeout(){},vocabExampleData:word=>({sentence:word.example||'',translation:word.exampleZh||'',source:word.exampleSource||''}),esc:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),primeSpeech(){},stopSystemSpeech(){},window:{},speak:(text,options)=>{played.push({text,options});return true},save:()=>{saveCount++},toast:text=>notices.push(text),console:{warn(){}},idbGetDeck:async()=>cached,idbPutDeck:async data=>{cached=data},fetchVocabJson:async()=>{requests++;return examples}};
 vm.createContext(ctx);vm.runInContext(logic,ctx);
 ctx.window.KokoroSpeech={prime(){},stop(){},getStatus:()=>({state:'ready',message:'已就绪'}),speak:async(text,options)=>{played.push({text,options});return true}};
 return {ctx,$,played,deck,get requests(){return requests},get savedExamples(){return cached},get saves(){return saveCount}};
}

const h=harness(),{ctx,$}=h;
assert.equal(examples.count,Object.keys(examples.entries).length);
for(const word of listening.words){
 const example=examples.entries[ctx.dictationNorm(word.word)];assert.ok(example,'missing '+word.word);
 const parts=ctx.dictationParts(example.sentence,word.word);assert.ok(parts?.some(part=>part.blank),'invalid cloze '+word.word);
 assert.ok(example.translation,'missing Chinese translation '+word.word);
}
assert.equal(ctx.dictationParts('Booking is different from overbooking.','book'),null,'no substring blanks');
assert.equal(ctx.dictationParts('A room is a room, not a classroom.','room').filter(part=>part.blank).length,2);
assert.equal(ctx.dictationAnswerMatches(' FIBER ','fibre'),true);
assert.equal(ctx.dictationAnswerMatches('fibr','fibre'),false);
assert.equal(ctx.dictationAnswerMatches('a   copy of','a copy of'),true);
const progress=JSON.stringify(ctx.state.vocab.progress),words=JSON.stringify(h.deck.words);
await ctx.startVocabDictation();
assert.equal(h.requests,1);assert.equal(ctx.dictationSession().initialCount,10);
assert.equal(ctx.dictationQuestion().word,h.deck.words[2].word,'weak words come first');
assert.ok(ctx.state.vocab.session.suspended,'existing choice session is preserved and paused');
assert.equal(ctx.state.vocab.session.queue[0],'unchanged');
assert.equal($('#dictationFeedback').hidden,true,'translation and answer stay hidden');
assert.match($('#dictationSentence').innerHTML,/dictation-input/);
ctx.state.settings.kokoroVoice='bf_emma';ctx.state.settings.speechRate=.85;
assert.equal(await ctx.playDictationSentence(),true);assert.equal(h.played.at(-1).text,ctx.dictationQuestion().sentence);assert.equal(h.played.at(-1).options.voice,'bf_emma');assert.equal(h.played.at(-1).options.speed,.85);
ctx.speak=()=>assert.fail('dictation must not fall back to device speech');
const originalSpeak=ctx.window.KokoroSpeech.speak;
ctx.window.KokoroSpeech.speak=async()=>{throw Error('请先完成第一步 Kokoro 断点下载')};
assert.equal(await ctx.playDictationSentence(),false);assert.match($('#dictationVoiceStatus').textContent,/准备按钮/);assert.equal(ctx.dictationSession().attempts,0);
let rejectStale;ctx.window.KokoroSpeech.speak=()=>new Promise((_,reject)=>{rejectStale=reject});
const stale=ctx.playDictationSentence();ctx.dictationStop();$('#dictationVoiceStatus').textContent='已停止';rejectStale(Error('old request failed'));assert.equal(await stale,false);assert.equal($('#dictationVoiceStatus').textContent,'已停止');
ctx.window.KokoroSpeech.speak=originalSpeak;
let voiceState='missing',downloads=0,prepared=0;
const originalStatus=ctx.window.KokoroSpeech.getStatus;
ctx.window.KokoroSpeech.getStatus=()=>({state:voiceState,message:voiceState});
ctx.window.KokoroSpeech.prepare=async()=>{prepared++;if(voiceState==='missing')throw Error('请先完成第一步 Kokoro 断点下载');voiceState='ready'};
ctx.window.KokoroSpeech.download=async()=>{downloads++;voiceState='downloaded'};
assert.equal(await ctx.prepareDictationVoice(),true);assert.equal(downloads,1);assert.equal(voiceState,'downloaded');assert.match($('#dictationPrepareVoice').textContent,/初始化/);
assert.equal(await ctx.prepareDictationVoice(),true);assert.equal(downloads,1);assert.equal(prepared,2);assert.equal(voiceState,'ready');
ctx.window.KokoroSpeech.prepare=async()=>{voiceState='error';throw Error('network unavailable')};
assert.equal(await ctx.prepareDictationVoice(),false);assert.match($('#dictationVoiceStatus').textContent,/network unavailable/);assert.equal($('#dictationPrepareVoice').disabled,false);
ctx.window.KokoroSpeech.getStatus=originalStatus;
$('#dictationInput').value='';ctx.checkVocabDictation();assert.equal(ctx.dictationSession().attempts,0,'empty answers are not marked wrong accidentally');
const target=ctx.dictationQuestion().word;$('#dictationInput').value='misspelled';ctx.checkVocabDictation();
assert.equal(ctx.dictationActive().stats[ctx.dictationNorm(target)].wrong,1);
assert.equal(ctx.dictationSession().queue.length,11,'wrong answer gets a later retry');
assert.equal($('#dictationFeedback').hidden,false);assert.ok($('#dictationFeedback').innerHTML.includes(ctx.dictationQuestion().sentence));
ctx.checkVocabDictation();assert.equal(ctx.dictationSession().attempts,1,'submission is idempotent');

// Refresh while viewing feedback: preserve the answer and do not mark it again.
const restored=harness(JSON.parse(JSON.stringify(ctx.state)),h.savedExamples);
await restored.ctx.startVocabDictation();assert.equal(restored.requests,0,'resume can work without network');
assert.equal(restored.ctx.dictationSession().answer.correct,false);assert.equal(restored.ctx.dictationSession().attempts,1);
restored.ctx.nextVocabDictation();
assert.equal(restored.ctx.dictationSession().index,1);assert.equal(restored.played.at(-1).text,restored.ctx.dictationQuestion().sentence);
while(restored.ctx.dictationQuestion()){
 restored.$('#dictationInput').value=restored.ctx.dictationQuestion().word;
 restored.ctx.checkVocabDictation();restored.ctx.nextVocabDictation();
}
assert.equal(restored.$('#dictationResult').hidden,false);
assert.equal(restored.ctx.dictationSession().attempts,11);
assert.equal(restored.ctx.dictationSession().correct,10);
assert.equal(JSON.stringify(ctx.state.vocab.progress),progress,'choice/cloud progress is untouched');
assert.equal(JSON.stringify(h.deck.words),words,'recognition counts and mastery are untouched');

// Starting a different group offline uses the cached example index, not a fresh download.
await restored.ctx.startVocabDictation(true);assert.equal(restored.requests,0);
const all=ctx.dictationCandidates(h.deck,'all'),weak=ctx.dictationCandidates(h.deck,'weak');assert.equal(all.length,12);assert.equal(weak.length,1);
const ui=read('ui.html');assert.match(ui,/dictationForm/);assert.match(ui,/现有云同步/);
assert.match(read('service-worker.js'),/vocab-dictation\.js/);assert.match(read('app.js'),/vocab-dictation\.js/);
console.log('PASS: '+examples.count+' sourced examples; 300/300 listening coverage; weak-word selection, full-sentence playback, exact blanks, spelling variants, hidden answers, retry, reload, offline cache and isolated progress.');
