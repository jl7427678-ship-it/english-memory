const KEY='englishMemoryLab_v1';
const PROFILE_META_KEY='englishMemoryLab_profiles_v1',DEFAULT_PROFILE_ID='local-default';
function defaultProjects(){return [
  {id:'toeic',name:'TOEIC',type:'language_exam',description:'背词、串题、写作与机考训练',glyph:'T',color:'violet',visible:true,archived:false,order:0},
  {id:'ielts',name:'IELTS',type:'language_exam',description:'核心词汇与后续听读写说训练',glyph:'I',color:'blue',visible:false,archived:false,order:1},
  {id:'italiano',name:'Italiano',type:'language',description:'意大利语词汇与基础训练',glyph:'It',color:'green',visible:false,archived:false,order:2},
  {id:'politics',name:'考研政治',type:'postgraduate_exam',description:'政治资料与真题训练',glyph:'政',color:'red',visible:false,archived:false,order:3},
  {id:'chinese',name:'汉语言',type:'major_course',description:'先秦文学 · 名词解释 · 简答 · 论述',glyph:'文',color:'amber',visible:true,archived:false,order:4},
  {id:'land',name:'土地资源管理',type:'major_course',description:'专业课资料与真题',glyph:'土',color:'cyan',visible:false,archived:false,order:5},
  {id:'kaoyan-english',name:'考研英语',type:'language_exam',description:'保留现有考研英语词库',glyph:'研',color:'blue',visible:false,archived:false,order:6},
  {id:'custom',name:'自定义考试 / 专业课',type:'custom',description:'按自己的资料和题型建立项目',glyph:'＋',color:'violet',visible:false,archived:false,order:7}
]}
const defaultState={docs:[],activeDoc:null,study:{index:0,mode:'full'},logs:{},vocab:{decks:[],activeDeck:null,session:null,builtinInstalled:{},progress:{}},vocabLogs:{},todayChecklist:{},projects:defaultProjects(),questionEngine:{drafts:{},review:{},checks:{},planTasks:[],activePlanId:null},settings:{speechRate:.9,speechLang:'en-US',apiEndpoint:'',apiModel:'',apiKey:'',vocabBatchSize:'100'}};
function freshProfileMeta(){return {version:1,activeId:DEFAULT_PROFILE_ID,profiles:[{id:DEFAULT_PROFILE_ID,name:'静',createdAt:Date.now()}]}}
function loadProfileMeta(){try{const parsed=JSON.parse(localStorage.getItem(PROFILE_META_KEY)||'null');if(parsed?.profiles?.length&&parsed.profiles.some(profile=>profile.id===parsed.activeId))return parsed}catch{}const meta=freshProfileMeta();localStorage.setItem(PROFILE_META_KEY,JSON.stringify(meta));return meta}
let profileMeta=loadProfileMeta();
function activeProfile(){return profileMeta.profiles.find(profile=>profile.id===profileMeta.activeId)||profileMeta.profiles[0]}
function activeStateKey(){return activeProfile().id===DEFAULT_PROFILE_ID?KEY:KEY+':profile:'+activeProfile().id}
function saveProfileMeta(){localStorage.setItem(PROFILE_META_KEY,JSON.stringify(profileMeta))}
let state=load(); state.vocab=state.vocab||{decks:[],activeDeck:null,session:null,builtinInstalled:{},progress:{}}; state.vocab.decks=state.vocab.decks||[]; state.vocab.builtinInstalled=state.vocab.builtinInstalled||{}; state.vocab.progress=state.vocab.progress||{}; state.vocabLogs=state.vocabLogs||{}; state.todayChecklist=state.todayChecklist||{}; state.projects=Array.isArray(state.projects)&&state.projects.length?state.projects:defaultProjects(); state.questionEngine=state.questionEngine||{}; state.questionEngine.drafts=state.questionEngine.drafts||{}; state.questionEngine.review=state.questionEngine.review||{}; state.questionEngine.checks=state.questionEngine.checks||{}; state.questionEngine.planTasks=state.questionEngine.planTasks||[]; state.questionEngine.activePlanId=state.questionEngine.activePlanId||null; state.settings=state.settings||{}; state.settings.vocabBatchSize=state.settings.vocabBatchSize||'100'; let recognition=null; let examQ=0; let vocabAdvanceTimer=null; const builtinDeckCache=new Map(); const deckIndexCache=new WeakMap();
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function load(){try{return {...structuredClone(defaultState),...JSON.parse(localStorage.getItem(activeStateKey())||'{}')}}catch{return structuredClone(defaultState)}}
const STATE_WRITE_DELAY=900,STATE_WRITE_MIN_INTERVAL=5000;
let stateWriteTimer=null,lastStateWrite=0;
function refreshAfterStateChange(){if(typeof refreshDashboard==='function')refreshDashboard()}
function persistStateNow({refresh=false}={}){
  clearTimeout(stateWriteTimer);stateWriteTimer=null;
  localStorage.setItem(activeStateKey(),JSON.stringify(state));lastStateWrite=Date.now();
  if(refresh)refreshAfterStateChange();
}
function save({immediate=false,refresh=true}={}){
  if(immediate){persistStateNow({refresh});return}
  if(refresh)refreshAfterStateChange();
  if(stateWriteTimer)return;
  const sinceLast=Date.now()-lastStateWrite;
  const delay=Math.max(STATE_WRITE_DELAY,STATE_WRITE_MIN_INTERVAL-sinceLast);
  stateWriteTimer=setTimeout(()=>persistStateNow(),delay);
}
window.addEventListener('pagehide',()=>persistStateNow());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistStateNow()});
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function nav(page){const parent={study:'training',vocab:'training',exam:'training',review:'training','preqin-literature':'library',stats:'me',settings:'me'}[page]||page;$$('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+page));$$('.navbtn').forEach(x=>x.classList.toggle('active',x.dataset.page===parent));if(page==='today')renderToday();if(page==='me')renderProfileSummary();if(page==='review')renderReview();if(page==='stats')renderStats();if(page==='exam')renderExam();if(page==='vocab')renderVocabHome();if(page==='preqin-literature')renderPreqinCourse();if(page==='plan')renderCoursePlans();window.scrollTo({top:0,behavior:'smooth'})}
$$('.navbtn').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.page)));
$$('[data-go-page]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.goPage)));
const stop=new Set('the a an and or but if when while to of in on at for from with as is are was were be been being i you he she it we they my your his her our their this that these those do does did have has had can could should would will may might very much more most some any each every about into than then so also not because therefore however instead during after before who whom which what where why how through between according several really make made making get got good great important experience thing things people person'.split(' '));
function splitSentences(t){return (t.replace(/\r/g,'\n').match(/[^.!?。！？\n]+[.!?。！？]+|[^.!?。！？\n]+$/g)||[]).map(s=>s.trim()).filter(s=>/[A-Za-z]/.test(s)&&s.length>5).slice(0,500)}
