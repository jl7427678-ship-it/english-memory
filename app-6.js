const QUESTION_CATALOG_URL='data/preqin-literature.json';
let questionCatalog=null;
const courseView={type:'term_definition',module:'all',index:0};
let courseDraftTimer=null;

async function loadQuestionCatalog(){
  if(questionCatalog)return questionCatalog;
  const response=await fetch(QUESTION_CATALOG_URL,{cache:'no-store'});
  if(!response.ok)throw new Error('先秦文学题库加载失败');
  questionCatalog=await response.json();
  return questionCatalog;
}

function questionAnswerText(value=''){
  return String(value).toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'');
}

function answerHas(answer,term){
  const needle=questionAnswerText(term);
  return needle&&answer.includes(needle);
}

function pointCovered(answer,point,type){
  const terms=type==='term_definition'?(point.terms||[]):(point.keywords||[]);
  if(!terms.length)return false;
  const hits=terms.filter(term=>answerHas(answer,term)).length;
  return type==='term_definition'?hits>0:hits>=Math.max(1,Math.ceil(terms.length/2));
}

function courseQuestions(){
  if(!questionCatalog)return[];
  return questionCatalog.questions.filter(question=>question.type===courseView.type&&(courseView.module==='all'||question.moduleId===courseView.module));
}

function currentCourseQuestion(){
  const questions=courseQuestions();
  if(!questions.length)return null;
  courseView.index=Math.max(0,Math.min(courseView.index,questions.length-1));
  return questions[courseView.index];
}

function courseQuestionItems(question){
  if(question.type==='term_definition')return question.keywords||[];
  if(question.type==='short_answer')return question.scorePoints||[];
  return question.outlinePoints||[];
}

function countChineseWords(text=''){
  return String(text).replace(/\s/g,'').length;
}

function setReferencePanel(button,panel,showLabel,hideLabel){
  const shouldShow=panel.hidden;
  panel.hidden=!shouldShow;
  button.textContent=shouldShow?hideLabel:showLabel;
}

function saveCourseDraft(question,notify=true){
  if(!question)return;
  clearTimeout(courseDraftTimer);courseDraftTimer=null;
  state.questionEngine.drafts[question.id]=$('#courseAnswerInput').value;
  save({immediate:notify});
  $('#courseDraftStatus').textContent='草稿已保存';
  if(notify)toast('草稿已保存');
}

function scheduleCourseDraftSave(question){
  if(!question)return;
  state.questionEngine.drafts[question.id]=$('#courseAnswerInput').value;
  clearTimeout(courseDraftTimer);
  $('#courseDraftStatus').textContent='正在保存…';
  courseDraftTimer=setTimeout(()=>saveCourseDraft(question,false),800);
}

function courseTypeLabel(type){
  return questionCatalog?.course.typeLabels[type]||type;
}

function renderQuestionTabs(){
  const course=questionCatalog.course;
  $('#questionTypeTabs').innerHTML=course.allowedTypes.map(type=>`<button class="mode ${courseView.type===type?'active':''}" data-question-type="${type}">${esc(course.typeLabels[type])}</button>`).join('');
  $$('[data-question-type]').forEach(button=>button.onclick=()=>{courseView.type=button.dataset.questionType;courseView.index=0;renderPreqinQuestion();renderQuestionTabs()});
}

function renderCoursePlanTemplates(){
  $('#coursePlanTemplates').innerHTML=questionCatalog.course.planTemplates.map(template=>`<button class="btn" data-plan-type="${template.type}" data-plan-count="${template.count}">${esc(template.label)}</button>`).join('');
  $$('[data-plan-type]').forEach(button=>button.onclick=()=>createCoursePlan(button.dataset.planType,Number(button.dataset.planCount)));
}

function renderPreqinQuestion(){
  const question=currentCourseQuestion(),questions=courseQuestions();
  if(!question){$('#courseQuestionStem').textContent='当前筛选下没有题目';return}
  const module=questionCatalog.course.modules.find(item=>item.id===question.moduleId);
  $('#courseQuestionType').textContent=courseTypeLabel(question.type);
  $('#courseQuestionModule').textContent=module?.name||question.moduleId;
  $('#courseQuestionProgress').textContent=(courseView.index+1)+' / '+questions.length;
  $('#courseQuestionStem').textContent=question.stem;
  $('#courseAnswerInput').value=state.questionEngine.drafts[question.id]||'';
  $('#courseAnswerInput').classList.toggle('essay-answer',question.type==='essay');
  $('#courseWordCount').textContent=countChineseWords($('#courseAnswerInput').value)+' 字';
  $('#courseDraftStatus').textContent=state.questionEngine.drafts[question.id]!==undefined?'草稿已保存':'草稿未保存';
  $('#toggleCourseReview').textContent=state.questionEngine.review[question.id]?'移出待复习':'加入待复习';
  $('#courseCheckResult').innerHTML='';
  const items=courseQuestionItems(question);
  $('#courseOutlinePanel').innerHTML=items.length?`<ul>${items.map(item=>`<li>${esc(item.label)}</li>`).join('')}</ul>`:'<p>本题没有单独提纲。</p>';
  $('#courseReferencePanel').innerHTML=`<p>${esc(question.referenceAnswer)}</p>`;
  $('#courseSourcePanel').innerHTML=`<b>${esc(question.source.material)}</b><p>${esc(question.source.section)}</p><p>${esc(question.source.excerpt)}</p>`;
  for(const id of ['courseOutlinePanel','courseReferencePanel','courseSourcePanel'])$('#'+id).hidden=true;
  $('#toggleCourseOutline').textContent='查看答题提纲';
  $('#toggleCourseReference').textContent='查看参考答案';
  $('#toggleCourseSource').textContent='查看资料依据';
}

async function renderPreqinCourse(){
  try{
    await loadQuestionCatalog();
    if(!questionCatalog.course.allowedTypes.includes(courseView.type))courseView.type=questionCatalog.course.allowedTypes[0];
    $('#questionModuleFilter').innerHTML='<option value="all">全部资料</option>'+questionCatalog.course.modules.map(module=>`<option value="${module.id}">${esc(module.name)}</option>`).join('');
    $('#questionModuleFilter').value=courseView.module;
    renderQuestionTabs();
    renderCoursePlanTemplates();
    renderPreqinQuestion();
  }catch(error){
    console.error(error);
    $('#courseQuestionStem').textContent='题库加载失败，请联网刷新一次。';
  }
}

function updateActiveCoursePlan(question,covered,total){
  const task=state.questionEngine.planTasks.find(item=>item.id===state.questionEngine.activePlanId&&item.courseId===question.courseId&&item.type===question.type&&!item.completed);
  if(!task)return null;
  task.questionIds=task.questionIds||[];
  task.checks=task.checks||{};
  if(!task.questionIds.includes(question.id)&&task.questionIds.length<task.target)task.questionIds.push(question.id);
  if(task.questionIds.includes(question.id))task.checks[question.id]=total?covered/total:0;
  const rates=task.questionIds.map(id=>task.checks[id]||0);
  task.coverageRate=rates.length?Math.round(rates.reduce((sum,value)=>sum+value,0)/rates.length*100):0;
  task.completed=task.questionIds.length>=task.target;
  if(task.completed){task.completedAt=Date.now();state.questionEngine.activePlanId=null}
  return task;
}

function checkCourseAnswer(){
  const question=currentCourseQuestion(),input=$('#courseAnswerInput').value.trim();
  if(!question||!input)return toast('先输入答案再检查');
  saveCourseDraft(question,false);
  const normalized=questionAnswerText(input),items=courseQuestionItems(question),coveredItems=items.filter(item=>pointCovered(normalized,item,question.type)),missingItems=items.filter(item=>!coveredItems.includes(item));
  const result={covered:coveredItems.length,total:items.length,checkedAt:Date.now(),chars:countChineseWords(input)};
  state.questionEngine.checks[question.id]=result;
  const task=updateActiveCoursePlan(question,result.covered,result.total);
  save();
  const coveredTitle=question.type==='term_definition'?'已覆盖关键点':'已覆盖';
  const missingTitle=question.type==='term_definition'?'尚未检测到':'可能遗漏';
  const structure=question.type==='essay'?`<div class="structure-hint"><b>结构提示</b><p>${input.split(/\n+/).filter(Boolean).length>=3?'已用分段组织答案。':'当前分段较少，可按“观点—材料—影响/比较”拆成至少三段。'}</p></div>`:'';
  $('#courseCheckResult').innerHTML=`<div class="coverage-summary"><b>${coveredTitle} ${result.covered} / ${result.total} 个${question.type==='term_definition'?'关键点':'评分点'}</b><span>${result.chars} 字</span></div><div class="coverage-columns"><div><b>${coveredTitle}</b>${coveredItems.length?`<ul>${coveredItems.map(item=>`<li>${esc(item.label)}</li>`).join('')}</ul>`:'<p>暂未检测到。</p>'}</div><div><b>${missingTitle}</b>${missingItems.length?`<ul>${missingItems.map(item=>`<li>${esc(item.label)}</li>`).join('')}</ul>`:'<p>资料中的主要点已覆盖。</p>'}</div></div>${structure}<p class="coverage-note">这是关键词覆盖检查，不是语义评分或正式考试分数。</p>`;
  if(task?.completed)toast('计划题量已完成 ✓');
  else if(task)toast(`计划进度 ${task.questionIds.length} / ${task.target}`);
}

function createCoursePlan(type,count){
  const existing=state.questionEngine.planTasks.find(task=>task.courseId==='preqin-literature'&&task.type===type&&!task.completed);
  if(existing){
    state.questionEngine.activePlanId=existing.id;
    courseView.type=type;courseView.module='all';courseView.index=0;
    save();renderQuestionTabs();renderPreqinQuestion();toast('已继续现有计划');return;
  }
  const task={id:'plan-'+Date.now(),projectId:'chinese',courseId:'preqin-literature',title:'先秦文学 '+courseTypeLabel(type)+' × '+count,type,target:count,questionIds:[],checks:{},coverageRate:0,completed:false,createdAt:Date.now()};
  state.questionEngine.planTasks.unshift(task);
  state.questionEngine.activePlanId=task.id;
  courseView.type=type;courseView.module='all';courseView.index=0;
  save();renderQuestionTabs();renderPreqinQuestion();toast('已加入计划');
}

async function renderCoursePlans(){
  const box=$('#coursePlanList');
  if(!box)return;
  try{await loadQuestionCatalog()}catch(error){box.innerHTML='<div class="empty">计划数据暂时无法载入。</div>';return}
  const tasks=state.questionEngine.planTasks;
  if(!tasks.length){box.innerHTML='<div class="empty">还没有先秦文学计划。进入课程后可一键添加 5 道名词解释、3 道简答或 1 道论述。</div>';return}
  box.innerHTML=tasks.map(task=>{const done=(task.questionIds||[]).length;return `<article class="course-plan-item ${task.completed?'complete':''}"><div><b>${esc(task.title)}</b><p>${done} / ${task.target} 题 · 基础覆盖率 ${task.coverageRate||0}%</p></div><span class="plan-state">${task.completed?'已完成':state.questionEngine.activePlanId===task.id?'进行中':'未完成'}</span>${task.completed?'':`<button class="btn" data-start-course-plan="${task.id}">开始</button>`}</article>`}).join('');
  $$('[data-start-course-plan]').forEach(button=>button.onclick=()=>startCoursePlan(button.dataset.startCoursePlan));
}

function startCoursePlan(id){
  const task=state.questionEngine.planTasks.find(item=>item.id===id);
  if(!task)return;
  state.questionEngine.activePlanId=id;
  courseView.type=task.type;courseView.module='all';courseView.index=0;
  save();nav('preqin-literature');
}

$('#questionModuleFilter').onchange=event=>{courseView.module=event.target.value;courseView.index=0;renderPreqinQuestion()};
$('#courseAnswerInput').oninput=()=>{$('#courseWordCount').textContent=countChineseWords($('#courseAnswerInput').value)+' 字';scheduleCourseDraftSave(currentCourseQuestion())};
$('#saveCourseDraft').onclick=()=>saveCourseDraft(currentCourseQuestion());
$('#checkCourseAnswer').onclick=checkCourseAnswer;
$('#toggleCourseReview').onclick=()=>{const question=currentCourseQuestion();if(!question)return;if(state.questionEngine.review[question.id])delete state.questionEngine.review[question.id];else state.questionEngine.review[question.id]={addedAt:Date.now(),courseId:question.courseId};save();$('#toggleCourseReview').textContent=state.questionEngine.review[question.id]?'移出待复习':'加入待复习';toast(state.questionEngine.review[question.id]?'已加入待复习':'已移出待复习')};
$('#prevCourseQuestion').onclick=()=>{const questions=courseQuestions();if(!questions.length)return;courseView.index=(courseView.index-1+questions.length)%questions.length;renderPreqinQuestion()};
$('#nextCourseQuestion').onclick=()=>{const questions=courseQuestions();if(!questions.length)return;courseView.index=(courseView.index+1)%questions.length;renderPreqinQuestion()};
$('#toggleCourseOutline').onclick=()=>setReferencePanel($('#toggleCourseOutline'),$('#courseOutlinePanel'),'查看答题提纲','隐藏答题提纲');
$('#toggleCourseReference').onclick=()=>setReferencePanel($('#toggleCourseReference'),$('#courseReferencePanel'),'查看参考答案','隐藏参考答案');
$('#toggleCourseSource').onclick=()=>setReferencePanel($('#toggleCourseSource'),$('#courseSourcePanel'),'查看资料依据','隐藏资料依据');
