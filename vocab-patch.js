// TOEIC vocabulary patch: Core 1250 + Full 11154. Stable paged installer with retry/backoff.
(function(){
  const BAD_MEANING=/^(?:n\/?a|na|none|null|undefined|暂无释义|暂无|无|-)$/i;
  const validMeaning=v=>{v=String(v||'').trim();return !!v&&!BAD_MEANING.test(v)&&/[\u3400-\u9fff]/.test(v)};
  const DATASET='kknono668/toeic-vocab-tw';
  const ROWS_API='https://datasets-server.huggingface.co/rows';

  Object.assign(BUILTIN_VOCAB.toeic_core,{
    title:'TOEIC 核心 1250',expected:1250,icon:'💼',
    description:'从完整 TOEIC 双语词库中筛出的核心 1,250 词，优先按重要度学习。',
    source:'完整 TOEIC 单字库 · CC BY-SA 4.0',kind:'toeic',version:'2026.09.5'
  });
  BUILTIN_VOCAB.toeic_full={
    id:'toeic_full',title:'TOEIC 完整 11154',expected:11154,icon:'🧳',
    description:'完整 11,154 词 TOEIC 双语词库。首次安装采用稳定分批下载，之后直接读取本机缓存。',
    source:'完整 TOEIC 单字库 · CC BY-SA 4.0',kind:'toeic',version:'2026.09.5',deferred:true
  };

  const originalFetchWordTyper=fetchWordTyper;
  fetchWordTyper=async function(meta){
    const items=await originalFetchWordTyper(meta);
    return items.filter(x=>x.word&&validMeaning(x.meaning));
  };

  function statusEl(meta){return document.querySelector('[data-builtin-card="'+meta.id+'"] .install-status')}
  function installStatus(meta,text,cls='loading'){
    const el=statusEl(meta);if(el){el.textContent=text;el.className='install-status '+cls}
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  async function fetchPage(meta,offset,length=100){
    const u=new URL(ROWS_API);
    u.searchParams.set('dataset',DATASET);u.searchParams.set('config','default');u.searchParams.set('split','train');
    u.searchParams.set('offset',String(offset));u.searchParams.set('length',String(length));

    const waits=[0,2500,5000,10000,18000,30000,45000];
    let lastErr=null;
    for(let attempt=0;attempt<waits.length;attempt++){
      if(waits[attempt]){
        installStatus(meta,`下载到 ${offset} 词 · 网络限流，${Math.round(waits[attempt]/1000)} 秒后自动继续`);
        await sleep(waits[attempt]);
      }
      const ctl=new AbortController();
      const timer=setTimeout(()=>ctl.abort(),20000);
      try{
        const r=await fetch(u.toString(),{signal:ctl.signal});
        clearTimeout(timer);
        if(r.status===429||r.status===408||r.status>=500){
          lastErr=new Error('HTTP '+r.status);continue;
        }
        if(!r.ok)throw new Error('HTTP '+r.status);
        const j=await r.json();
        if(!Array.isArray(j.rows))throw new Error('词库接口格式异常');
        return {rows:j.rows.map(x=>x.row||{}),total:Number(j.num_rows_total||0)};
      }catch(e){
        clearTimeout(timer);lastErr=e;
        if(attempt===waits.length-1)break;
      }
    }
    throw lastErr||new Error('这一批下载失败');
  }

  async function fetchPages(meta,target){
    const results=[];
    let total=target;
    for(let offset=0;offset<total;offset+=100){
      installStatus(meta,`正在安装 ${Math.min(offset,total)} / ${total}`);
      const page=await fetchPage(meta,offset,Math.min(100,total-offset));
      if(page.total>0) total=Math.min(target,page.total);
      results.push(...page.rows);
      const done=Math.min(offset+page.rows.length,total);
      installStatus(meta,`正在安装 ${done} / ${total}`);
      // Avoid anonymous API burst throttling. Cached pages return immediately through the service worker.
      await sleep(450);
      if(offset>0&&offset%2000===0){
        installStatus(meta,`已完成 ${done} / ${total} · 稍等 3 秒继续`);
        await sleep(3000);
      }
      if(page.rows.length===0)break;
    }
    return results;
  }

  function compactRows(rows){
    const seen=new Set();
    return rows.map((x,i)=>({
      word:String(x.english_word||'').trim(),meaning:compactMeaning(x.chinese_definition||''),phonetic:'',
      star:Number(x.star_rating||0),category:String(x.category||''),i
    })).filter(x=>{
      const k=normWord(x.word);if(!x.word||!validMeaning(x.meaning)||seen.has(k))return false;seen.add(k);return true;
    });
  }

  fetchToeic=async function(meta){
    const target=meta.id==='toeic_core'?2200:11154;
    installStatus(meta,'正在连接完整词库…');
    let arr=compactRows(await fetchPages(meta,target));
    arr.sort((a,b)=>(b.star-a.star)||(a.i-b.i));
    installStatus(meta,'正在转换为简体中文…');
    await simplifyTraditional(arr);
    arr=arr.filter(x=>x.word&&validMeaning(x.meaning));
    if(meta.id==='toeic_core')return arr.slice(0,1250);
    return arr.slice(0,11154);
  };

  const originalDownloadBuiltin=downloadBuiltin;
  downloadBuiltin=async function(meta){
    const data=await originalDownloadBuiltin(meta);
    data.words=(data.words||[]).filter(x=>x.word&&validMeaning(x.meaning));
    if(!data.words.length)throw new Error('词库没有有效中文释义');
    await idbPutDeck(data);
    state.vocab.builtinInstalled[meta.id]={version:meta.version,count:data.words.length,cachedAt:data.cachedAt};save();
    return data;
  };

  preloadBuiltinDecks=async function(){
    for(const id of Object.keys(BUILTIN_VOCAB)){
      const meta=BUILTIN_VOCAB[id];
      if(state.vocab.builtinInstalled[id]){try{await ensureBuiltinDeck(id,false)}catch{}}
      else if(navigator.onLine&&!meta.deferred){await installBuiltin(id,false)}
    }
    renderBuiltinVocab();
  };

  renderBuiltinVocab=function(){
    const box=$('#builtinVocabList');if(!box)return;
    box.innerHTML=Object.values(BUILTIN_VOCAB).map(m=>{
      const info=state.vocab.builtinInstalled[m.id],cached=builtinDeckCache.get(m.id),count=cached?.words.length||info?.count||m.expected,ready=!!info;
      const pending=m.deferred?'点击安装':'首次打开自动安装';
      return `<div class="builtin-card" data-builtin-card="${m.id}"><div class="row between"><span style="font-size:22px">${m.icon}</span><span class="install-status ${ready?'ready':''}">${ready?'已缓存 '+count+' 词':pending}</span></div><div><h4>${esc(m.title)}</h4><div class="sub" style="margin-top:5px">${esc(m.description)}</div></div><div class="source">来源：${esc(m.source)}</div><div class="row"><button class="btn primary" data-builtin-screen="${m.id}">${ready?'四选一':'安装并开始'}</button><button class="btn" data-builtin-spell="${m.id}">拼写</button><button class="btn" data-builtin-refresh="${m.id}" title="重新下载词库">↻</button></div></div>`
    }).join('');
    $$('[data-builtin-screen]').forEach(b=>b.onclick=async()=>{const d=await installBuiltin(b.dataset.builtinScreen,false);if(d)startVocabScreen(d.id)});
    $$('[data-builtin-spell]').forEach(b=>b.onclick=async()=>{const d=await installBuiltin(b.dataset.builtinSpell,false);if(d)startVocabSpell(d.id)});
    $$('[data-builtin-refresh]').forEach(b=>b.onclick=async()=>installBuiltin(b.dataset.builtinRefresh,true));
  };
  setTimeout(()=>{try{renderVocabHome()}catch{}},0);
})();
