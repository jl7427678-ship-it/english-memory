(function(){
  'use strict';
  const config=window.ENGLISH_MEMORY_SYNC_CONFIG||{};
  const core=window.VocabularySyncCore;
  const TABLES={progress:'vocabulary_progress',resume:'vocabulary_resume',settings:'vocabulary_settings'};
  const RPC={progress:'merge_vocabulary_progress',resume:'merge_vocabulary_resume',settings:'merge_vocabulary_settings'};
  const ALLOWED_SETTINGS=new Set(['vocabBatchSize','vocabShowRelationsAfterAnswer']);
  const BATCH_SIZE=200,DEBOUNCE_MS=15000;
  let client=null,currentUser=null,syncing=false,syncTimer=null,supabaseLoader=null;

  function profileId(){return activeProfile().id}
  function randomId(prefix){return prefix+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2))}
  function deviceId(){
    const key='englishMemoryLab_vocabSync_device_v1';
    let value=localStorage.getItem(key);
    if(!value){value=randomId('device-');localStorage.setItem(key,value)}
    return value;
  }
  function storeKey(){return 'englishMemoryLab_vocabSync_v1:'+profileId()}
  function freshStore(){return {version:1,deviceId:deviceId(),lastSyncAt:null,dirty:{progress:{},resume:{},settings:{}},meta:{progress:{},resume:{},settings:{}}}}
  function loadStore(){
    try{
      const saved=JSON.parse(localStorage.getItem(storeKey())||'null');
      if(saved?.version===1){
        saved.dirty=saved.dirty||{progress:{},resume:{},settings:{}};
        saved.meta=saved.meta||{progress:{},resume:{},settings:{}};
        for(const kind of Object.keys(TABLES)){saved.dirty[kind]=saved.dirty[kind]||{};saved.meta[kind]=saved.meta[kind]||{}}
        saved.deviceId=saved.deviceId||deviceId();
        return saved;
      }
    }catch{}
    return freshStore();
  }
  let syncStore=loadStore();
  function persistStore(){localStorage.setItem(storeKey(),JSON.stringify(syncStore))}
  function version(){return {client_updated_at:Date.now(),device_id:syncStore.deviceId,mutation_id:randomId('m-')}}
  function localKey(kind,row){return kind==='progress'?core.progressKey(row):kind==='resume'?core.resumeKey(row):core.settingKey(row)}
  function queue(kind,row){
    const key=localKey(kind,row),v=version(),next={...row,...v,profile_id:profileId()};
    syncStore.meta[kind][key]={client_updated_at:next.client_updated_at,mutation_id:next.mutation_id};
    syncStore.dirty[kind][key]=next;
    persistStore();
    scheduleSync();
    renderSync();
    return next;
  }
  function progressRow(deck,word){
    if(!deck||!word)return null;
    return {
      profile_id:profileId(),deck_id:deck.id,lemma:normWord(word.word),
      status:(word.level||0)>=3?'mastered':(word.seen||0)>0?'learning':'unseen',
      recognition:word.quickStatus||'',level:Number(word.level||0),
      seen_count:Number(word.seen||0),correct_count:Number(word.correct||0),
      mistake_count:Number(word.wrong||0),first_seen:Number(word.firstSeen||0),
      last_reviewed:Number(word.last||0),next_review:Number(word.due||0),
      screen_repeats:Number(word.screenRepeats||1),screen_class:word.screenClass||'new'
    };
  }
  function rowFromBuiltin(key,values){
    const split=key.indexOf('|');
    if(split<1)return null;
    return {
      profile_id:profileId(),deck_id:key.slice(0,split),lemma:key.slice(split+1),
      status:(values[0]||0)>=3?'mastered':(values[2]||0)>0?'learning':'unseen',
      recognition:values[9]||'',level:Number(values[0]||0),next_review:Number(values[1]||0),
      seen_count:Number(values[2]||0),correct_count:Number(values[3]||0),
      mistake_count:Number(values[4]||0),last_reviewed:Number(values[5]||0),
      screen_repeats:Number(values[6]||1),screen_class:values[7]||'new',
      first_seen:Number(values[8]||0)
    };
  }
  function resumeRow(deckId){
    return {profile_id:profileId(),deck_id:deckId,cursor:Number(state.vocab.resume?.[deckId]||0),quick_cursor:Number(state.vocab.quickResume?.[deckId]||0),version:1};
  }
  function markProgress(deck,word){const row=progressRow(deck,word);if(row)queue('progress',row)}
  function markResume(deckId){if(deckId)queue('resume',resumeRow(deckId))}
  function markSetting(key){if(ALLOWED_SETTINGS.has(key))queue('settings',{profile_id:profileId(),setting_key:key,setting_value:state.settings[key]??null})}
  function isMeaningfulWord(word){return !!(word&&(word.level||word.due||word.seen||word.correct||word.wrong||word.last||word.firstSeen||word.quickStatus))}
  function seedLocalData(){
    for(const [key,values] of Object.entries(state.vocab.progress||{})){
      const row=rowFromBuiltin(key,values||[]);if(!row)continue;
      const id=core.progressKey(row);if(!syncStore.meta.progress[id]&&isMeaningfulWord({level:row.level,due:row.next_review,seen:row.seen_count,correct:row.correct_count,wrong:row.mistake_count,last:row.last_reviewed,firstSeen:row.first_seen,quickStatus:row.recognition}))queue('progress',row);
    }
    for(const deck of state.vocab.decks||[])for(const word of deck.words||[]){
      if(!isMeaningfulWord(word))continue;
      const row=progressRow(deck,word),id=core.progressKey(row);
      if(!syncStore.meta.progress[id])queue('progress',row);
    }
    const deckIds=new Set([...Object.keys(state.vocab.resume||{}),...Object.keys(state.vocab.quickResume||{})]);
    for(const deckId of deckIds){
      const row=resumeRow(deckId),id=core.resumeKey(row);
      if(!syncStore.meta.resume[id]&&(row.cursor||row.quick_cursor))queue('resume',row);
    }
    try{
      const raw=JSON.parse(localStorage.getItem(activeStateKey())||'{}');
      for(const key of ALLOWED_SETTINGS){
        if(!Object.prototype.hasOwnProperty.call(raw?.settings||{},key))continue;
        const row={profile_id:profileId(),setting_key:key,setting_value:state.settings[key]??null},id=core.settingKey(row);
        if(!syncStore.meta.settings[id])queue('settings',row);
      }
    }catch{}
  }
  function findCustomWord(deckId,lemma){
    const deck=(state.vocab.decks||[]).find(item=>item.id===deckId);
    return {deck,word:deck?.words?.find(item=>normWord(item.word)===lemma)};
  }
  function applyProgress(row){
    const key=core.progressKey(row),localVersion=syncStore.meta.progress[key];
    if(localVersion&&core.compareVersion(localVersion,row)>0)return false;
    const fields=[row.level,row.next_review,row.seen_count,row.correct_count,row.mistake_count,row.last_reviewed,row.screen_repeats,row.screen_class,row.first_seen,row.recognition];
    const builtinKey=progressKey(row.deck_id,row.lemma);
    if(Object.prototype.hasOwnProperty.call(state.vocab.progress||{},builtinKey)||BUILTIN_VOCAB[row.deck_id]){
      state.vocab.progress[builtinKey]=fields;
      const cached=builtinDeckCache.get(row.deck_id),word=cached?.words?.find(item=>normWord(item.word)===row.lemma);
      if(word)Object.assign(word,{level:row.level,due:row.next_review,seen:row.seen_count,correct:row.correct_count,wrong:row.mistake_count,last:row.last_reviewed,screenRepeats:row.screen_repeats,screenClass:row.screen_class,firstSeen:row.first_seen,quickStatus:row.recognition});
    }else{
      const {word}=findCustomWord(row.deck_id,row.lemma);
      if(!word)return false;
      Object.assign(word,{level:row.level,due:row.next_review,seen:row.seen_count,correct:row.correct_count,wrong:row.mistake_count,last:row.last_reviewed,screenRepeats:row.screen_repeats,screenClass:row.screen_class,firstSeen:row.first_seen,quickStatus:row.recognition});
    }
    syncStore.meta.progress[key]={client_updated_at:Number(row.client_updated_at||0),mutation_id:String(row.mutation_id||'')};
    return true;
  }
  function applyResume(row){
    const key=core.resumeKey(row),localVersion=syncStore.meta.resume[key];
    if(localVersion&&core.compareVersion(localVersion,row)>0)return false;
    state.vocab.resume[row.deck_id]=Math.max(0,Number(row.cursor||0));
    state.vocab.quickResume[row.deck_id]=Math.max(0,Number(row.quick_cursor||0));
    syncStore.meta.resume[key]={client_updated_at:Number(row.client_updated_at||0),mutation_id:String(row.mutation_id||'')};
    return true;
  }
  function applySetting(row){
    if(!ALLOWED_SETTINGS.has(row.setting_key))return false;
    const key=core.settingKey(row),localVersion=syncStore.meta.settings[key];
    if(localVersion&&core.compareVersion(localVersion,row)>0)return false;
    state.settings[row.setting_key]=row.setting_value;
    syncStore.meta.settings[key]={client_updated_at:Number(row.client_updated_at||0),mutation_id:String(row.mutation_id||'')};
    return true;
  }
  async function fetchAll(kind,since){
    const rows=[];let start=0;
    while(true){
      let query=client.from(TABLES[kind]).select('*').eq('profile_id',profileId()).order('server_updated_at',{ascending:true}).range(start,start+999);
      if(since)query=query.gt('server_updated_at',since);
      const {data,error}=await query;
      if(error)throw error;
      rows.push(...(data||[]));
      if(!data||data.length<1000)break;
      start+=1000;
    }
    return rows;
  }
  async function pull(since){
    let changed=false,maxServer=since||null;
    for(const kind of ['progress','resume','settings']){
      const rows=await fetchAll(kind,since);
      for(const row of rows){
        changed=(kind==='progress'?applyProgress(row):kind==='resume'?applyResume(row):applySetting(row))||changed;
        if(row.server_updated_at&&(!maxServer||row.server_updated_at>maxServer))maxServer=row.server_updated_at;
      }
    }
    if(changed){persistStateNow({refresh:true});if(typeof renderVocabHome==='function')renderVocabHome()}
    persistStore();
    return maxServer;
  }
  async function pushDirty(){
    for(const kind of ['progress','resume','settings']){
      while(true){
        const entries=Object.entries(syncStore.dirty[kind]).slice(0,BATCH_SIZE);
        if(!entries.length)break;
        const rows=entries.map(([,row])=>row);
        const {error}=await client.rpc(RPC[kind],{p_rows:rows});
        if(error)throw error;
        for(const [key,row] of entries)if(syncStore.dirty[kind][key]?.mutation_id===row.mutation_id)delete syncStore.dirty[kind][key];
        persistStore();
      }
    }
  }
  function dirtyCount(){return Object.values(syncStore.dirty).reduce((sum,items)=>sum+Object.keys(items).length,0)}
  async function syncNow({quiet=false}={}){
    clearTimeout(syncTimer);syncTimer=null;
    if(!client||!currentUser||syncing||!navigator.onLine)return false;
    syncing=true;renderSync('同步中…');
    try{
      seedLocalData();
      const since=syncStore.lastSyncAt;
      let newest=await pull(since);
      await pushDirty();
      newest=await pull(since)||newest;
      if(newest)syncStore.lastSyncAt=newest;
      persistStore();
      renderSync('已同步');
      if(!quiet)toast('词汇进度已同步');
      return true;
    }catch(error){
      console.warn('Vocabulary sync failed',error);
      renderSync('同步失败，本地学习不受影响');
      if(!quiet)toast('云同步失败，进度仍已保存在本机');
      return false;
    }finally{syncing=false}
  }
  function scheduleSync(delay=DEBOUNCE_MS){
    clearTimeout(syncTimer);
    if(!currentUser||!navigator.onLine)return;
    syncTimer=setTimeout(()=>syncNow({quiet:true}),delay);
  }
  function formatLastSync(){
    if(!syncStore.lastSyncAt)return '从未同步';
    const date=new Date(syncStore.lastSyncAt);
    return Number.isNaN(date.getTime())?'从未同步':date.toLocaleString();
  }
  function renderSync(message){
    const status=$('#vocabSyncStatus'),last=$('#vocabSyncLast'),identity=$('#vocabSyncIdentity');
    if(!status)return;
    if(!config.supabaseUrl||!config.supabasePublishableKey){status.textContent='尚未配置 Supabase';return}
    status.textContent=message||(currentUser?(navigator.onLine?'已登录 · 待同步 '+dirtyCount()+' 条':'已登录 · 当前离线'):'未登录');
    if(last)last.textContent=formatLastSync();
    if(identity)identity.textContent=currentUser?.email||'';
    $('#vocabSyncSignedOut').hidden=!!currentUser;
    $('#vocabSyncSignedIn').hidden=!currentUser;
  }
  function loadSupabase(){
    if(window.supabase?.createClient)return Promise.resolve(window.supabase);
    if(supabaseLoader)return supabaseLoader;
    supabaseLoader=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.crossOrigin='anonymous';
      script.onload=()=>resolve(window.supabase);
      script.onerror=()=>reject(new Error('Supabase client load failed'));
      document.head.appendChild(script);
    });
    return supabaseLoader;
  }
  async function sendOtp(){
    const email=$('#vocabSyncEmail').value.trim();
    if(!email)return toast('请先填写邮箱');
    const button=$('#vocabSyncSendOtp');button.disabled=true;
    try{
      const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
      if(error)throw error;
      $('#vocabSyncOtpWrap').hidden=false;
      toast('验证码已发送，请检查邮箱');
    }catch(error){toast('发送失败：'+error.message)}
    finally{button.disabled=false}
  }
  async function verifyOtp(){
    const email=$('#vocabSyncEmail').value.trim(),token=$('#vocabSyncOtp').value.trim();
    if(!email||!token)return toast('请填写邮箱和验证码');
    const button=$('#vocabSyncVerifyOtp');button.disabled=true;
    try{
      const {error}=await client.auth.verifyOtp({email,token,type:'email'});
      if(error)throw error;
      toast('登录成功');
    }catch(error){toast('验证码无效或已过期')}
    finally{button.disabled=false}
  }
  async function initAuth(){
    if(!core||!config.supabaseUrl||!config.supabasePublishableKey){renderSync();return}
    try{
      const lib=await loadSupabase();
      client=lib.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const {data}=await client.auth.getSession();
      currentUser=data.session?.user||null;renderSync();
      client.auth.onAuthStateChange((event,session)=>{
        currentUser=session?.user||null;renderSync();
        if(currentUser&&(event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED'))scheduleSync(0);
      });
      if(currentUser)scheduleSync(0);
    }catch(error){console.warn(error);renderSync('云服务暂不可用，本地学习不受影响')}
  }
  function wrapLearningActions(){
    const baseChoice=answerVocabChoice;
    answerVocabChoice=function(...args){
      const deck=activeVocabDeck(),word=currentVocabWord(),result=baseChoice.apply(this,args);
      if(deck&&word){markProgress(deck,word);markResume(deck.id)}
      return result;
    };
    const baseQuick=answerVocabQuick;
    answerVocabQuick=function(...args){
      const deck=quickDeck,word=quickWord(),result=baseQuick.apply(this,args);
      if(deck&&word)setTimeout(()=>{markProgress(deck,word);markResume(deck.id)},230);
      return result;
    };
    if(typeof checkVocabSpell==='function'){
      const baseSpell=checkVocabSpell;
      checkVocabSpell=function(...args){
        const deck=activeVocabDeck(),word=currentVocabWord(),result=baseSpell.apply(this,args);
        if(deck&&word){markProgress(deck,word);markResume(deck.id)}
        return result;
      };
    }
    if(typeof completeVocabScreen==='function'){
      const baseComplete=completeVocabScreen;
      completeVocabScreen=function(...args){
        const deck=activeVocabDeck(),ids=[...(state.vocab.session?.participants||[])],result=baseComplete.apply(this,args);
        if(deck)for(const id of ids){const word=wordById(deck,id);if(word)markProgress(deck,word)}
        if(deck)markResume(deck.id);scheduleSync(0);return result;
      };
    }
    $('#vocabBatchSize')?.addEventListener('change',()=>markSetting('vocabBatchSize'));
    $('#vocabShowRelationsAfterAnswer')?.addEventListener('change',()=>markSetting('vocabShowRelationsAfterAnswer'));
  }
  $('#vocabSyncSendOtp').onclick=sendOtp;
  $('#vocabSyncVerifyOtp').onclick=verifyOtp;
  $('#vocabSyncNow').onclick=()=>syncNow();
  $('#vocabSyncSignOut').onclick=async()=>{if(client)await client.auth.signOut();currentUser=null;renderSync();toast('已退出登录')};
  window.addEventListener('online',()=>{renderSync();scheduleSync(0)});
  window.addEventListener('offline',()=>renderSync());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')scheduleSync(0)});
  window.addEventListener('pagehide',()=>scheduleSync(0));
  wrapLearningActions();
  renderSync();
  initAuth();
  window.VocabularyCloudSync={syncNow,scheduleSync,dirtyCount};
})();
