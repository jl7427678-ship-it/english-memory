import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const bank=JSON.parse(read('data/ielts-custom-open.json'));
const manifest=JSON.parse(read('data/ielts-custom-manifest.json'));
const speaking=JSON.parse(read('data/ielts-speaking-2026-09.json'));
const mock=manifest.mocks[0],nodes=new Map(),storage=new Map(),events=[];
const node=selector=>{
  if(!nodes.has(selector)){
    const el={dataset:{},value:'',textContent:'',hidden:false,disabled:false,onclick:null,oninput:null,querySelector(){return null},querySelectorAll(){return []},setAttribute(){},focus(){},style:{setProperty(){}},classes:new Set()};
    el.classList={add:name=>el.classes.add(name),remove:name=>el.classes.delete(name),toggle:(name,on)=>on?el.classes.add(name):el.classes.delete(name)};
    Object.defineProperty(el,'innerHTML',{get(){return this.html||''},set(html){this.html=html;for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))node('#'+id);if(selector==='#ieltsFullNavigator'){
      for(const [,index] of html.matchAll(/data-ielts-full-index="(\d+)"/g)){const btn=node('[data-ielts-full-index="'+index+'"]');btn.dataset.ieltsFullIndex=index}
      for(const [,key] of html.matchAll(/data-ielts-writing="([^"]+)"/g)){const btn=node('[data-ielts-writing="'+key+'"]');btn.dataset.ieltsWriting=key}
    }}});nodes.set(selector,el);
  }
  return nodes.get(selector);
};
const select=selector=>selector==='[data-ielts-full-index]'?[...nodes.entries()].filter(([k])=>k.startsWith('[data-ielts-full-index="')).map(([,v])=>v):selector==='[data-ielts-writing]'?[...nodes.entries()].filter(([k])=>k.startsWith('[data-ielts-writing="')).map(([,v])=>v):[];
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const context=createContext({
  state:{examEngine:{}},window:{addEventListener(){},speechSynthesis:true},sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  $:selector=>selector.endsWith(' audio')?null:node(selector),$$:select,esc,customOpen:bank,customManifest:manifest,customSpeaking:speaking,customWork:null,
  customMock:id=>manifest.mocks.find(x=>x.id===id),customMockReady:m=>m?.status==='ready',customListening:id=>bank.listening.find(x=>x.id===id),customReading:id=>bank.reading.find(x=>x.id===id),
  normalizeExamQuestion:q=>q,isObjectiveAnswerCorrect:(q,answer)=>q.answer.includes(answer),
  save(){events.push('save')},nav(page){events.push('nav:'+page)},toast(msg){events.push('toast:'+msg)},confirm(){events.push('confirm');return true},
  loadIeltsCustom:async()=>{},setInterval:()=>1,clearInterval(){},setTimeout(){},
  speechSynthesis:{cancel(){events.push('audio:stop')},speak(){events.push('audio:play')}},SpeechSynthesisUtterance:class {constructor(text){this.text=text}},
});
const app=read('app-23.js'),full=read('app-24.js');
runInContext(app.slice(app.indexOf('function customAnswerVariants('),app.indexOf('function startCustomExam('))+app.slice(app.indexOf('function buildCustomExamQuestions('),app.indexOf('function renderCustomReadingLayout('))+app.slice(app.indexOf('const customColors='),app.indexOf('function openCustomWork('))+app.slice(app.indexOf('function openCustomWork('),app.indexOf("window.addEventListener('pagehide'")),context);
runInContext(full,context);
const call=code=>runInContext(code,context);
const session=()=>context.state.examEngine.ieltsFullSession;
const html=()=>[...nodes.values()].map(el=>el.innerHTML).join('\n');
const render=async()=>{await call('renderIeltsFullExam()')};
call("startIeltsFullMock('mock_01')");await render();
assert.equal(session().section,'listening');assert.equal(storage.get('ieltsFullActive'),'mock_01');
const start=session().deadline;
const parts=new Set();
for(let i=0;i<40;i++){
  node('[data-ielts-full-index="'+i+'"]').onclick();
  assert(html().includes('Question '+(i+1)+' / 40'));
  const q=context.buildCustomExamQuestions('listening',bank.listening.find(x=>x.id===mock.listeningId))[i];
  parts.add(q.section.match(/Part \d/)[0]);
  assert(html().includes('Listening · '+q.section.match(/Part \d/)[0]));
  node('#ieltsFullAnswer').oninput({target:{value:'candidate-'+(i+1)}});
  assert.equal(session().answers.listening[q.id],'candidate-'+(i+1));
  assert(node('[data-ielts-full-index="'+i+'"]').classes.has('answered'));
  if(i===0){node('#ieltsFullPlay').onclick();assert(events.includes('audio:play'))}
}
assert.equal(parts.size,4);assert(!/ANSWERSECRET|EXPLANATIONSECRET|Transcript:/i.test(html()));
session().indices.listening=21;const saved=JSON.parse(JSON.stringify(session()));
const restoredEvents=[];
const reloaded=createContext({...context,state:{examEngine:{ieltsFullSession:saved}},nav:page=>restoredEvents.push(page)});
runInContext(full,reloaded);
assert.deepEqual(restoredEvents,['ielts-full-exam']);
assert.equal(reloaded.state.examEngine.ieltsFullSession.deadline,start);
context.state.examEngine.ieltsFullSession=saved;nodes.clear();await render();
assert.equal(session().indices.listening,21);assert.equal(session().deadline,start);assert.equal(Object.keys(session().answers.listening).length,40);
assert(html().includes('Question 22 / 40'));assert.equal(storage.get('ieltsFullActive'),'mock_01');
node('#ieltsFullExit').onclick();assert.equal(node('#ieltsFullModal').hidden,false);node('#ieltsFullConfirm').onclick();assert(events.includes('nav:ielts-custom'));assert(!storage.has('ieltsFullActive'));
call("startIeltsFullMock('mock_01')");await render();assert.equal(session().deadline,start);
node('#ieltsFullSubmit').onclick();node('#ieltsFullConfirm').onclick();await render();
assert.equal(session().section,'reading');assert.equal(session().deadline-session().startedAt>60*60000,true);
assert(!html().includes('Listening 0 / 40'));
const readingParts=new Set();
for(let i=0;i<40;i++){
  node('[data-ielts-full-index="'+i+'"]').onclick();
  const q=context.buildCustomExamQuestions('reading',bank.reading.find(x=>x.id===mock.readingId))[i];
  readingParts.add(q.section.match(/Part \d/)[0]);
  assert(html().includes('Question '+(i+1)+' / 40'));
  assert(node('#ieltsFullSource').innerHTML.includes('exam-source-content'));
  node('#ieltsFullAnswer').oninput({target:{value:'candidate-'+(i+1)}});
  assert.equal(session().answers.reading[q.id],'candidate-'+(i+1));
}
assert.equal(readingParts.size,3);assert.equal(Object.keys(session().answers.reading).length,40);
assert(!html().includes('Reading 0 / 40'));
node('#ieltsFullSubmit').onclick();node('#ieltsFullConfirm').onclick();await render();assert.equal(session().section,'writing');
const deadline=session().deadline;
assert(node('#ieltsFullSource').innerHTML.includes(esc(bank.writingTask1.find(x=>x.id===mock.writingTask1Id).prompt).replaceAll('\n','<br>')));
assert(/<svg|<table|custom-process/.test(node('#ieltsFullSource').innerHTML));
node('#ieltsFullDraft').oninput({target:{value:'These figures change over time.'}});
assert.equal(node('#ieltsFullWordCount').textContent,'5 words');
node('[data-ielts-writing="writing2"]').onclick();
assert.equal(session().deadline,deadline);
node('#ieltsFullDraft').oninput({target:{value:'I believe education matters.'}});
node('[data-ielts-writing="writing1"]').onclick();assert(node('#ieltsFullQuestion').innerHTML.includes('These figures change over time.'));
node('[data-ielts-writing="writing2"]').onclick();assert(node('#ieltsFullQuestion').innerHTML.includes('I believe education matters.'));
assert(!/AI score|Band Score|范文|语法纠错/.test(node('#ieltsFullQuestion').innerHTML));
node('#ieltsFullSubmit').onclick();node('#ieltsFullConfirm').onclick();await render();
assert.equal(session().section,'finished');assert(!storage.has('ieltsFullActive'));
assert.match(node('#ieltsFullWorkspace').innerHTML,/Listening \d+ \/ 40/);
assert.match(node('#ieltsFullWorkspace').innerHTML,/Reading \d+ \/ 40/);
assert(node('#ieltsFullWorkspace').innerHTML.includes('Writing Saved'));
node('#ieltsFullSpeaking').onclick();call('renderIeltsCustomWork()');
const set=manifest.speakingSets[0],speakingHTML=node('#customWorkspace').innerHTML;
assert.equal(set.id,'S001');assert.equal(set.part1TopicIds.length,3);
assert.equal(speaking.part3.find(x=>x.id===set.part3GroupId).linkedPart2Id,set.part2CueCardId);
for(const id of set.part1TopicIds)assert(speakingHTML.includes(esc(speaking.part1.find(x=>x.id===id).title)));
assert(speakingHTML.includes(esc(speaking.part2.find(x=>x.id===set.part2CueCardId).prompt)));
assert(speakingHTML.includes(esc(speaking.part3.find(x=>x.id===set.part3GroupId).questions[0])));
assert(!speakingHTML.includes('导入 PDF'));
assert.equal(manifest.mocks.filter(x=>x.status==='ready').length,8);
assert.deepEqual([bank.listening.length,bank.reading.length,bank.writingTask1.length,bank.writingTask2.length,manifest.speakingSets.length],[8,9,38,42,30]);
console.log('Mock 01 interaction flow: Listening 40, Reading 40, Writing 2, Result, Speaking S001, recovery, exit, counts PASS');
