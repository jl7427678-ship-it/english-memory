import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app-2.js',import.meta.url),'utf8');
const nodes=new Map(),spoken=[],notices=[];let currentDoc={sentences:['First sentence.','Second sentence.'],text:'First sentence. Second sentence.'};
const $=key=>{if(!nodes.has(key))nodes.set(key,{});return nodes.get(key)};
const voices=[{voiceURI:'en',lang:'en-GB',localService:true,name:'English'},{voiceURI:'zh',lang:'zh-CN',localService:true,name:'Chinese'}];
const synth={getVoices:()=>voices,resume(){},cancel(){},speak:u=>spoken.push(u)};
let neuralStarts=0;
const neural={prime(){neuralStarts++},stop(){},speak(){neuralStarts++;throw Error('uncached model must not start for a single sentence')}};
const ctx={state:{study:{index:1},settings:{speechEngine:'piper',speechLang:'en-GB',speechRate:.9,systemVoice:'en'}},active:()=>currentDoc,$,document:{getElementById:()=>({classList:{contains:()=>false}})},window:{speechSynthesis:synth,dispatchEvent(){},PiperSpeech:neural,KokoroSpeech:neural},speechSynthesis:synth,SpeechSynthesisUtterance:function(text){this.text=text},CustomEvent:function(){},speechSupported:true,speechVoices:[],cachedSpeechVoice:null,cachedSpeechLang:'',speechGestureReady:false,speechRestartTimer:null,systemSpeechRun:0,clearTimeout(){},setTimeout(){throw Error('single-sentence playback must stay in the click gesture')},toast:message=>notices.push(message)};
vm.createContext(ctx);
for(const name of ['voiceQuality','refreshSpeechVoices','speechVoice','primeSpeech','speechChunks','stopSystemSpeech','systemSpeak','speechTextProfile','englishSpeechText','speak']){
 const line=source.split('\n').find(line=>line.startsWith('function '+name+'('));assert.ok(line,name);vm.runInContext(line,ctx);
}
vm.runInContext(source.split('\n').find(line=>line.startsWith("$('#speakSentence')")),ctx);
for(const engine of ['piper','kokoro','system']){
 ctx.state.settings.speechEngine=engine;$ ('#speakSentence').onclick();assert.equal(spoken.at(-1).text,'Second sentence.');assert.equal(spoken.at(-1).lang,'en-GB');
}
assert.equal(neuralStarts,0,'no model loading or download for the current sentence');
currentDoc={sentences:['工业革命推动城市的发展。']};ctx.state.study.index=99;$ ('#speakSentence').onclick();
assert.equal(spoken.at(-1).text,currentDoc.sentences[0]);assert.equal(spoken.at(-1).lang,'zh-CN');assert.equal(spoken.at(-1).voice.voiceURI,'zh','English preference must not override Chinese sentence voice');
currentDoc={sentences:['Learning takes practice. 学习需要练习。']};ctx.state.study.index=0;$ ('#speakSentence').onclick();
assert.match(spoken.at(-1).text,/Learning takes practice\./);assert.doesNotMatch(spoken.at(-1).text,/[学习需要练]/);
currentDoc={sentences:['A sentence that can be repeated.']};$ ('#speakSentence').onclick();$ ('#stopSpeech').onclick();$ ('#speakSentence').onclick();
assert.equal(spoken.at(-1).text,currentDoc.sentences[0]);
currentDoc=null;$ ('#speakSentence').onclick();assert.match(notices.at(-1),/选择背诵资料/);
assert.equal(neuralStarts,0);
console.log('PASS: current sentence only, English/Chinese/mixed text, correct language voice, no model download or deferred click, stop/replay and empty-document feedback. Audio device output requires device testing.');
