let builtinExamPacks=[],builtinExamQuestions=[],practiceSession=null;
async function loadBuiltinExamPacks(){
  if(builtinExamPacks.length)return builtinExamPacks;
  const response=await fetch('data/exam-practice.json',{cache:'no-store'});
  if(!response.ok)throw new Error('练习题库加载失败');
  const catalog=await response.json();
  builtinExamPacks=(catalog.packs||[]).map(pack=>({...pack,label:catalog.label,notice:catalog.notice}));
  builtinExamQuestions=builtinExamPacks.flatMap(pack=>(pack.questions||[]).map(question=>normalizeExamQuestion({...question,projectId:pack.projectId,type:pack.type,section:pack.title,source:pack.source,sourceType:pack.sourceType,license:pack.license,attribution:pack.attribution,content:pack.content,simulation:true},pack.projectId)));
  return builtinExamPacks;
}
function allProjectExamQuestions(projectId,type=''){
  return [...state.examEngine.questions,...builtinExamQuestions].filter(question=>question.projectId===projectId&&(!type||question.type===type));
}
function normalizedExamAnswer(value){return String(value??'').trim().toLocaleLowerCase().replace(/[.,;:!?，。；：！？]/g,'').replace(/\s+/g,' ')}
function isObjectiveAnswerCorrect(question,value){const accepted=Array.isArray(question.answer)?question.answer:[question.answer];return accepted.some(answer=>normalizedExamAnswer(answer)===normalizedExamAnswer(value))}
function currentPracticeQuestion(){return practiceSession?.questions[practiceSession.index]||null}
function renderPracticeSession(){
  const shell=$('#practiceWorkspace');if(!shell)return;
  const question=currentPracticeQuestion();
  if(!question){shell.hidden=true;return}
  const progress=practiceSession.index+1;
  const answerOptions=question.options.length?`<div class="practice-options">${question.options.map((option,index)=>`<button class="practice-option" data-practice-answer="${esc(option)}"><span>${String.fromCharCode(65+index)}</span>${esc(option)}</button>`).join('')}</div>`:`<div class="practice-answer-row"><input class="field" id="practiceTextAnswer" autocomplete="off" placeholder="输入答案"><button class="btn primary" id="submitPracticeAnswer">提交答案</button></div>`;
  shell.hidden=false;
  shell.innerHTML=`<div class="practice-head"><div><span class="practice-label">Practice / Simulation · 非官方真题</span><h3>${esc(question.section)}</h3></div><b>${progress} / ${practiceSession.questions.length}</b></div>${question.content?.passage?`<details class="practice-passage" open><summary>${esc(question.content.title||'Reading passage')}</summary><div>${esc(question.content.passage).replaceAll('\n','<br>')}</div></details>`:''}<div class="practice-question"><span class="sub">Question ${progress}</span><p>${esc(question.stem)}</p>${answerOptions}<div id="practiceFeedback" aria-live="polite"></div></div><div class="practice-source">来源：${esc(question.attribution)} · ${esc(question.license)} · <a href="${esc(question.source?.repository||'#')}" target="_blank" rel="noopener">查看来源</a></div>`;
  $$('[data-practice-answer]').forEach(button=>button.onclick=()=>submitPracticeAnswer(button.dataset.practiceAnswer));
  const submit=$('#submitPracticeAnswer');if(submit)submit.onclick=()=>submitPracticeAnswer($('#practiceTextAnswer').value);
  const input=$('#practiceTextAnswer');if(input)input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();submitPracticeAnswer(input.value)}};
}
function submitPracticeAnswer(answer){
  const question=currentPracticeQuestion();if(!question||practiceSession.answered||!String(answer||'').trim())return;
  const correct=isObjectiveAnswerCorrect(question,answer),now=Date.now();practiceSession.answered=true;
  state.examEngine.attempts.push({id:'attempt-'+now,questionId:question.id,projectId:question.projectId,type:question.type,answer:String(answer),correct,createdAt:now,sourceType:question.sourceType});
  if(state.examEngine.attempts.length>500)state.examEngine.attempts=state.examEngine.attempts.slice(-500);
  if(!correct)state.examEngine.wrong[question.id]={questionId:question.id,projectId:question.projectId,type:question.type,lastAnswer:String(answer),lastAttemptAt:now,reviewStep:0,due:now};
  save({refresh:false});
  const expected=Array.isArray(question.answer)?question.answer[0]:question.answer;
  $('#practiceFeedback').innerHTML=`<div class="practice-result ${correct?'correct':'wrong'}"><b>${correct?'回答正确':'需要复习'}</b><span>参考答案：${esc(String(expected))}</span><small>${esc(question.explanation)}</small></div><button class="btn primary" id="nextPracticeQuestion">${practiceSession.index+1===practiceSession.questions.length?'完成训练':'下一题'}</button>`;
  $$('[data-practice-answer]').forEach(button=>{button.disabled=true;if(normalizedExamAnswer(button.dataset.practiceAnswer)===normalizedExamAnswer(expected))button.classList.add('correct')});
  $('#nextPracticeQuestion').onclick=()=>{practiceSession.index+=1;practiceSession.answered=false;if(practiceSession.index>=practiceSession.questions.length){practiceSession=null;$('#practiceWorkspace').innerHTML='<div class="practice-complete"><h3>本轮完成</h3><p>答题记录已保存到当前学习空间；错题已进入本地错题队列。</p><button class="btn" id="closePractice">返回题型</button></div>';$('#closePractice').onclick=()=>{$('#practiceWorkspace').hidden=true;renderExamEngine()};return}renderPracticeSession()};
}
function startBuiltinPractice(projectId,type){
  const questions=allProjectExamQuestions(projectId,type);if(!questions.length)return toast('这个分区暂时没有本地练习题');
  practiceSession={projectId,type,index:0,answered:false,questions:[...questions]};renderPracticeSession();$('#practiceWorkspace').scrollIntoView({behavior:'smooth',block:'start'});
}
loadBuiltinExamPacks().then(()=>renderExamEngine()).catch(error=>{console.error(error);renderExamEngine()});
