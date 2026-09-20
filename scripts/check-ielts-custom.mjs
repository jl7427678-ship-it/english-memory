import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {parseSpeakingBank} from '../speaking-bank-parser.mjs';

const read=name=>JSON.parse(readFileSync(new URL(`../data/${name}`,import.meta.url),'utf8'));
const bank=read('ielts-custom-open.json'),manifest=read('ielts-custom-manifest.json'),speaking=read('ielts-speaking-2026-09.json');
assert.equal(bank.listening.length,8);
assert.equal(bank.reading.length,9);
assert.equal(bank.writingTask1.length,38);
assert.equal(bank.writingTask2.length,42);
const present=(list,id)=>list.some(item=>item.id===id);
for(const item of bank.listening){
  assert.equal(item.parts.length,4);assert.deepEqual(item.parts.flatMap(part=>part.questions.map(q=>q.number)),Array.from({length:40},(_,i)=>i+1));
  assert(item.parts.every(part=>part.questions.length===10&&part.questions.every(q=>q.answer?.length)));
  if(item.id!=='L018')assert(item.parts.flatMap(p=>p.questions).filter(q=>['multiple_choice','matching'].includes(q.type)).every(q=>q.instruction&&Object.keys(q.options||{}).length>=2));
  if(item.id==='L018'){
    assert.equal(item.audioType,'prerecorded-TTS');assert.equal(item.contentLicense,'CC BY 4.0');
    assert(item.parts.every(part=>part.audioUrl?.startsWith('https://raw.githubusercontent.com/LuchoBazz/ielts-ai-dataset/78f7ebf2b430114998aae6806cb92c1a4a475594/')&&part.transcript));
  }else {assert(item.parts.every(part=>part.lines.length));assert.equal(item.audioType,'TTS');assert.equal(item.audioStatus,'runtime-generation-required')}
  assert.equal(item.availability,'public-compatible');
}
for(const item of bank.reading){
  assert.equal(item.parts.length,3);
  assert.deepEqual(item.parts.flatMap(part=>part.groups.flatMap(g=>g.questions.map(q=>q.number))).sort((a,b)=>a-b),Array.from({length:40},(_,i)=>i+1));
  assert(item.parts.every(part=>part.texts.length&&part.groups.length));
  assert(item.parts.flatMap(part=>part.groups.flatMap(g=>g.questions)).every(q=>q.answers.length));
  for(const group of item.parts.flatMap(part=>part.groups))if(group.layout?.kind==='diagram')assert(group.layout.image==='data/ielts-custom-media/dg_front_pack_panel.svg'&&existsSync(new URL('../'+group.layout.image,import.meta.url)));
}
for(const task of bank.writingTask1)assert(task.prompt&&task.chartSpec?.kind&&task.mediaType==='chart-spec');
const appSource=readFileSync(new URL('../app-23.js',import.meta.url),'utf8');
const fullSource=readFileSync(new URL('../app-24.js',import.meta.url),'utf8');
assert(appSource.includes("customManifest.mocks.filter(customMockReady).map"));
assert(!appSource.includes('customSpeakingInput'));
assert(fullSource.includes("deadline:now+30*60000")&&fullSource.includes("next==='writing'?60:next==='reading'?60:30"));
assert(fullSource.includes('ielts-full-panes')&&fullSource.includes('ielts-full-source')&&fullSource.includes('ielts-full-question'));
assert(!fullSource.includes('q.explanation')&&!fullSource.includes('q.answer}')&&!fullSource.includes('transcript:'));
assert(fullSource.includes("$('#ieltsFullCopy').onclick")&&fullSource.indexOf("$('#ieltsFullCopy').onclick")>fullSource.indexOf('function ieltsFullRenderResult'));
const chartSource=appSource.slice(appSource.indexOf('const customColors='),appSource.indexOf('function openCustomWork('));
const drawChart=runInNewContext(`${chartSource}\ncustomChart`,{esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;')});
for(const task of bank.writingTask1){const media=drawChart(task.chartSpec);assert(media.includes('<svg')||media.includes('<table')||media.includes('custom-process'));assert(!media.includes('缺少图表媒体'));assert(!media.includes('NaN'))}
const questionSource=appSource.slice(appSource.indexOf('function customAnswerVariants('),appSource.indexOf('function startCustomExam('));
const mapQuestions=runInNewContext(`${questionSource}\ncustomQuestions`,{});
for(const item of bank.listening.slice(0,7))for(const q of item.parts.flatMap(part=>part.questions).filter(q=>['multiple_choice','matching'].includes(q.type))){const built=mapQuestions('listening',{parts:[{questions:[q]}]})[0].stem;assert(built.includes(q.instruction));for(const [letter,label] of Object.entries(q.options))assert(built.includes(`${letter}. ${label}`))}
// Exercise the isolated exam renderer with an answer and explanation that must never reach its DOM.
const dom=new Map(),element=key=>{if(!dom.has(key))dom.set(key,{dataset:{},innerHTML:'',textContent:'',querySelector:()=>null});return dom.get(key)};
const mock={id:'mock_01',listeningId:'L001',readingId:'R001'};
const examContext={window:{addEventListener(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},state:{examEngine:{}},$:key=>key.includes(' audio')?null:element(key),$$:()=>[],esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;'),customReadingLayout:()=>'<svg>MEDIA</svg>',customMock:()=>mock,customMockReady:()=>true,customListening:()=>({id:'L001',parts:[{number:1,title:'Test',lines:[{text:'Audio'}]}]}),customReading:()=>({id:'R001',parts:[{number:1,title:'Passage'}]}),buildCustomExamQuestions:()=>[{id:'q1',section:'Test · Part 1',stem:'Question text',answer:['ANSWERSECRET'],explanation:'EXPLANATIONSECRET',content:{passage:'PASSAGE TEXT'}}],nav(){},save(){},confirm:()=>true};
runInNewContext(`${fullSource}\nstartIeltsFullMock('mock_01');renderIeltsFullQuestions(ieltsFullSession(),customMock('mock_01'))`,examContext);
assert.equal(examContext.state.examEngine.ieltsFullSession.section,'listening');
assert.equal(examContext.state.examEngine.ieltsFullSession.deadline-examContext.state.examEngine.ieltsFullSession.startedAt,30*60000);
let html=[...dom.values()].map(el=>el.innerHTML).join('');assert(html.includes('Question text')&&!html.includes('ANSWERSECRET')&&!html.includes('EXPLANATIONSECRET')&&!html.includes('PASSAGE TEXT'));
dom.clear();examContext.state.examEngine.ieltsFullSession.section='reading';
runInNewContext("renderIeltsFullQuestions(ieltsFullSession(),customMock('mock_01'))",examContext);
html=[...dom.values()].map(el=>el.innerHTML).join('');assert(html.includes('PASSAGE TEXT')&&html.includes('Question text')&&html.includes('MEDIA')&&!html.includes('ANSWERSECRET')&&!html.includes('EXPLANATIONSECRET'));
for(const task of bank.writingTask2)assert(task.prompt);
assert.equal(new Set(bank.writingTask1.map(x=>x.sourceId)).size,38);
assert.equal(new Set(bank.writingTask2.map(x=>x.sourceId)).size,42);
assert.equal(manifest.listeningReferences.length,12);
assert.equal(new Set([...bank.listening,...manifest.listeningReferences].map(x=>x.id)).size,20);
assert(manifest.listeningReferences.every(x=>x.loaded===false&&x.audioType!=='real'));
assert.equal(manifest.readingReferences.length,21);
assert(manifest.readingReferences.every(x=>x.availability==='local-only'&&x.loaded===false&&!('parts'in x)));
assert.equal(manifest.speakingSets.length,30);
assert.deepEqual(speaking.counts,manifest.speakingSource.expectedCounts);
assert.equal(manifest.speakingSource.loaded,true);
assert.equal(manifest.speakingSource.path,'data/ielts-speaking-2026-09.json');
assert.equal(new Set(manifest.speakingSets.map(x=>x.part2CueCardId)).size,30);
for(const set of manifest.speakingSets){assert.equal(set.part1TopicIds.length,3);assert.equal(set.part3GroupId,set.part2CueCardId.replace('P2-','P3-'));assert(set.part1TopicIds.every(id=>speaking.part1.some(p=>p.id===id)));assert(speaking.part3.some(g=>g.id===set.part3GroupId&&g.linkedPart2Id===set.part2CueCardId))}
assert.deepEqual(manifest.speakingSets[0],{id:'S001',part1TopicIds:['P1-M01','P1-PL01','P1-OB09'],part2CueCardId:'P2-PL01',part3GroupId:'P3-PL01'});
assert.deepEqual(manifest.speakingSets.at(-1),{id:'S030',part1TopicIds:['P1-M05','P1-AB08','P1-OB06'],part2CueCardId:'P2-EV14',part3GroupId:'P3-EV14'});
assert.equal(manifest.mocks.length,30);
for(let i=0;i<30;i++){
  const m=manifest.mocks[i];assert.equal(m.id,`mock_${String(i+1).padStart(2,'0')}`);
  assert.equal(m.speakingSetId,manifest.speakingSets[i].id);
  assert(present(bank.writingTask1,m.writingTask1Id)&&present(bank.writingTask2,m.writingTask2Id));
  if(i<7||i>=8&&i<20)assert.equal(m.listeningId,`L${String(i+1).padStart(3,'0')}`);
  else if(i===7)assert.equal(m.listeningId,'L018');
  else assert.equal(m.listeningId,null);
  assert.deepEqual(m.missingSections,[...(!present(bank.listening,m.listeningId)?['listening']:[]),...(!present(bank.reading,m.readingId)?['reading']:[])]);
  assert.equal(m.fullReady,i<8);assert.equal(m.status,i<8?'ready':i>=20?'pending':'incomplete');
}
assert.equal(manifest.mocks.filter(m=>m.status==='ready').length,8);
assert.equal(new Set(manifest.mocks.slice(0,8).map(m=>m.listeningId)).size,8);
assert.equal(new Set(manifest.mocks.slice(0,8).map(m=>m.readingId)).size,8);
assert.equal(manifest.mocks.slice(20).every(m=>m.listeningStatus==='pending'&&!m.listeningId),true);
assert.equal(bank.listening.filter(x=>x.audioType==='TTS').length,7);
assert.equal(bank.listening.filter(x=>x.audioType==='prerecorded-TTS').length,1);
assert.equal(bank.listening.filter(x=>x.audioType==='REAL_AUDIO').length,0);
assert.equal(new Set(manifest.mocks.map(x=>x.writingTask1Id)).size,30);
assert.equal(new Set(manifest.mocks.map(x=>x.writingTask2Id)).size,30);
assert(readFileSync(new URL('../service-worker.js',import.meta.url),'utf8').includes('app-23.js'));
assert(readFileSync(new URL('../service-worker.js',import.meta.url),'utf8').includes('app-24.js'));
assert(readFileSync(new URL('../service-worker.js',import.meta.url),'utf8').includes('data/ielts-speaking-2026-09.json'));
for(const path of ['app-23.js','app-24.js','data/ielts-custom-open.json','data/ielts-custom-manifest.json','data/ielts-speaking-2026-09.json'])assert(existsSync(new URL('../'+path,import.meta.url)));
assert(readFileSync(new URL('../app.js',import.meta.url),'utf8').includes("'app-24.js'"));
assert(readFileSync(new URL('../ui.html',import.meta.url),'utf8').includes('id="page-ielts-full-exam"'));
for(const file of ['boot.js','app.js','index.html','service-worker.js'])assert(readFileSync(new URL('../'+file,import.meta.url),'utf8').includes('20260920-36'));
assert(!readFileSync(new URL('../service-worker.js',import.meta.url),'utf8').includes('data/ielts-custom-open.json'));
for(const file of ['app-1.js','app-12.js','app-13.js','app-23.js','app-24.js','speaking-bank-parser.mjs'])
  execFileSync('node',['--check',new URL('../'+file,import.meta.url).pathname]);

// Optional private fixture, read only from the user's explicit PDF, never saved to public Git.
if(process.env.IELTS_SPEAKING_PDF){
  const code=`import pdfplumber,json,sys\nwith pdfplumber.open(sys.argv[1]) as p: print(json.dumps([page.extract_text() for page in p.pages],ensure_ascii=False))`;
  const pages=JSON.parse(execFileSync('python3',['-c',code,process.env.IELTS_SPEAKING_PDF],{encoding:'utf8'}));
  const speaking=parseSpeakingBank(pages);
  assert.deepEqual(speaking.counts,manifest.speakingSource.expectedCounts);
  const byId=(part,id)=>speaking[part].find(x=>x.id===id);
  for(const set of manifest.speakingSets){assert(set.part1TopicIds.every(id=>byId('part1',id)));assert(byId('part2',set.part2CueCardId));assert.equal(byId('part3',set.part3GroupId)?.linkedPart2Id,set.part2CueCardId)}
  console.log('Private PDF count and all S001–S030 references: PASS');
}
console.log('Custom IELTS public bank, rights, mock references, syntax: PASS');
