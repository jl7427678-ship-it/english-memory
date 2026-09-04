// TOEIC vocabulary patch: keep both Core 1250 and Full 9537 decks, with Chinese-only valid meanings.
(function(){
  const BAD_MEANING=/^(?:n\/?a|na|none|null|undefined|暂无释义|暂无|无|-)$/i;
  const validMeaning=v=>{v=String(v||'').trim();return !!v&&!BAD_MEANING.test(v)&&/[\u3400-\u9fff]/.test(v)};

  Object.assign(BUILTIN_VOCAB.toeic_core,{
    title:'TOEIC 核心 1250',
    expected:1250,
    description:'从 9,537 词完整 TOEIC 双语词库中按重要度筛出的核心 1,250 词。',
    source:'完整 TOEIC 单字库（English–Chinese）· CC BY 4.0',
    kind:'toeic',
    version:'2026.09.2'
  });

  BUILTIN_VOCAB.toeic_full={
    id:'toeic_full',
    title:'TOEIC 完整 9537',
    expected:9537,
    icon:'🧳',
    description:'完整 9,537 词 TOEIC 双语词库；含中文释义，适合核心词学完后继续扩展。',
    source:'完整 TOEIC 单字库（English–Chinese）· CC BY 4.0',
    kind:'toeic',
    version:'2026.09.2',
    deferred:true
  };

  const originalFetchWordTyper=fetchWordTyper;
  fetchWordTyper=async function(meta){
    const items=await originalFetchWordTyper(meta);
    return items.filter(x=>x.word&&validMeaning(x.meaning));
  };

  fetchToeic=async function(meta){
    const url='https://huggingface.co/datasets/LEE-WHITE/toeic-vocab-tw/resolve/main/data/toeic_vocabulary.json';
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok)throw new Error('TOEIC 完整词库下载失败 HTTP '+r.status);
    const j=await r.json();
    let arr=(Array.isArray(j)?j:[]).map((x,i)=>({
      word:String(x.english_word||'').trim(),
      meaning:compactMeaning(x.chinese_definition||''),
      phonetic:'',
      star:Number(x.star_rating||0),
      category:String(x.category||''),
      i
    })).filter(x=>x.word&&validMeaning(x.meaning));
    arr.sort((a,b)=>(b.star-a.star)||(a.i-b.i));
    await simplifyTraditional(arr);
    arr=arr.filter(x=>x.word&&validMeaning(x.meaning));
    if(meta.id==='toeic_core') return arr.slice(0,1250);
    return arr.slice(0,9537);
  };

  const originalDownloadBuiltin=downloadBuiltin;
  downloadBuiltin=async function(meta){
    const data=await originalDownloadBuiltin(meta);
    data.words=(data.words||[]).filter(x=>x.word&&validMeaning(x.meaning));
    if(!data.words.length)throw new Error('词库没有有效中文释义');
    await idbPutDeck(data);
    state.vocab.builtinInstalled[meta.id]={version:meta.version,count:data.words.length,cachedAt:data.cachedAt};
    save();
    return data;
  };

  preloadBuiltinDecks=async function(){
    for(const id of Object.keys(BUILTIN_VOCAB)){
      const meta=BUILTIN_VOCAB[id];
      if(state.vocab.builtinInstalled[id]){
        try{await ensureBuiltinDeck(id,false)}catch{}
      }else if(navigator.onLine&&!meta.deferred){
        await installBuiltin(id,false);
      }
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
})();
