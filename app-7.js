function profileId(){return 'profile-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)}
function switchProfile(id){if(id===activeProfile().id)return;persistStateNow();profileMeta.activeId=id;saveProfileMeta();location.reload()}
function renderProfileWorkspace(){
  const select=$('#profileSelect'),list=$('#projectManagerList');if(!select||!list)return;
  select.innerHTML=profileMeta.profiles.map(profile=>`<option value="${profile.id}">${esc(profile.name)}</option>`).join('');select.value=activeProfile().id;
  const projects=[...state.projects].sort((a,b)=>(a.order||0)-(b.order||0));
  list.innerHTML=projects.map((project,index)=>`<article class="project-manage-row ${project.archived?'archived':''}"><span class="project-glyph ${project.color||'violet'}">${esc(project.glyph||project.name.slice(0,1))}</span><div><b>${esc(project.name)}</b><small>${esc(project.description||project.type||'学习项目')}</small></div><span class="project-visibility">${project.archived?'已归档':project.visible?'首页显示':'已隐藏'}</span><div class="project-row-actions"><button class="btn" data-project-action="up" data-project-id="${project.id}" ${index===0?'disabled':''}>↑</button><button class="btn" data-project-action="down" data-project-id="${project.id}" ${index===projects.length-1?'disabled':''}>↓</button><button class="btn" data-project-action="toggle" data-project-id="${project.id}">${project.visible?'隐藏':'显示'}</button><button class="btn" data-project-action="archive" data-project-id="${project.id}">${project.archived?'恢复':'归档'}</button></div></article>`).join('');
  $$('[data-project-action]').forEach(button=>button.onclick=()=>updateProject(button.dataset.projectId,button.dataset.projectAction));
}
function updateProject(id,action){
  const projects=[...state.projects].sort((a,b)=>(a.order||0)-(b.order||0)),index=projects.findIndex(project=>project.id===id),project=projects[index];if(!project)return;
  if(action==='toggle'){project.visible=!project.visible;if(project.visible)project.archived=false}
  if(action==='archive'){project.archived=!project.archived;if(project.archived)project.visible=false}
  if(action==='up'&&index>0)[projects[index-1],projects[index]]=[projects[index],projects[index-1]];
  if(action==='down'&&index<projects.length-1)[projects[index+1],projects[index]]=[projects[index],projects[index+1]];
  projects.forEach((item,order)=>item.order=order);state.projects=projects;save();renderProfileWorkspace();renderToday();
}
$('#profileSelect').onchange=event=>switchProfile(event.target.value);
$('#addProfile').onclick=()=>{const name=prompt('新学习空间名称');if(!name?.trim())return;persistStateNow();const id=profileId();profileMeta.profiles.push({id,name:name.trim().slice(0,24),createdAt:Date.now()});profileMeta.activeId=id;saveProfileMeta();localStorage.setItem(activeStateKey(),JSON.stringify(structuredClone(defaultState)));location.reload()};
$('#renameProfile').onclick=()=>{const profile=activeProfile(),name=prompt('学习空间名称',profile.name);if(!name?.trim())return;profile.name=name.trim().slice(0,24);saveProfileMeta();renderProfileSummary();renderToday();toast('学习空间已改名')};
$('#deleteProfile').onclick=()=>{const profile=activeProfile();if(profile.id===DEFAULT_PROFILE_ID)return toast('默认学习空间不能删除');if(!confirm('删除“'+profile.name+'”及其中的全部本地学习数据？此操作无法恢复。'))return;localStorage.removeItem(activeStateKey());profileMeta.profiles=profileMeta.profiles.filter(item=>item.id!==profile.id);profileMeta.activeId=DEFAULT_PROFILE_ID;saveProfileMeta();location.reload()};
$('#addCustomProject').onclick=()=>{const input=$('#customProjectName'),name=input.value.trim();if(!name)return toast('先输入项目名称');state.projects.push({id:'custom-'+Date.now().toString(36),name:name.slice(0,40),type:$('#customProjectType').value,description:'自定义学习项目',glyph:name.slice(0,1),color:'violet',visible:true,archived:false,order:state.projects.length,examTypes:['choice','true_false','fill_blank']});input.value='';save();renderProfileWorkspace();renderToday();toast('项目已添加')};
renderProfileWorkspace();renderToday();
