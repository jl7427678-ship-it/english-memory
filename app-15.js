const ATLAS_MANIFEST_PATH='data/ielts-atlas-manifest.json';
let atlasManifest=null,atlasCatalogLimit=30,atlasCatalogFilter='all',atlasCatalogSearch='',atlasSession=null;
const atlasExamMemory=new Map();

function atlasHistory(){
  state.examEngine.atlasHistory=Array.isArray(state.examEngine.atlasHistory)?state.examEngine.atlasHistory:[];
  return state.examEngine.atlasHistory;
}
async function loadAtlasManifest(){
  if(atlasManifest)return atlasManifest;
  const response=await fetch(ATLAS_MANIFEST_PATH,{cache:'no-store'});
  if(!response.ok)throw new Error('Atlas 题库目录加载失败');
  atlasManifest=await response.json();
  return atlasManifest;
}
function extractAtlasPayload(source,examId){
  const marker='.register("'+examId+'",';let start=source.indexOf(marker);
  if(start<0)throw new Error('Atlas 数据格式无法识别：'+examId);
  start=source.indexOf('{',start+marker.length);
  let depth=0,inString=false,escaped=false;
  for(let index=start;index<source.length;index+=1){
    const char=source[index];
    if(inString){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')inString=false;continue}
    if(char==='"'){inString=true;continue}
    if(char==='{')depth+=1;
    if(char==='}'&&--depth===0)return JSON.parse(source.slice(start,index+1));
  }
  throw new Error('Atlas 数据不完整：'+examId);
}
async function fetchAtlasSource(path){
  const url=atlasManifest.source.rawBase+path;
  const response=await fetch(url);
  if(!response.ok)throw new Error('Atlas 远程分片加载失败');
  return response.text();
}
async function loadAtlasExam(examId){
  if(atlasExamMemory.has(examId))return atlasExamMemory.get(examId);
  const meta=atlasManifest.exams.find(item=>item.id===examId);
  if(!meta)throw new Error('找不到 Atlas 试卷');
  const [examSource,explanationSource]=await Promise.all([
    fetchAtlasSource(meta.examPath),
    meta.explanationPath?fetchAtlasSource(meta.explanationPath).catch(()=>null):Promise.resolve(null)
  ]);
  const loaded={meta,exam:extractAtlasPayload(examSource,examId),explanation:explanationSource?extractAtlasPayload(explanationSource,examId):null};
  atlasExamMemory.set(examId,loaded);
  return loaded;
}
function atlasLatestResult(examId){return atlasHistory().find(item=>item.examId===examId)}
async function renderAtlasLibrary(show=true){
  const shell=$('#atlasReadingLibrary');if(!shell)return;
  shell.hidden=!show;if(!show)return;
  if(!atlasManifest){
    shell.innerHTML='<div class="atlas-loading">正在读取 IELTS Atlas 题库目录…</div>';
    try{await loadAtlasManifest()}catch(error){shell.innerHTML='<div class="atlas-error">目录加载失败，请联网后重试。<button class="btn" id="retryAtlasCatalog">重试</button></div>';$('#retryAtlasCatalog').onclick=()=>renderAtlasLibrary(true);return}
  }
  const search=atlasCatalogSearch.trim().toLocaleLowerCase();
  const filtered=atlasManifest.exams.filter(exam=>(atlasCatalogFilter==='all'||exam.category===atlasCatalogFilter)&&(!search||(exam.title+' '+exam.id).toLocaleLowerCase().includes(search)));
  const visible=filtered.slice(0,atlasCatalogLimit),stats=atlasManifest.stats;
  shell.innerHTML=`<div class="atlas-library-head"><div><span class="practice-label">IELTS Atlas · Reading</span><h3>阅读题库</h3><p>${stats.examCount} 篇文章 · ${stats.questionCount} 个可判分答案字段 · ${stats.explanationCount} 篇带现有解析</p></div><a class="btn" href="${esc(atlasManifest.source.repository)}" target="_blank" rel="noopener">查看来源</a></div><div class="atlas-notice">题文与解析按需从固定版本的 Atlas 仓库读取，不整库预下载。题源版权归原权利人；用于个人学习，不冒充官方 IELTS 真题。</div><div class="atlas-filters"><input class="field" id="atlasCatalogSearch" value="${esc(atlasCatalogSearch)}" placeholder="搜索标题"><div class="exam-type-tabs">${['all','P1','P2','P3'].map(category=>`<button class="mode ${atlasCatalogFilter===category?'active':''}" data-atlas-category="${category}">${category==='all'?'全部':category}</button>`).join('')}</div></div><div class="atlas-exam-grid">${visible.map(exam=>{const result=atlasLatestResult(exam.id);return `<article class="atlas-exam-card"><div><span>${esc(exam.category)} · ${esc(exam.frequency||'未标频率')}</span><h4>${esc(exam.title)}</h4><p>${exam.questionCount} 个答案字段 · ${exam.hasExplanation?'有解析':'暂无解析'}${result?` · 最近 ${result.correct}/${result.total}`:''}</p></div><button class="btn primary" data-start-atlas="${esc(exam.id)}">${result?'再练一次':'开始做题'}</button></article>`}).join('')||'<p class="sub">没有匹配的试卷。</p>'}</div>${visible.length<filtered.length?`<button class="btn wide" id="loadMoreAtlas">再显示 ${Math.min(30,filtered.length-visible.length)} 篇</button>`:''}`;
  $('#atlasCatalogSearch').oninput=event=>{atlasCatalogSearch=event.target.value;atlasCatalogLimit=30;renderAtlasLibrary(true)};
  $$('[data-atlas-category]').forEach(button=>button.onclick=()=>{atlasCatalogFilter=button.dataset.atlasCategory;atlasCatalogLimit=30;renderAtlasLibrary(true)});
  $$('[data-start-atlas]').forEach(button=>button.onclick=()=>startAtlasReading(button.dataset.startAtlas));
  const more=$('#loadMoreAtlas');if(more)more.onclick=()=>{atlasCatalogLimit+=30;renderAtlasLibrary(true)};
}
function sanitizeAtlasHtml(html){
  const doc=new DOMParser().parseFromString(String(html||''),'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(node=>node.remove());
  doc.querySelectorAll('*').forEach(node=>{
    [...node.attributes].forEach(attribute=>{if(attribute.name.toLowerCase().startsWith('on')||attribute.name==='data-answer')node.removeAttribute(attribute.name)});
    if(node.tagName==='A'){node.removeAttribute('href');node.removeAttribute('target')}
    if(node.tagName==='IMG'){
      const src=node.getAttribute('src')||'';
      if(src.startsWith('media/'))node.src=atlasManifest.source.rawBase+'assets/generated/reading-exams/'+src;
      else if(!src.startsWith('https://'))node.remove();
      node.loading='lazy';
    }
  });
  return doc.body.innerHTML;
}
function atlasQuestionLabel(questionId){return atlasSession.loaded.exam.questionDisplayMap?.[questionId]||questionId.replace(/^q/,'')}
function atlasQuestionIdsForName(name){return atlasSession?.controlQuestions?.[name]||String(name||'').match(/q\d+/g)||[]}
function atlasAnswerForQuestion(questionId){
  if(atlasSession.answers[questionId]!=null)return atlasSession.answers[questionId];
  const groupName=Object.keys(atlasSession.answers).find(name=>atlasQuestionIdsForName(name).includes(questionId));
  return groupName?atlasSession.answers[groupName]:'';
}
function atlasIsMultiExpected(expected,value){return Array.isArray(expected)&&Array.isArray(value)&&expected.length>1&&expected.every(item=>/^[A-Z]$/.test(String(item)))}
function atlasNormalized(value){return String(value??'').trim().toLocaleLowerCase().replace(/[.,;:!?，。；：！？]/g,'').replace(/\s+/g,' ')}
function atlasScoreAnswer(expected,value){
  if(atlasIsMultiExpected(expected,value)){
    const wanted=new Set(expected.map(atlasNormalized)),given=new Set(value.map(atlasNormalized));
    return {correct:[...wanted].filter(item=>given.has(item)).length,total:wanted.size,ok:wanted.size===given.size&&[...wanted].every(item=>given.has(item))};
  }
  const accepted=Array.isArray(expected)?expected:[expected],given=Array.isArray(value)?value:[value];
  const ok=given.some(item=>accepted.some(answer=>atlasNormalized(answer)===atlasNormalized(item)));
  return {correct:ok?1:0,total:1,ok};
}
function atlasPrepareControls(){
  const root=$('#atlasReadingWorkspace');if(!root)return;
  atlasSession.controlQuestions={};
  const optionsByQuestion=new Map();
  for(const group of atlasSession.loaded.exam.questionGroups||[]){
    const shell=root.querySelector(`[data-atlas-group="${CSS.escape(group.groupId)}"]`);if(!shell)continue;
    const checkboxNames=new Set([...shell.querySelectorAll('input[type="checkbox"][name]')].map(item=>item.name));
    for(const name of checkboxNames)atlasSession.controlQuestions[name]=[...(group.questionIds||[])];
    let options=[...shell.querySelectorAll('.drag-item')].map(item=>({value:item.dataset.heading||item.dataset.option||'',label:item.textContent.trim()})).filter(item=>item.value);
    if(!options.length)options=[...shell.querySelectorAll('.classification-options li')].map(item=>({value:item.querySelector('strong')?.textContent.trim()||'',label:item.textContent.trim()})).filter(item=>item.value);
    if(!options.length){const seen=new Set();options=[...shell.querySelectorAll('input[type="radio"],option')].map(item=>{const value=item.value||'';const label=item.closest('label')?.textContent.trim()||item.textContent.trim()||value;return {value,label}}).filter(item=>item.value&&!seen.has(item.value)&&seen.add(item.value))}
    for(const questionId of group.questionIds||[])optionsByQuestion.set(questionId,options);
  }
  root.querySelectorAll('[data-question].dropzone,[data-question].paragraph-dropzone,[data-question].match-dropzone').forEach(zone=>{
    const questionId=zone.dataset.question,options=optionsByQuestion.get(questionId)||[];if(zone.querySelector('input,select,textarea'))return;
    const select=document.createElement('select');select.className='field atlas-drop-select';select.name=questionId;
    select.innerHTML='<option value="">选择答案</option>'+options.map(item=>`<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('');zone.replaceChildren(select);
  });
  root.querySelectorAll('input,textarea,select').forEach(control=>{
    const name=control.name||control.dataset.question;if(!name)return;
    const saved=atlasSession.answers[name];
    if(control.type==='checkbox')control.checked=Array.isArray(saved)&&saved.includes(control.value);
    else if(control.type==='radio')control.checked=saved===control.value;
    else if(saved!=null)control.value=saved;
    control.addEventListener('change',()=>atlasCaptureControl(control));
    if(control.matches('input[type="text"],textarea'))control.addEventListener('input',()=>atlasCaptureControl(control));
  });
  updateAtlasQuestionNav();
}
function atlasCaptureControl(control){
  const name=control.name||control.dataset.question;if(!name)return;
  if(control.type==='checkbox'){
    const group=[...$('#atlasReadingWorkspace').querySelectorAll(`input[type="checkbox"][name="${CSS.escape(name)}"]`)];
    const ids=atlasQuestionIdsForName(name),expected=ids.length===1?atlasSession.loaded.exam.answerKey?.[ids[0]]:null;
    const limit=Array.isArray(expected)&&expected.every(item=>/^[A-Z]$/.test(String(item)))?expected.length:Math.max(1,ids.length);
    const checked=group.filter(item=>item.checked);
    if(checked.length>limit){control.checked=false;return toast(`本题最多选择 ${limit} 项`)}
    atlasSession.answers[name]=group.filter(item=>item.checked).map(item=>item.value);
  }else if(control.type==='radio'){if(control.checked)atlasSession.answers[name]=control.value}
  else atlasSession.answers[name]=control.value;
  updateAtlasQuestionNav();
}
function updateAtlasQuestionNav(){
  if(!atlasSession)return;
  $$('#atlasQuestionNav [data-atlas-question]').forEach(button=>button.classList.toggle('answered',Boolean(atlasAnswerForQuestion(button.dataset.atlasQuestion)?.length||atlasAnswerForQuestion(button.dataset.atlasQuestion))));
  $('#atlasAnswerState').textContent=`已答 ${atlasSession.loaded.exam.questionOrder.filter(id=>{const answer=atlasAnswerForQuestion(id);return Array.isArray(answer)?answer.length:String(answer||'').trim()}).length} / ${atlasSession.loaded.exam.questionOrder.length}`;
}
async function startAtlasReading(examId){
  const button=$(`[data-start-atlas="${CSS.escape(examId)}"]`);if(button){button.disabled=true;button.textContent='加载中…'}
  try{
    const loaded=await loadAtlasExam(examId);
    atlasSession={loaded,answers:{},startedAt:Date.now(),result:null};
    nav('atlas-reading');
  }catch(error){console.error(error);toast('Atlas 试卷加载失败，请检查网络');if(button){button.disabled=false;button.textContent='重试'}}
}
function renderAtlasReading(){
  if(!atlasSession)return nav('exam-engine');
  const {meta,exam}=atlasSession.loaded;
  $('#atlasReadingTitle').textContent=meta.title;
  $('#atlasReadingMeta').textContent=`${meta.category} · ${meta.questionCount} 个答案字段 · ${meta.hasExplanation?'包含现有解析':'暂无现有解析'}`;
  $('#atlasPassageContent').innerHTML=(exam.passage?.blocks||[]).map(block=>sanitizeAtlasHtml(block.html)).join('');
  $('#atlasQuestionGroups').innerHTML=(exam.questionGroups||[]).map(group=>`<section data-atlas-group="${esc(group.groupId)}">${sanitizeAtlasHtml((group.leadHtml||'')+(group.bodyHtml||''))}</section>`).join('');
  $('#atlasQuestionNav').innerHTML=(exam.questionOrder||Object.keys(exam.answerKey||{})).map(id=>`<button data-atlas-question="${esc(id)}">${esc(atlasQuestionLabel(id))}</button>`).join('');
  $('#atlasResult').hidden=true;$('#atlasResult').innerHTML='';$('#submitAtlasReading').hidden=false;
  atlasPrepareControls();
  $$('[data-atlas-question]').forEach(button=>button.onclick=()=>{const id=button.dataset.atlasQuestion;const target=$(`#atlasReadingWorkspace [name="${CSS.escape(id)}"],#atlasReadingWorkspace [data-question="${CSS.escape(id)}"],#atlasReadingWorkspace #${CSS.escape(id)}-anchor,#atlasReadingWorkspace #${CSS.escape(id)}`);if(target)target.scrollIntoView({behavior:'smooth',block:'center'})});
}
function atlasExplanationMap(explanation){
  const result={};for(const group of explanation?.questionExplanations||[]){for(const item of group.items||[]){if(item.questionId)result[item.questionId]=item.text||group.text||''}for(const id of atlasSession.loaded.exam.questionOrder||[]){if(!result[id]&&group.questionRange){const number=Number(atlasQuestionLabel(id));if(number>=group.questionRange.start&&number<=group.questionRange.end)result[id]=group.text||''}}}return result;
}
function submitAtlasReading(){
  if(!atlasSession||atlasSession.result)return;
  const {meta,exam,explanation}=atlasSession.loaded,now=Date.now(),explanations=atlasExplanationMap(explanation);let correct=0,total=0;
  const rows=(exam.questionOrder||Object.keys(exam.answerKey||{})).map(questionId=>{
    const expected=exam.answerKey[questionId],answer=atlasAnswerForQuestion(questionId),score=atlasScoreAnswer(expected,answer);correct+=score.correct;total+=score.total;
    const id=`atlas:${meta.id}:${questionId}`,display=atlasQuestionLabel(questionId),answerText=Array.isArray(answer)?answer.join(', '):String(answer||'未答'),expectedText=Array.isArray(expected)?expected.join(' / '):String(expected);
    state.examEngine.attempts.push({id:'attempt-'+now+'-'+questionId,questionId:id,projectId:'ielts',type:'ielts_reading',answer:answerText,correct:score.ok,createdAt:now,sourceType:'atlas_remote'});
    if(!score.ok)state.examEngine.wrong[id]={questionId:id,projectId:'ielts',type:'ielts_reading',examId:meta.id,examTitle:meta.title,displayNumber:display,lastAnswer:answerText,correctAnswer:expectedText,lastAttemptAt:now,reviewStep:0,due:now,sourceType:'atlas_remote'};
    return {questionId,display,answerText,expectedText,score,explanation:explanations[questionId]||''};
  });
  if(state.examEngine.attempts.length>500)state.examEngine.attempts=state.examEngine.attempts.slice(-500);
  const historyItem={id:'atlas-attempt-'+now,examId:meta.id,title:meta.title,category:meta.category,correct,total,completedAt:now,durationSeconds:Math.max(1,Math.round((now-atlasSession.startedAt)/1000)),sourceCommit:atlasManifest.source.commit};
  state.examEngine.atlasHistory=[historyItem,...atlasHistory().filter(item=>item.examId!==meta.id)].slice(0,200);
  atlasSession.result={correct,total,rows};save({immediate:true,refresh:false});
  $('#submitAtlasReading').hidden=true;$('#atlasResult').hidden=false;
  $('#atlasResult').innerHTML=`<div class="atlas-score"><span>本地判分</span><b>${correct} / ${total}</b><p>历史与错题已保存到当前学习空间。</p></div><div class="atlas-review-list">${rows.map(row=>`<details class="atlas-review ${row.score.ok?'correct':'wrong'}"><summary>Question ${esc(row.display)} · ${row.score.ok?'正确':'需复习'}</summary><div class="answer-compare"><span>你的答案：${esc(row.answerText)}</span><span>参考答案：${esc(row.expectedText)}</span></div><p>${row.explanation?esc(row.explanation).replaceAll('\n','<br>'):'此题暂无现成解析。'}</p></details>`).join('')}</div>`;
  $('#atlasResult').scrollIntoView({behavior:'smooth',block:'start'});
}

$('#submitAtlasReading').onclick=submitAtlasReading;
$('#exitAtlasReading').onclick=()=>{atlasSession=null;nav('exam-engine')};
renderExamEngine();
