// TOEIC vocabulary patch: Core 1250 + Full 11154. Uses Hugging Face Dataset Viewer row API instead of a 22.6 MB one-shot file.
(function(){
  const BAD_MEANING=/^(?:n\/?a|na|none|null|undefined|暂无释义|暂无|无|-)$/i;
  const validMeaning=v=>{v=String(v||'').trim();return !!v&&!BAD_MEANING.test(v)&&/[\u3400-\u9fff]/.test(v)};
  const DATASET='kknono668/toeic-vocab-tw';
  const ROWS_API='https://datasets-server.huggingface.co/rows';

  Object.assign(BUILTIN_VOCAB.toeic_core,{
    title:'TOEIC 核心 1250',expected:1250,icon:'💼',
    description:'从完整 TOEIC 双语词库中筛出的核心 1,250 词，优先按重要度学习。',
    source:'完整 TOEIC 单字库 · CC BY-SA 4.0',kind:'toeic',version:'2026.09.4'
  });
  BUILTIN_VOCAB.toeic_full={
    id:'toeic_full',title:'TOEIC 完整 11154',expected:11154,icon:'🧳',
    description:'完整 11,154 词 TOEIC 双语词库。采用轻量分批安装，不再一次下载 22.6 MB 大文件。',
    source:'完整 TOEIC 单字库 · CC BY-SA 4.0',kind:'toeic',version:'2026.09.4',deferred:true
  };

  const originalFetchWordTyper=fetchWordTyper;
  fetchWordTyper=async function(meta){
    const items=await originalFetchWordTyper(meta);
    return items.filter(x=>x.word&&validMeaning(x.meaning));
  };

  function installStatus(meta,text){
    const el=document.querySelector('[data-builtin-card="'+meta.id+'"] .install-status');
    if(el){el.textContent=text;el.className='install-status loading'}
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function fetchPage(offset,length=100,retry=0){
    const u=new URL(ROWS_API);
    u.searchParams.set('dataset',DATASET);u.searchParams.set('config','default');u.searchParams.set('split','train');
    u.searchParams.set('offset',String(offset));u.searchParams.set('length',String(length));
    try{
      const r=await fetch(u.toString(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const j=await r.json();
      if(!Array.isArray(j.rows))throw new Error('词库接口格式异常');
      return j.rows.map(x=>x.row||{});
    }catch(e){
      if(retry<2){await sleep(500*(retry+1));return fetchPage(offset,length,retry+1)}
      throw e;
    }
  }
  async function fetchPages(meta,total){
    const offsets=[];for(let i=0;i<total;i+=100)offsets.push(i);
    const results=new Array(offsets.length);let next=0,done=0;
    async function worker(){
      while(true){
        const idx=next++;if(idx>=offsets.length)return;
        results[idx]=await fetchPage(offsets[idx],Math.min(100,total-offsets[idx]));
        done++;installStatus(meta,`正在安装 ${Math.min(done*100,total)} / ${total}`);
      }
    }
    await Promise.all(Array.from({length:Math.min(6,offsets.length)},worker));
    return results.flat();
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
    // Core only needs a smaller candidate window; full deck loads every row in lightweight 100-row slices.
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
