let italianCourseData=null,italianCourseLoading=null,italianLessonSession=null,italianExerciseDraft=null;
state.italianCourse=state.italianCourse||{};
state.italianCourse.completedLessons=state.italianCourse.completedLessons||{};
state.italianCourse.lessonResults=state.italianCourse.lessonResults||{};
state.italianCourse.currentLessonId=state.italianCourse.currentLessonId||null;
state.italianCourse.currentExercise=state.italianCourse.currentExercise||{};

async function loadItalianCourse(){
  if(italianCourseData)return italianCourseData;
  if(!italianCourseLoading)italianCourseLoading=fetch('data/italian-course.json').then(response=>{if(!response.ok)throw new Error('Italiano 课程读取失败');return response.json()}).then(data=>italianCourseData=data).finally(()=>italianCourseLoading=null);
  return italianCourseLoading;
}
function italianCourseUnits(){return italianCourseData?.sections?.flatMap(section=>section.units)||[]}
function italianCourseLessons(){return italianCourseUnits().flatMap((unit,unitIndex)=>unit.lessons.map((lesson,lessonIndex)=>({...lesson,unit,unitIndex,lessonIndex})))}
function italianLessonPosition(id){return italianCourseLessons().findIndex(lesson=>lesson.id===id)}
function italianLessonUnlocked(index){return index===0||Boolean(state.italianCourse.completedLessons[italianCourseLessons()[index-1]?.id])}
function italianNextLesson(){const lessons=italianCourseLessons();return lessons.find((lesson,index)=>italianLessonUnlocked(index)&&!state.italianCourse.completedLessons[lesson.id])||lessons.at(-1)}
function italianNormalize(value){return String(value||'').toLocaleLowerCase('en').normalize('NFKC').replace(/[.!?,;:'’"“”]/g,'').replace(/\s+/g,' ').trim()}
function italianExerciseInstruction(item){if(item.type==='select')return item.mode==='listen'?'听音选择':item.mode==='nativeToTarget'?'选择对应的意大利语':'选择正确含义';if(item.type==='wordBank')return'按顺序组成答案';if(item.type==='fillBlank')return'选择词语完成句子';if(item.type==='match')return'依次配对左右词语';return'输入对应的英文含义'}
function italianCourseSummary(){const lessons=italianCourseLessons(),done=lessons.filter(lesson=>state.italianCourse.completedLessons[lesson.id]).length,next=italianNextLesson(),number=Math.max(1,italianLessonPosition(next?.id)+1);return{lessons,done,next,number}}
function syncItalianToday(){if(!italianCourseData)return;const summary=italianCourseSummary(),task=TODAY_PROJECTS.find(item=>item.id==='italiano');if(task)task.meta=`继续第 ${summary.number} 课 · ${summary.next?.unit.titleZh||'零基础'}`}

async function renderItalianCourse(){
  const stage=$('#italianLessonStage');if(!stage)return;
  try{await loadItalianCourse();syncItalianToday();renderItalianCourseMap();const lessons=italianCourseLessons(),preferred=state.italianCourse.currentLessonId,next=italianNextLesson(),selected=lessons.find((lesson,index)=>lesson.id===preferred&&italianLessonUnlocked(index))||next||lessons[0];if(!italianLessonSession||italianLessonSession.lessonId!==selected.id)openItalianLesson(selected.id,false);else renderItalianExercise()}
  catch(error){stage.innerHTML=`<div class="italian-error"><b>课程暂时无法读取</b><p>${esc(error.message)}</p><button class="btn" id="retryItalianCourse">重试</button></div>`;$('#retryItalianCourse').onclick=()=>{italianCourseData=null;renderItalianCourse()}}
}
function renderItalianCourseMap(){
  const map=$('#italianCourseMap');if(!map||!italianCourseData)return;const summary=italianCourseSummary();
  $('#italianCourseProgress').textContent=`${summary.done} / ${summary.lessons.length}`;$('#italianCourseBar').style.width=Math.round(summary.done/summary.lessons.length*100)+'%';$('#italianCourseTitle').textContent=summary.done===summary.lessons.length?'入门课程已完成':`继续第 ${summary.number} 课`;
  map.innerHTML=italianCourseData.sections.map(section=>`<section class="italian-section"><h4>${esc(section.titleZh)}</h4>${section.units.map((unit,unitIndex)=>`<div class="italian-unit"><div><b>${unitIndex+1}. ${esc(unit.titleZh)}</b><small>${esc(unit.title)}</small></div><div class="italian-lesson-grid">${unit.lessons.map(lesson=>{const index=italianLessonPosition(lesson.id),done=Boolean(state.italianCourse.completedLessons[lesson.id]),locked=!italianLessonUnlocked(index),active=italianLessonSession?.lessonId===lesson.id;return`<button class="italian-lesson-dot ${done?'done':''} ${active?'active':''}" data-italian-lesson="${lesson.id}" ${locked?'disabled':''} title="${locked?'请先完成上一课':unit.titleZh+' '+lesson.titleZh}">${done?'✓':index+1}</button>`}).join('')}</div></div>`).join('')}</section>`).join('');
  $$('[data-italian-lesson]').forEach(button=>button.onclick=()=>openItalianLesson(button.dataset.italianLesson,true));
}
function openItalianLesson(id,persist=true){
  const lessons=italianCourseLessons(),index=italianLessonPosition(id);if(index<0||!italianLessonUnlocked(index))return toast('请先完成上一课');const lesson=lessons[index],saved=Math.max(0,Math.min(lesson.exercises.length-1,Number(state.italianCourse.currentExercise[id])||0));state.italianCourse.currentLessonId=id;italianLessonSession={lessonId:id,index:saved,correct:0,answered:0};italianExerciseDraft=null;if(persist)save();renderItalianCourseMap();renderItalianExercise()
}
function italianAudioButton(item){return item.audioTarget?`<button class="btn italian-speak" id="italianSpeak">🔊 朗读</button>`:''}
function renderItalianExercise(){
  const stage=$('#italianLessonStage'),lesson=italianCourseLessons().find(item=>item.id===italianLessonSession?.lessonId);if(!stage||!lesson)return;const item=lesson.exercises[italianLessonSession.index];if(!item)return finishItalianLesson(lesson);italianExerciseDraft={selected:[],matches:{},activeTarget:null,answered:false};
  const progress=italianLessonSession.index+1,body=italianExerciseBody(item);
  stage.innerHTML=`<div class="italian-lesson-head"><div><span class="tag">${esc(lesson.unit.titleZh)}</span><h3>${esc(lesson.titleZh)}</h3><p>${esc(italianExerciseInstruction(item))}</p></div><b>${progress} / ${lesson.exercises.length}</b></div><div class="progress italian-exercise-progress"><i style="width:${Math.round((progress-1)/lesson.exercises.length*100)}%"></i></div><div class="italian-exercise" id="italianExercise">${body}</div><div class="italian-feedback" id="italianFeedback" aria-live="polite"></div><details class="italian-guide"><summary>本单元语法与提示</summary><div>${italianGuideMarkup(lesson.unit.guidebook)}</div></details>`;
  bindItalianExercise(item);if($('#italianSpeak'))$('#italianSpeak').onclick=()=>speak(item.audioTarget,{userInitiated:true,lang:'it-IT'});
}
function italianGuideMarkup(text){return esc(text||'').replace(/^##? (.+)$/gm,'<h4>$1</h4>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/^- (.+)$/gm,'<div>• $1</div>').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')}
function italianExerciseBody(item){
  if(item.type==='select'){const prompt=item.mode==='listen'?'<p class="italian-listen-prompt">点击“朗读”，再选择听到的内容。</p>':`<div class="italian-prompt">${esc(item.prompt)}</div>`;return`${prompt}${italianAudioButton(item)}<div class="italian-options">${item.options.map((option,index)=>`<button data-italian-choice="${index}">${esc(option.text??option)}</button>`).join('')}</div>`}
  if(item.type==='fillBlank')return`<div class="italian-prompt">${esc(item.sentence)}</div><p class="sub">${esc(item.translation||'')}</p>${italianAudioButton(item)}<div class="italian-options">${item.options.map((option,index)=>`<button data-italian-choice="${index}">${esc(option)}</button>`).join('')}</div>`;
  if(item.type==='wordBank')return`<div class="italian-prompt">${esc(item.prompt)}</div>${italianAudioButton(item)}<div class="italian-built-answer" id="italianBuiltAnswer">点击下方词块组成答案</div><div class="italian-word-bank">${item.tokens.map((token,index)=>`<button data-italian-token="${index}">${esc(token)}</button>`).join('')}</div><div class="row"><button class="btn" id="italianClearTokens">清空</button><button class="btn primary" id="italianCheckTokens">检查</button></div>`;
  if(item.type==='match'){const targets=item.pairs.map(pair=>pair.target),natives=item.pairs.map(pair=>pair.native).sort((a,b)=>a.localeCompare(b));return`<div class="italian-match"><div>${targets.map((text,index)=>`<button data-match-target="${index}">${esc(text)}</button>`).join('')}</div><div>${natives.map((text,index)=>`<button data-match-native="${index}">${esc(text)}</button>`).join('')}</div></div>`}
  return`<div class="italian-prompt">${esc(item.prompt)}</div>${italianAudioButton(item)}<div class="italian-type-row"><input class="field" id="italianTypeAnswer" autocomplete="off" autocapitalize="sentences" placeholder="输入英文答案"><button class="btn primary" id="italianCheckType">检查</button></div>`;
}
function bindItalianExercise(item){
  $$('[data-italian-choice]').forEach(button=>button.onclick=()=>{if(italianExerciseDraft.answered)return;const index=Number(button.dataset.italianChoice),correct=index===Number(item.correct);$$('[data-italian-choice]').forEach((candidate,candidateIndex)=>{candidate.disabled=true;if(candidateIndex===Number(item.correct))candidate.classList.add('correct');else if(candidateIndex===index)candidate.classList.add('wrong')});gradeItalianExercise(correct,item)});
  $$('[data-italian-token]').forEach(button=>button.onclick=()=>{if(italianExerciseDraft.answered)return;const index=Number(button.dataset.italianToken);italianExerciseDraft.selected.push(item.tokens[index]);button.disabled=true;button.dataset.used=String(italianExerciseDraft.selected.length-1);$('#italianBuiltAnswer').textContent=italianExerciseDraft.selected.join(' ')});
  if($('#italianClearTokens'))$('#italianClearTokens').onclick=()=>{italianExerciseDraft.selected=[];$$('[data-italian-token]').forEach(button=>button.disabled=false);$('#italianBuiltAnswer').textContent='点击下方词块组成答案'};
  if($('#italianCheckTokens'))$('#italianCheckTokens').onclick=()=>gradeItalianExercise(italianNormalize(italianExerciseDraft.selected.join(' '))===italianNormalize(item.answer.join(' ')),item,item.answer.join(' '));
  $$('[data-match-target]').forEach(button=>button.onclick=()=>{if(button.classList.contains('matched'))return;$$('[data-match-target]').forEach(x=>x.classList.remove('selected'));button.classList.add('selected');italianExerciseDraft.activeTarget=Number(button.dataset.matchTarget)});
  $$('[data-match-native]').forEach(button=>button.onclick=()=>{const targetIndex=italianExerciseDraft.activeTarget;if(targetIndex===null||button.classList.contains('matched'))return toast('先点左边的意大利语');const pair=item.pairs[targetIndex],correct=pair.native===button.textContent;if(!correct){button.classList.add('wrong');setTimeout(()=>button.classList.remove('wrong'),450);return}italianExerciseDraft.matches[targetIndex]=true;button.classList.add('matched');const target=$(`[data-match-target="${targetIndex}"]`);target.classList.remove('selected');target.classList.add('matched');italianExerciseDraft.activeTarget=null;if(Object.keys(italianExerciseDraft.matches).length===item.pairs.length)gradeItalianExercise(true,item)});
  if($('#italianCheckType'))$('#italianCheckType').onclick=()=>{const input=$('#italianTypeAnswer'),answers=[item.answer,...(item.alternatives||[])];gradeItalianExercise(answers.some(answer=>italianNormalize(answer)===italianNormalize(input.value)),item,item.answer)};
  if($('#italianTypeAnswer'))$('#italianTypeAnswer').onkeydown=event=>{if(event.key==='Enter'){$('#italianCheckType').click()}};
}
function italianCorrectAnswer(item,explicit){if(explicit)return explicit;if(item.type==='select'||item.type==='fillBlank')return item.options[Number(item.correct)]?.text??item.options[Number(item.correct)];if(item.type==='wordBank')return item.answer.join(' ');return item.answer||''}
function gradeItalianExercise(correct,item,explicitAnswer=''){
  if(italianExerciseDraft.answered)return;italianExerciseDraft.answered=true;italianLessonSession.answered++;if(correct)italianLessonSession.correct++;state.italianCourse.currentExercise[italianLessonSession.lessonId]=italianLessonSession.index;save({refresh:false});const answer=italianCorrectAnswer(item,explicitAnswer),last=italianLessonSession.index>=italianCourseLessons().find(x=>x.id===italianLessonSession.lessonId).exercises.length-1;
  $('#italianFeedback').innerHTML=`<div class="${correct?'correct':'wrong'}"><b>${correct?'回答正确':'再记一下'}</b>${correct?'':`<span>参考答案：${esc(answer)}</span>`}<button class="btn primary" id="italianContinue">${last?'完成本课':'继续'}</button></div>`;$('#italianContinue').onclick=()=>{if(last)finishItalianLesson(italianCourseLessons().find(x=>x.id===italianLessonSession.lessonId));else{italianLessonSession.index++;state.italianCourse.currentExercise[italianLessonSession.lessonId]=italianLessonSession.index;save({refresh:false});renderItalianExercise()}}
}
function finishItalianLesson(lesson){
  const total=lesson.exercises.length,correct=italianLessonSession.correct,previous=state.italianCourse.lessonResults[lesson.id];state.italianCourse.completedLessons[lesson.id]=Date.now();state.italianCourse.lessonResults[lesson.id]={correct:Math.max(correct,previous?.correct||0),total,completedAt:Date.now()};delete state.italianCourse.currentExercise[lesson.id];const lessons=italianCourseLessons(),next=lessons[italianLessonPosition(lesson.id)+1];state.italianCourse.currentLessonId=next?.id||lesson.id;save({immediate:true,refresh:false});renderItalianCourseMap();syncItalianToday();renderToday();
  $('#italianLessonStage').innerHTML=`<div class="italian-lesson-complete"><span>✓</span><h3>${esc(lesson.titleZh)}完成</h3><p>本轮答对 ${correct} / ${total}。${next?'下一课已经解锁。':'20 课入门主线已经全部完成。'}</p><div class="row">${next?'<button class="btn primary" id="italianNextLesson">进入下一课</button>':''}<button class="btn" id="italianRepeatLesson">再练一次</button></div></div>`;if($('#italianNextLesson'))$('#italianNextLesson').onclick=()=>openItalianLesson(next.id,true);$('#italianRepeatLesson').onclick=()=>{state.italianCourse.currentExercise[lesson.id]=0;openItalianLesson(lesson.id,true)};
}

loadItalianCourse().then(()=>{syncItalianToday();renderToday()}).catch(()=>{});
