import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const app3=read('app-3.js'),app4=read('app-4.js'),app19=read('app-19.js');
function extract(source,name){
  const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);
  const next=source.indexOf('\nfunction ',start+1);
  return source.slice(start,next<0?undefined:next);
}
const definitions=[...['pendingVocabReinforcementWords','resumeVocabTraining','currentVocabWord','renderVocabSession','startVocabScreen'].map(name=>extract(app3,name)),...['answerVocabChoice','advanceVocab','buildVocabReinforceQueue','completeVocabScreen','finishVocabSession'].map(name=>extract(app4,name)),extract(app19,'nextUnlearnedWords'),extract(app19,'startVocabContinue')].join('\n');
function harness(){
  const nodes=new Map(),timers=new Map();let timerId=0;
  const $=key=>{if(!nodes.has(key))nodes.set(key,{style:{},classList:{add(){},remove(){}},scrollIntoView(){},focus(){}});return nodes.get(key)};
  const words=Array.from({length:4},(_,i)=>({id:'w'+i,word:'word'+i,meaning:'meaning'+i,seen:0,correct:0,wrong:0,sessionCorrect:0,sessionWrong:0,screenClass:'new',screenRepeats:1,level:0,due:0,last:0}));
  const deck={id:'test',title:'Test',words};
  const ctx={state:{vocab:{decks:[deck],activeDeck:null,session:null,resume:{}},settings:{vocabBatchSize:'all'},vocabLogs:{}},builtinDeckCache:new Map(),vocabAdvanceTimer:null,$,$$:()=>[],now:()=>1000000,dayKey:()=> 'test-day',shuffle:items=>[...items],esc:String,wordById:(d,id)=>d.words.find(w=>w.id===id),vocabWordAttempted:w=>w.correct+w.wrong>0,save(){},saveBuiltinProgress(){},toast(){},renderVocabChoice(d,w){ctx.displayed=w.id},renderVocabHomeMetricsOnly(){},setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)};
  ctx.activeVocabDeck=()=>ctx.state.vocab.decks.find(d=>d.id===ctx.state.vocab.activeDeck);
  vm.createContext(ctx);vm.runInContext(definitions,ctx);
  const flush=()=>{while(timers.size){const [id,fn]=timers.entries().next().value;timers.delete(id);fn()}};
  const answer=correct=>{const w=ctx.currentVocabWord();assert.ok(w);ctx.answerVocabChoice(correct?w.meaning:'wrong');flush()};
  return {ctx,deck,flush,answer,$};
}

// A completed first pass starts reinforcement immediately, with only the wrong word five times.
{
  const h=harness(),{ctx,deck}=h;ctx.startVocabScreen(deck.id);h.flush();
  for(let i=0;i<4;i++)h.answer(i!==0);
  assert.equal(ctx.state.vocab.session.phase,'reinforce');
  assert.deepEqual([...ctx.state.vocab.session.queue],Array(5).fill('w0'));
  assert.equal(h.$('#vocabPhaseTitle').textContent,'② 错词强化轮');
  h.answer(false);assert.equal(ctx.state.vocab.session.queue.length,6,'second-pass errors return to queue');
  while(!ctx.state.vocab.session.completed)h.answer(true);
  assert.equal(ctx.pendingVocabReinforcementWords(deck).length,0);
  assert.equal(deck.words[0].screenClass,'reinforced');
  const log=JSON.stringify(ctx.state.vocabLogs);ctx.renderVocabSession();ctx.renderVocabSession();
  assert.equal(JSON.stringify(ctx.state.vocabLogs),log,'reopening result must not count the same session twice');
}
// All-correct first pass completes without a pointless second pass.
{
  const h=harness();h.ctx.startVocabScreen(h.deck.id);h.flush();for(let i=0;i<4;i++)h.answer(true);
  assert.equal(h.ctx.state.vocab.session.completed,true);assert.equal(h.ctx.state.vocab.session.queue.length,0);
}
// Reload at the final answer must advance exactly once and preserve wrong-word reinforcement.
{
  const h=harness(),{ctx,deck}=h;ctx.startVocabScreen(deck.id);h.flush();
  h.answer(false);h.answer(true);h.answer(true);
  ctx.answerVocabChoice(ctx.currentVocabWord().meaning);
  const count=deck.words[3].correct;ctx.answerVocabChoice(ctx.currentVocabWord().meaning);
  assert.equal(deck.words[3].correct,count,'duplicate keyboard/click must be ignored');
  ctx.state.vocab.session=JSON.parse(JSON.stringify(ctx.state.vocab.session));
  ctx.renderVocabSession();h.flush();
  assert.equal(ctx.state.vocab.session.phase,'reinforce');assert.equal(ctx.state.vocab.session.index,0);
  assert.equal(ctx.currentVocabWord().id,'w0');
}
// Existing stores whose session was cleared recover wrong words ahead of another first pass.
for(const entry of ['startVocabContinue','startVocabScreen']){
  const h=harness(),{ctx,deck}=h;
  Object.assign(deck.words[0],{wrong:1,seen:1,screenClass:'wrong',screenRepeats:3,last:900000,due:0});
  Object.assign(deck.words[1],{wrong:1,screenClass:'wrong',screenRepeats:5,last:800000,due:1200000});
  ctx[entry](deck.id);h.flush();
  assert.equal(ctx.state.vocab.session.phase,'reinforce');
  assert.deepEqual([...ctx.state.vocab.session.queue],Array(3).fill('w0'),'recover remaining attempts; exclude old completed review');
  h.answer(true);
  ctx.state.vocab.session.suspended=true;
  const exitLine=app4.split('\n').find(line=>line.startsWith("$('#reviewDueVocab')"));
  const handler=exitLine.slice(exitLine.indexOf("$('#exitVocabTrain').onclick="),exitLine.indexOf(";$('#checkVocabSpell')"));
  ctx.renderVocabHome=()=>{};vm.runInContext(handler,ctx);h.$('#exitVocabTrain').onclick();
  assert.equal(ctx.state.vocab.session.suspended,true);
  const session=ctx.state.vocab.session;ctx[entry](deck.id);
  assert.equal(ctx.state.vocab.session,session);assert.equal(session.index,1);
  // Simulate another device with only the synced per-word progress, not the training session.
  ctx.state.vocab.session=null;ctx[entry](deck.id);assert.equal(ctx.state.vocab.session.queue.length,2);
}
console.log('PASS: real training lifecycle, automatic wrong-word pass, five repetitions, reflow, all-correct completion, final-answer reload, double-click protection, interruption/resume and legacy/synced progress recovery.');
