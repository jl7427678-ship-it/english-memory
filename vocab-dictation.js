// Sentence completion reuses the existing vocabulary decks, speech and profile storage.
const DICTATION_EXAMPLES_VERSION='2026.10.26.1';
let dictationExamples=null,dictationLoading=null,dictationBusy=false;
let dictationSpeechRun=0,dictationVoiceBusy=false;
const DICTATION_SPELLING_PAIRS=[['fibre','fiber'],['aluminium','aluminum'],['fertiliser','fertilizer'],['civilisation','civilization'],['artefact','artifact'],['enrolment','enrollment'],['instalment','installment'],['centre','center'],['colour','color'],['organisation','organization'],['organise','organize'],['programme','program'],['theatre','theater'],['neighbour','neighbor'],['labour','labor']];
function dictationNorm(value){return String(value||'').normalize('NFKC').replace(/[’‘]/g,"'").trim().replace(/\s+/g,' ').toLowerCase()}
function dictationStore(){const existing=state.vocab.dictation;if(!existing||existing.version!==1)state.vocab.dictation={version:1,byDeck:{}};return state.vocab.dictation}
function dictationDeckState(id){const store=dictationStore();store.byDeck=store.byDeck||{};return store.byDeck[id]||(store.byDeck[id]={stats:{},session:null})}
function dictationActive(){return dictationDeckState($('#dictationDeck').value)}
function dictationParts(sentence,word){
  const target=dictationNorm(word);if(!target)return null;
  const text=String(sentence||'').replace(/[’‘]/g,"'"),pattern=new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+'),'gi'),parts=[];
  let cursor=0,found=false;
  for(const match of text.matchAll(pattern)){
    const before=text[match.index-1]||'',after=text[match.index+match[0].length]||'';
    if(/[A-Za-z0-9']/.test(before)||/[A-Za-z0-9']/.test(after))continue;
    parts.push({text:text.slice(cursor,match.index)},{blank:true});cursor=match.index+match[0].length;found=true;
  }
  if(!found)return null;parts.push({text:text.slice(cursor)});return parts;
}
function dictationExample(word){
  const bundled=dictationExamples?.entries?.[dictationNorm(word.word)],own=vocabExampleData(word);
  for(const item of [bundled,own]){
    if(!item?.sentence||!dictationParts(item.sentence,word.word))continue;
    if(item.sentence.trim().split(/\s+/).length<5||!/[.!?]$/.test(item.sentence.trim()))continue;
    return {sentence:item.sentence,translation:item.translation||'',source:item.source||'词库自带例句'};
  }
  return null;
}
async function loadDictationExamples(){
  if(dictationExamples)return dictationExamples;
  if(dictationLoading)return dictationLoading;
  dictationLoading=(async()=>{
    let data=null;try{data=await idbGetDeck('vocab-dictation-examples')}catch{}
    if(data?.version!==DICTATION_EXAMPLES_VERSION||!data.entries)data=await fetchVocabJson('data/vocab-dictation-examples.json');
    if(data.id!=='vocab-dictation-examples'||data.version!==DICTATION_EXAMPLES_VERSION||!data.entries)throw Error('例句数据不完整，请联网刷新后重试');
    try{await idbPutDeck(data)}catch{toast('例句已载入，但本机缓存失败；离线前请先测试')}
    dictationExamples=data;return data;
  })();
  try{return await dictationLoading}finally{dictationLoading=null}
}
function dictationIsWeak(word){return ['unknown','fuzzy'].includes(word.quickStatus)||word.screenClass==='wrong'||((word.wrong||0)>0&&(word.level||0)<3)}
function dictationCandidates(deck,scope){
  const stats=dictationDeckState(deck.id).stats||{},items=deck.words.map(word=>({word,example:dictationExample(word)})).filter(item=>item.example&&(scope!=='weak'||dictationIsWeak(item.word)));
  const time=Date.now();
  function priority(item){const stat=stats[dictationNorm(item.word.word)];return (scope==='weak-first'&&!dictationIsWeak(item.word)?100:0)+(stat?(stat.due<=time?0:20):5)}
  return items.sort((a,b)=>priority(a)-priority(b)||((stats[dictationNorm(a.word.word)]?.last||0)-(stats[dictationNorm(b.word.word)]?.last||0)));
}
function dictationAnswerMatches(input,answer){
  const value=dictationNorm(input),target=dictationNorm(answer);if(value===target)return true;
  return DICTATION_SPELLING_PAIRS.some(pair=>pair.includes(target)&&pair.includes(value));
}
function dictationSession(){return dictationActive().session}
function dictationQuestion(){const session=dictationSession();return session?.queue?.[session.index]||null}
function dictationSave(){save({refresh:false})}
function dictationStop(){dictationSpeechRun++;window.PiperSpeech?.stop();window.KokoroSpeech?.stop();stopSystemSpeech()}
function renderDictationVoice(detail=window.KokoroSpeech?.getStatus()){
  const button=$('#dictationPrepareVoice'),status=$('#dictationVoiceStatus');
  if(!button||!status)return;
  const ready=['ready','speaking','generating'].includes(detail?.state);
  button.disabled=dictationVoiceBusy||ready;
  button.textContent=ready?'Kokoro 已就绪':dictationVoiceBusy?'正在准备 Kokoro…':detail?.state==='downloaded'?'初始化 Kokoro':'准备 Kokoro（首次下载约 92 MB）';
  const voice=window.KokoroSpeech?.voiceOptions?.find(item=>item.id===(state.settings.kokoroVoice||'af_heart'));
  status.textContent=`Kokoro · ${voice?.label||state.settings.kokoroVoice||'Heart'} · ${detail?.message||'请先准备声音'}。首次生成需稍等；本次打开页面期间重听用缓存，下一题提前生成。不会切换为设备默认声音。`;
}
async function prepareDictationVoice(){
  if(dictationVoiceBusy)return false;
  const engine=window.KokoroSpeech;if(!engine){$('#dictationVoiceStatus').textContent='Kokoro 未载入，请刷新页面重试。';return false}
  dictationStop();dictationVoiceBusy=true;renderDictationVoice();let failure='';
  try{
    engine.prime();
    try{await engine.prepare()}catch(error){
      if(!/第一步.*下载/.test(error?.message||''))throw error;
      await engine.download();
    }
    return true;
  }catch(error){failure='Kokoro 准备失败：'+(error?.message||'请重试');return false}
  finally{dictationVoiceBusy=false;renderDictationVoice();if(failure)$('#dictationVoiceStatus').textContent=failure}
}
async function playDictationSentence(){
  const question=dictationQuestion();if(!question)return false;
  window.PiperSpeech?.stop();stopSystemSpeech();const run=++dictationSpeechRun,engine=window.KokoroSpeech;
  try{
    if(!engine)throw Error('Kokoro 未载入，请刷新页面重试');
    engine.prime();
    const session=dictationSession(),nextText=session.queue[session.index+1]?.sentence||null;
    const played=await engine.speak(question.sentence,{voice:state.settings.kokoroVoice||'af_heart',speed:Math.max(.75,Math.min(1.25,Number(state.settings.speechRate)||.9)),nextText});
    return run===dictationSpeechRun&&played!==false;
  }catch(error){
    if(run===dictationSpeechRun){renderDictationVoice();$('#dictationVoiceStatus').textContent='Kokoro 暂未能播放：'+(error?.message||'请重试')+'。请点上方准备按钮；不会切换为设备默认声音。'}
    return false;
  }
}
function renderDictation(){
  const session=dictationSession(),trainer=$('#dictationTrainer');if(!session){trainer.hidden=true;return}
  trainer.hidden=false;$('#dictationTitle').textContent=session.title+' · 例句听写';
  renderDictationVoice();
  const total=session.queue.length,done=Math.min(session.index,total),finished=session.index>=total;
  $('#dictationPosition').textContent=finished?'本组完成':`${done+1} / ${total}`;
  $('#dictationProgress').style.width=(total?done/total*100:0)+'%';
  $('#dictationQuestion').hidden=finished;$('#dictationResult').hidden=!finished;
  $('#dictationPlay').disabled=finished;
  if(finished){
    $('#dictationResult').innerHTML=`<h3>本组听写完成</h3><p>已练 ${session.initialCount} 个词 · 作答 ${session.attempts||0} 次 · 答对 ${session.correct||0} 次 · 错词回练 ${total-session.initialCount} 次</p><p class="sub">听写成绩独立保存；不把四选一认识的词直接算作会拼写。</p><div class="row"><button class="btn primary" type="button" id="dictationAnother">再选一组</button></div>`;
    $('#dictationAnother').onclick=()=>startVocabDictation(true);return;
  }
  const question=dictationQuestion(),parts=dictationParts(question.sentence,question.word);
  if(!parts){$('#dictationStatus').textContent='这条例句缺少目标词，请重新选一组。';return}
  let blank=0;
  $('#dictationSentence').innerHTML=parts.map(part=>part.blank?(blank++===0?'<input class="dictation-input" id="dictationInput" aria-label="听到的目标单词" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="输入听到的单词">':'<span class="dictation-repeat-blank" aria-label="同一单词的空格">_____</span>'):esc(part.text)).join('');
  const input=$('#dictationInput');input.value=session.answer?.input??session.draft??'';input.disabled=!!session.answer;
  input.oninput=()=>{session.draft=input.value;dictationSave()};
  $('#dictationCheck').disabled=!!session.answer;$('#dictationReveal').disabled=!!session.answer;
  $('#dictationNext').hidden=!session.answer;$('#dictationFeedback').hidden=!session.answer;
  $('#dictationNext').textContent=session.index+1>=total?'查看本组结果':'下一题';
  if(session.answer){
    const result=session.answer,feedback=$('#dictationFeedback');feedback.className='dictation-feedback '+(result.correct?'correct':'wrong');
    const attribution=question.source==='original-practice'?'自主编写练习例句':question.source==='toeic-vocab-tw'?'TOEIC 双语词库 · CC BY-SA 4.0':question.source;
    feedback.innerHTML=`<b>${result.correct?'✓ 拼写正确':'需要再练一次'}</b><p>你的答案：${esc(result.input||'未填写')}<br>正确答案：<strong>${esc(question.word)}</strong></p><p>${esc(question.sentence)}</p>${question.translation?`<p>${esc(question.translation)}</p>`:''}<p>${esc(question.word)}：${esc(question.meaning)}</p><small class="sub">${esc(attribution)}</small>`;
  }
}
async function startVocabDictation(fresh=false){
  if(dictationBusy)return;dictationBusy=true;
  const controls=['#dictationStart','#dictationNew','#dictationDeck','#dictationScope','#dictationSize'].map(id=>$(id));controls.forEach(control=>{control.disabled=true});
  primeSpeech();dictationStop();
  clearTimeout(vocabAdvanceTimer);if(state.vocab.session)state.vocab.session.suspended=true;
  $('#vocabTrainer').style.display='none';$('#vocabQuickTrainer').hidden=true;$('#vocabBrowser').hidden=true;
  try{
    const id=$('#dictationDeck').value;if(!id)throw Error('请先选择词库');
    const saved=dictationDeckState(id);
    if(!fresh&&saved.session&&saved.session.index<saved.session.queue.length){
      $('#dictationScope').value=saved.session.scope||'weak-first';
      $('#dictationStatus').textContent='已恢复本机听写进度。点击“播放整句 / 重听”开始。';renderDictation();return;
    }
    $('#dictationStatus').textContent='正在准备词库与例句，首次载入需要联网…';
    const deck=state.vocab.decks.find(item=>item.id===id)||await ensureBuiltinDeck(id);
    await loadDictationExamples();
    const withExamples=deck.words.filter(word=>dictationExample(word)).length,scope=$('#dictationScope').value;
    const candidates=dictationCandidates(deck,scope),size=Number($('#dictationSize').value)||20;
    if(!candidates.length){$('#dictationStatus').textContent=withExamples?'暂无符合范围的词。可先筛选不会词，或切换“全部有例句的词”。':'这个词库暂没有可用的句中填词例句；请先选择雅思听力 300 词。';return}
    const selected=candidates.slice(0,size),queue=selected.map(({word,example})=>({word:word.word,meaning:word.meaning,...example}));
    saved.session={title:deck.title,speechLang:deck.speechLang||'en-GB',scope,index:0,queue,initialCount:queue.length,attempts:0,correct:0,retries:{},draft:'',answer:null,startedAt:Date.now()};
    dictationSave();renderDictation();
    const weak=selected.filter(item=>dictationIsWeak(item.word)).length;
    $('#dictationStatus').textContent=`本组 ${queue.length} 词，含 ${weak} 个薄弱词。词库有例句 ${withExamples} / ${deck.words.length} 词；其余暂不出题。点击播放听整句。听写进度仅保存在当前设备。`;
  }catch(error){console.warn('Sentence dictation unavailable',error);$('#dictationStatus').textContent='暂时无法开始：'+(error?.message||'请联网后重试');}
  finally{dictationBusy=false;controls.forEach(control=>{control.disabled=false})}
}
function checkVocabDictation(reveal=false){
  const session=dictationSession(),question=dictationQuestion(),input=$('#dictationInput');
  if(!session||!question||session.answer||!input)return;
  const value=input.value.trim();if(!value&&!reveal){$('#dictationStatus').textContent='先输入听到的单词，或点击“不会，查看答案”。';input.focus();return}
  const correct=!reveal&&dictationAnswerMatches(value,question.word),record=dictationActive(),key=dictationNorm(question.word),time=Date.now();
  record.stats=record.stats||{};const stat=record.stats[key]||{attempts:0,correct:0,wrong:0,streak:0};
  stat.attempts++;stat.correct+=correct?1:0;stat.wrong+=correct?0:1;stat.streak=correct?stat.streak+1:0;stat.last=time;stat.due=time+(correct?86400000:600000);record.stats[key]=stat;
  session.attempts++;session.correct+=correct?1:0;session.answer={input:value,correct,revealed:reveal};session.draft='';
  if(!correct&&(session.retries[key]||0)<2){session.retries[key]=(session.retries[key]||0)+1;session.queue.push({...question})}
  dictationSave();renderDictation();
}
function nextVocabDictation(){
  const session=dictationSession();if(!session?.answer)return;dictationStop();session.index++;session.answer=null;session.draft='';dictationSave();renderDictation();
  if(dictationQuestion())playDictationSentence();
}
function dictationDeckOptions(){
  const select=$('#dictationDeck'),current=select.value;
  const builtin=Object.values(BUILTIN_VOCAB).filter(meta=>['ielts','toeic','kaoyan-english'].includes(meta.projectId));
  const custom=state.vocab.decks.filter(deck=>deck.words.some(word=>/^[A-Za-z]/.test(word.word)));
  select.innerHTML=[...builtin,...custom].map(deck=>`<option value="${esc(deck.id)}">${esc(deck.title)}</option>`).join('');
  if([...select.options].some(option=>option.value===current))select.value=current;
}
function openVocabDictation(deckId='ielts_listening_300'){
  nav('vocab');dictationDeckOptions();const select=$('#dictationDeck');if([...select.options].some(option=>option.value===deckId))select.value=deckId;
  $('#dictationTrainer').hidden=true;$('#dictationStatus').textContent='选择范围后点“开始 / 继续例句听写”。薄弱词来自你已保存的筛选和答题记录。听写进度保存在当前设备。';
  $('#vocabDictation').scrollIntoView({behavior:'smooth',block:'start'});$('#vocabDictation').focus({preventScroll:true});
}
const baseDictationCards=renderVocabCardEnhancements;
renderVocabCardEnhancements=function(){
  baseDictationCards();dictationDeckOptions();
  for(const button of $$('[data-vcontinue]')){
    const id=button.dataset.vcontinue,meta=BUILTIN_VOCAB[id];if(meta&&meta.projectId==='italiano')continue;
    const row=button.parentElement;if(row.querySelector('[data-vdictation]'))continue;
    const entry=document.createElement('button');entry.className='btn';entry.type='button';entry.dataset.vdictation=id;entry.textContent='例句听写';entry.onclick=()=>openVocabDictation(id);row.appendChild(entry);
  }
};
$('#dictationStart').onclick=()=>startVocabDictation(false);$('#dictationNew').onclick=()=>startVocabDictation(true);
$('#dictationDeck').onchange=()=>{dictationStop();$('#dictationTrainer').hidden=true;$('#dictationStatus').textContent='已选择词库。点击开始可恢复该词库的本机进度。'};
$('#dictationForm').onsubmit=event=>{event.preventDefault();checkVocabDictation(false)};
$('#dictationReveal').onclick=()=>checkVocabDictation(true);$('#dictationPlay').onclick=playDictationSentence;$('#dictationStop').onclick=dictationStop;$('#dictationNext').onclick=nextVocabDictation;
$('#dictationPrepareVoice').onclick=prepareDictationVoice;
window.addEventListener('kokoro-status',event=>renderDictationVoice(event.detail));
$('#dictationExit').onclick=()=>{dictationStop();dictationSave();$('#dictationTrainer').hidden=true;$('#dictationStatus').textContent='听写进度已保存在本机，下次可继续。'};
const listeningCard=$('#ieltsListeningWords .row');
if(listeningCard){const entry=document.createElement('button');entry.className='btn';entry.type='button';entry.textContent='例句听写';entry.onclick=()=>openVocabDictation('ielts_listening_300');listeningCard.appendChild(entry)}
renderVocabCardEnhancements();
if(new URLSearchParams(location.search).get('practice')==='dictation')openVocabDictation(new URLSearchParams(location.search).get('deck')||'ielts_listening_300');
