(function(){
  const voiceOptions=[{id:'en_US-hfc_female-medium',label:'HFC Female · 美式女声（推荐）'},{id:'en_GB-alba-medium',label:'Alba · 英式女声（平板备用）'}];
  let worker=null,ready=false,loadingPromise=null,resolveLoading=null,rejectLoading=null,requestId=0,workerVoice='';
  let audioContext=null,scheduledAt=0,audioChain=Promise.resolve(),activeSources=new Set(),playbackSpeed=1,pendingAudio=null;
  let status={state:'idle',message:'Piper 尚未下载 · 首次约 80 MB，之后可离线使用'};

  function emit(next){status={...status,...next};window.dispatchEvent(new CustomEvent('piper-status',{detail:status}))}
  function ensureAudio(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return null;
    if(audioContext?.state==='closed')audioContext=null;
    if(!audioContext)audioContext=new Context();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    return audioContext;
  }
  function unlockAudio(){
    const context=ensureAudio();if(!context)return false;
    try{const buffer=context.createBuffer(1,1,22050),source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start(0)}catch{}
    if(pendingAudio&&pendingAudio.id===requestId){const saved=pendingAudio;pendingAudio=null;audioChain=audioChain.then(()=>playBlob(saved.blob,saved.id)).catch(error=>emit({state:'error',message:error.message}))}
    return true;
  }
  function stopAudio(){for(const source of activeSources){try{source.stop()}catch{}}activeSources.clear();scheduledAt=0;pendingAudio=null}
  async function playBlob(blob,id){
    if(id!==requestId)return;
    const context=ensureAudio();if(!context)throw new Error('设备不支持 Web Audio');
    if(context.state==='suspended')await context.resume();
    if(context.state!=='running'){pendingAudio={blob,id};throw new Error('声音已经生成；浏览器暂时拦截播放，请再点一次页面')}
    const buffer=await context.decodeAudioData(await blob.arrayBuffer());if(id!==requestId)return;
    const source=context.createBufferSource();source.buffer=buffer;source.playbackRate.value=playbackSpeed;source.connect(context.destination);
    const start=Math.max(context.currentTime+.04,scheduledAt||0);source.start(start);scheduledAt=start+buffer.duration/playbackSpeed;
    activeSources.add(source);source.onended=()=>activeSources.delete(source);
  }
  function rejectPending(error){if(rejectLoading)rejectLoading(error);resolveLoading=rejectLoading=null;loadingPromise=null}
  function selectWorkerVoice(voice){if(worker&&workerVoice&&workerVoice!==voice){try{worker.terminate()}catch{}worker=null;ready=false;loadingPromise=null;resolveLoading=rejectLoading=null}workerVoice=voice}
  function ensureWorker(){
    if(worker)return worker;
    worker=new Worker('./piper-worker.js?v=20260930-1',{type:'module'});
    worker.onmessage=event=>{
      const data=event.data||{};
      if(data.type==='status')emit({state:data.state||'loading',message:data.message||'正在准备 Piper…'});
      if(data.type==='ready'){
        ready=true;emit({state:'ready',message:'Piper 已就绪 · 模型保存在本机，可离线朗读'});
        if(resolveLoading)resolveLoading(true);resolveLoading=rejectLoading=null;
      }
      if(data.type==='audio')audioChain=audioChain.then(()=>playBlob(data.blob,data.id)).catch(error=>emit({state:'error',message:error.message}));
      if(data.type==='speech-start'&&data.id===requestId)emit({state:'speaking',message:`正在生成并朗读 ${data.total} 段`});
      if(data.type==='speech-done'&&data.id===requestId)emit({state:'ready',message:'朗读完成 · Piper 已保存在本机'});
      if(data.type==='error'||data.type==='speech-error'){
        const error=new Error(data.message||'Piper 加载失败');emit({state:'error',message:error.message});rejectPending(error);
      }
    };
    worker.onerror=event=>{const error=new Error(event.message||'Piper 组件加载失败');emit({state:'error',message:error.message});rejectPending(error)};
    return worker;
  }
  function prepare({voice='en_US-hfc_female-medium'}={}){
    ensureAudio();selectWorkerVoice(voice);if(ready)return Promise.resolve(true);if(loadingPromise)return loadingPromise;
    loadingPromise=new Promise((resolve,reject)=>{resolveLoading=resolve;rejectLoading=reject});
    ensureWorker().postMessage({type:'prepare',voice});return loadingPromise;
  }
  function stop(){requestId++;stopAudio();audioChain=Promise.resolve();if(worker)worker.postMessage({type:'cancel',id:requestId});emit({state:ready?'ready':'idle',message:ready?'已停止 · Piper 可继续离线使用':'已停止'})}
  async function speak(text,{voice='en_US-hfc_female-medium',speed=1}={}){
    const clean=String(text||'').trim();if(!clean)return false;
    stop();const id=requestId;playbackSpeed=Math.max(.75,Math.min(1.25,Number(speed)||1));ensureAudio();
    await prepare({voice});if(id!==requestId)return false;
    scheduledAt=0;ensureWorker().postMessage({type:'speak',id,text:clean,voice});return true;
  }
  function prime(){unlockAudio()}
  window.PiperSpeech={prepare,speak,stop,prime,getStatus:()=>({...status}),voiceOptions};
  document.addEventListener('pointerdown',prime,{capture:true});
  document.addEventListener('keydown',prime,{capture:true});
})();
