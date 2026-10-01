(function(){
  const voiceOptions=[
    {id:'af_heart',label:'Heart · 美式女声（推荐）'},
    {id:'af_bella',label:'Bella · 美式女声'},
    {id:'bf_emma',label:'Emma · 英式女声（推荐）'},
    {id:'bf_isabella',label:'Isabella · 英式女声'},
    {id:'bm_george',label:'George · 英式男声'},
    {id:'am_michael',label:'Michael · 美式男声'}
  ];
  let worker=null,ready=false,loadingPromise=null,resolveLoading=null,rejectLoading=null,downloadPromise=null,resolveDownload=null,rejectDownload=null,requestId=0;
  const MODEL_URL='https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx';
  let audioContext=null,scheduledAt=0,audioChain=Promise.resolve(),activeSources=new Set(),pendingAudio=null,status={state:'idle',message:'正在检查 Kokoro 模型…'};

  function emit(next){status={...status,...next};window.dispatchEvent(new CustomEvent('kokoro-status',{detail:status}))}
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
    try{
      const buffer=context.createBuffer(1,1,22050),source=context.createBufferSource();
      source.buffer=buffer;source.connect(context.destination);source.start(0);
    }catch{}
    if(pendingAudio&&pendingAudio.id===requestId){const saved=pendingAudio;pendingAudio=null;audioChain=audioChain.then(()=>playBlob(saved.blob,saved.id)).catch(error=>emit({state:'error',message:error.message}))}
    return true;
  }
  function stopAudio(){for(const source of activeSources){try{source.stop()}catch{}}activeSources.clear();scheduledAt=0;pendingAudio=null}
  async function playBlob(blob,id){
    if(id!==requestId)return;
    const context=ensureAudio();if(!context)throw new Error('设备不支持 Web Audio');
    if(context.state==='suspended')await context.resume();
    if(context.state!=='running'){pendingAudio={blob,id};throw new Error('声音已经生成；浏览器暂时拦截播放，请再点一次页面')}
    const buffer=await context.decodeAudioData(await blob.arrayBuffer());
    if(id!==requestId)return;
    const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
    const start=Math.max(context.currentTime+.04,scheduledAt||0);source.start(start);scheduledAt=start+buffer.duration;
    activeSources.add(source);source.onended=()=>activeSources.delete(source);
  }
  function rejectPending(error){if(rejectLoading)rejectLoading(error);if(rejectDownload)rejectDownload(error);resolveLoading=rejectLoading=null;resolveDownload=rejectDownload=null;loadingPromise=null;downloadPromise=null}
  function friendlyError(error){const raw=String(error?.message||error||'Kokoro 加载失败');if(/memory|allocate|out of bounds|abort\(|worker.*terminated/i.test(raw))return new Error('Kokoro 模型已下载，但当前平板内存不足以初始化；关闭其他标签页后可重试');if(/fetch|network|download|下载|load failed/i.test(raw))return new Error('Kokoro 下载被网络中断，请保持页面打开后重试');return new Error(raw)}
  function resetWorker(error){const friendly=friendlyError(error);try{worker?.terminate()}catch{}worker=null;ready=false;rejectPending(friendly);emit({state:'error',message:friendly.message});return friendly}
  function ensureWorker(){
    if(worker)return worker;
    worker=new Worker('./kokoro-worker.js?v=20261001-6',{type:'module'});
    worker.onmessage=event=>{
      const data=event.data||{};
      if(data.type==='status')emit({state:data.state||'loading',message:data.message||'正在准备高质量语音…'});
      if(data.type==='ready'){
        ready=true;emit({state:'ready',message:'高质量语音已就绪'});
        if(resolveLoading)resolveLoading(true);resolveLoading=rejectLoading=null;
      }
      if(data.type==='downloaded'){
        emit({state:'downloaded',message:'Kokoro 已完整下载；请点第二步初始化'});
        if(resolveDownload)resolveDownload(true);resolveDownload=rejectDownload=null;downloadPromise=null;
      }
      if(data.type==='audio')audioChain=audioChain.then(()=>playBlob(data.blob,data.id)).catch(error=>emit({state:'error',message:error.message}));
      if(data.type==='speech-start'&&data.id===requestId)emit({state:'speaking',message:`正在生成并朗读 ${data.total} 段`});
      if(data.type==='speech-done'&&data.id===requestId)emit({state:'ready',message:'朗读完成'});
      if(data.type==='error'||data.type==='speech-error')resetWorker(new Error(data.message||'高质量语音加载失败'));
    };
    worker.onerror=event=>resetWorker(new Error(event.message||'Kokoro Worker 已终止，通常是平板内存不足'));
    return worker;
  }
  async function prepare(){
    ensureAudio();
    if(ready)return true;
    if(loadingPromise)return loadingPromise;
    const cache=await caches.open('transformers-cache'),cached=await cache.match(MODEL_URL);
    if(!cached)throw new Error('请先完成第一步 Kokoro 断点下载');
    loadingPromise=new Promise((resolve,reject)=>{resolveLoading=resolve;rejectLoading=reject});
    ensureWorker().postMessage({type:'prepare'});
    return loadingPromise;
  }
  function download(){
    ensureAudio();if(ready)return Promise.resolve(true);if(downloadPromise)return downloadPromise;
    downloadPromise=new Promise((resolve,reject)=>{resolveDownload=resolve;rejectDownload=reject});
    ensureWorker().postMessage({type:'download'});return downloadPromise;
  }
  async function detectCached(){try{const cache=await caches.open('transformers-cache');if(await cache.match(MODEL_URL))emit({state:'downloaded',message:'已找到完整 Kokoro 模型；请点第二步初始化'});else emit({state:'missing',message:'当前设备没有 Kokoro 模型，请重新下载一次；今后网站更新不会再清除模型'})}catch{emit({state:'missing',message:'无法读取本机 Kokoro 模型，请重新下载一次'})}}
  function stop(){requestId++;stopAudio();audioChain=Promise.resolve();if(worker)worker.postMessage({type:'cancel',id:requestId});emit({state:ready?'ready':'idle',message:ready?'已停止 · 高质量语音已就绪':'已停止'})}
  async function speak(text,{voice='af_heart',speed=1}={}){
    const clean=String(text||'').trim();if(!clean)return false;
    if(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(clean))throw new Error('Kokoro 只支持英文；含中文的内容请使用设备中文人声');
    if(!/[A-Za-z]/.test(clean))throw new Error('Kokoro 没有识别到可朗读的英文文本');
    stop();const id=requestId;ensureAudio();
    await prepare();if(id!==requestId)return false;
    scheduledAt=0;ensureWorker().postMessage({type:'speak',id,text:clean,voice,speed});return true;
  }
  function prime(){unlockAudio()}
  window.KokoroSpeech={download,prepare,speak,stop,prime,getStatus:()=>({...status}),voiceOptions};
  detectCached();
  document.addEventListener('pointerdown',prime,{capture:true});
  document.addEventListener('keydown',prime,{capture:true});
})();
