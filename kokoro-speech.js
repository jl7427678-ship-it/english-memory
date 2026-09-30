(function(){
  const voiceOptions=[
    {id:'af_heart',label:'Heart · 美式女声（推荐）'},
    {id:'af_bella',label:'Bella · 美式女声'},
    {id:'bf_emma',label:'Emma · 英式女声（推荐）'},
    {id:'bf_isabella',label:'Isabella · 英式女声'},
    {id:'bm_george',label:'George · 英式男声'},
    {id:'am_michael',label:'Michael · 美式男声'}
  ];
  let worker=null,ready=false,loadingPromise=null,resolveLoading=null,rejectLoading=null,requestId=0;
  let audioContext=null,scheduledAt=0,audioChain=Promise.resolve(),activeSources=new Set(),status={state:'idle',message:'尚未下载高质量语音模型'};

  function emit(next){status={...status,...next};window.dispatchEvent(new CustomEvent('kokoro-status',{detail:status}))}
  function ensureAudio(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return null;
    if(!audioContext)audioContext=new Context();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    return audioContext;
  }
  function unlockAudio(){
    const context=ensureAudio();if(!context)return false;
    try{
      const buffer=context.createBuffer(1,1,22050),source=context.createBufferSource();
      source.buffer=buffer;source.connect(context.destination);source.start(0);
    }catch{}
    return true;
  }
  function stopAudio(){for(const source of activeSources){try{source.stop()}catch{}}activeSources.clear();scheduledAt=0}
  async function playBlob(blob,id){
    if(id!==requestId)return;
    const context=ensureAudio();if(!context)throw new Error('设备不支持 Web Audio');
    if(context.state==='suspended')await context.resume();
    if(context.state!=='running')throw new Error('浏览器阻止了声音，请再点一次朗读');
    const buffer=await context.decodeAudioData(await blob.arrayBuffer());
    if(id!==requestId)return;
    const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
    const start=Math.max(context.currentTime+.04,scheduledAt||0);source.start(start);scheduledAt=start+buffer.duration;
    activeSources.add(source);source.onended=()=>activeSources.delete(source);
  }
  function rejectPending(error){if(rejectLoading)rejectLoading(error);resolveLoading=rejectLoading=null;loadingPromise=null}
  function friendlyError(error){const raw=String(error?.message||error||'Kokoro 加载失败');if(/memory|allocate|out of bounds|abort\(|worker.*terminated/i.test(raw))return new Error('Kokoro 模型已下载，但当前平板内存不足以初始化；关闭其他标签页后可重试');if(/fetch|network|download|下载|load failed/i.test(raw))return new Error('Kokoro 下载被网络中断，请保持页面打开后重试');return new Error(raw)}
  function resetWorker(error){const friendly=friendlyError(error);try{worker?.terminate()}catch{}worker=null;ready=false;rejectPending(friendly);emit({state:'error',message:friendly.message});return friendly}
  function ensureWorker(){
    if(worker)return worker;
    worker=new Worker('./kokoro-worker.js?v=20260930-3',{type:'module'});
    worker.onmessage=event=>{
      const data=event.data||{};
      if(data.type==='status')emit({state:data.state||'loading',message:data.message||'正在准备高质量语音…'});
      if(data.type==='ready'){
        ready=true;emit({state:'ready',message:'高质量语音已就绪'});
        if(resolveLoading)resolveLoading(true);resolveLoading=rejectLoading=null;
      }
      if(data.type==='audio')audioChain=audioChain.then(()=>playBlob(data.blob,data.id)).catch(error=>emit({state:'error',message:error.message}));
      if(data.type==='speech-start'&&data.id===requestId)emit({state:'speaking',message:`正在生成并朗读 ${data.total} 段`});
      if(data.type==='speech-done'&&data.id===requestId)emit({state:'ready',message:'朗读完成'});
      if(data.type==='error'||data.type==='speech-error')resetWorker(new Error(data.message||'高质量语音加载失败'));
    };
    worker.onerror=event=>resetWorker(new Error(event.message||'Kokoro Worker 已终止，通常是平板内存不足'));
    return worker;
  }
  function prepare(){
    ensureAudio();
    if(ready)return Promise.resolve(true);
    if(loadingPromise)return loadingPromise;
    loadingPromise=new Promise((resolve,reject)=>{resolveLoading=resolve;rejectLoading=reject});
    ensureWorker().postMessage({type:'prepare'});
    return loadingPromise;
  }
  function stop(){requestId++;stopAudio();audioChain=Promise.resolve();if(worker)worker.postMessage({type:'cancel',id:requestId});emit({state:ready?'ready':'idle',message:ready?'已停止 · 高质量语音已就绪':'已停止'})}
  async function speak(text,{voice='af_heart',speed=1}={}){
    const clean=String(text||'').trim();if(!clean)return false;
    stop();const id=requestId;ensureAudio();
    await prepare();if(id!==requestId)return false;
    scheduledAt=0;ensureWorker().postMessage({type:'speak',id,text:clean,voice,speed});return true;
  }
  function prime(){unlockAudio()}
  window.KokoroSpeech={prepare,speak,stop,prime,getStatus:()=>({...status}),voiceOptions};
  document.addEventListener('pointerdown',prime,{once:true,capture:true});
  document.addEventListener('keydown',prime,{once:true,capture:true});
})();
