const KOKORO_MODULE='https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const MODEL_ID='onnx-community/Kokoro-82M-v1.0-ONNX';
const MODEL_URL='https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx';
const MODEL_CACHE='transformers-cache';
const CHUNK_SIZE=4*1024*1024;
let tts=null,loading=null,activeJob=0,pendingJob=null,running=false;

function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function streamIntoCache(response,cache,attempt){
  const total=Number(response.headers.get('content-length'))||0;
  if(!response.body){await cache.put(MODEL_URL,response);return}
  const reader=response.body.getReader();let received=0,lastProgress=-1;
  const stream=new ReadableStream({async pull(controller){
    try{
      const {done,value}=await reader.read();
      if(done){controller.close();return}
      received+=value.byteLength;controller.enqueue(value);
      const progress=total?Math.floor(received/total*100):0;
      if(progress>=lastProgress+2){lastProgress=progress;postMessage({type:'status',state:'loading',message:total?`正在稳健下载 Kokoro ${progress}%（第 ${attempt}/3 次）`:`正在稳健下载 Kokoro（第 ${attempt}/3 次）`})}
    }catch(error){controller.error(error)}
  },cancel:reason=>reader.cancel(reason)});
  await cache.put(MODEL_URL,new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers}));
}
function chunkUrl(index){return new URL(`/__kokoro_cache__/model_quantized.part-${index}`,self.location.origin).href}
async function cacheModelInChunks(cache){
  const probe=await fetch(MODEL_URL,{headers:{Range:'bytes=0-0'},cache:'no-store'});
  const match=/\/(\d+)$/.exec(probe.headers.get('content-range')||'');
  if(probe.status!==206||!match){
    if(!probe.ok)throw new Error(`模型下载返回 ${probe.status}`);
    if(probe.status===206){try{await probe.body?.cancel()}catch{};const response=await fetch(MODEL_URL,{cache:'no-store'});if(!response.ok)throw new Error(`模型下载返回 ${response.status}`);await streamIntoCache(response,cache,1)}
    else await streamIntoCache(probe,cache,1);
    return;
  }
  try{await probe.body?.cancel()}catch{}
  const total=Number(match[1]),count=Math.ceil(total/CHUNK_SIZE);
  for(let index=0;index<count;index++){
    const start=index*CHUNK_SIZE,end=Math.min(total-1,start+CHUNK_SIZE-1),url=chunkUrl(index),expected=end-start+1;
    const existing=await cache.match(url);
    if(existing&&Number(existing.headers.get('content-length'))===expected){
      postMessage({type:'status',state:'loading',message:`继续 Kokoro 下载 ${Math.round((index+1)/count*100)}%（已缓存）`});continue;
    }
    const response=await fetch(MODEL_URL,{headers:{Range:`bytes=${start}-${end}`},cache:'no-store'});
    if(response.status!==206)throw new Error(`分块下载返回 ${response.status}`);
    const data=await response.arrayBuffer();
    if(data.byteLength!==expected)throw new Error(`分块 ${index+1} 长度不完整`);
    await cache.put(url,new Response(data,{headers:{'content-length':String(expected),'content-type':'application/octet-stream'}}));
    postMessage({type:'status',state:'loading',message:`正在断点下载 Kokoro ${Math.round((index+1)/count*100)}%（${index+1}/${count}）`});
    await wait(40);
  }
  postMessage({type:'status',state:'loading',message:'分块下载完成，正在合并本机缓存…'});
  let index=0;
  const body=new ReadableStream({async pull(controller){
    if(index>=count){controller.close();return}
    const response=await cache.match(chunkUrl(index++));
    if(!response){controller.error(new Error('Kokoro 缓存分块缺失'));return}
    controller.enqueue(new Uint8Array(await response.arrayBuffer()));
  }});
  await cache.put(MODEL_URL,new Response(body,{headers:{'content-length':String(total),'content-type':'application/octet-stream'}}));
  for(let i=0;i<count;i++)await cache.delete(chunkUrl(i));
}
async function ensureModelCached(){
  if(typeof caches==='undefined')return false;
  const cache=await caches.open(MODEL_CACHE),cached=await cache.match(MODEL_URL);
  if(cached){postMessage({type:'status',state:'loading',message:'已找到本机 Kokoro 模型，正在初始化…'});return true}
  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      postMessage({type:'status',state:'loading',message:`正在连接 Kokoro 分块下载（第 ${attempt}/3 次）`});
      await cacheModelInChunks(cache);
      postMessage({type:'status',state:'downloaded',message:'Kokoro 已完整下载；请点第二步初始化'});
      await wait(500);
      return true;
    }catch(error){lastError=error;await wait(attempt*800)}
  }
  throw new Error(`Kokoro 模型下载中断：${lastError?.message||'网络错误'}`);
}

function progressText(event){
  if(!event||typeof event!=='object')return '正在准备高质量语音…';
  if(event.status==='progress'&&Number.isFinite(event.progress))return `正在下载语音模型 ${Math.round(event.progress)}%`;
  if(event.status==='initiate')return `正在下载 ${String(event.file||'语音模型').split('/').pop()}`;
  if(event.status==='done')return '正在初始化语音模型…';
  return '正在准备高质量语音…';
}
function tabletLike(){const ua=self.navigator?.userAgent||'';return /Android|iPad|iPhone|Mobile/i.test(ua)||(/Macintosh/i.test(ua)&&(self.navigator?.maxTouchPoints||0)>1)}
async function chooseBackend(){
  if(tabletLike()){
    if(self.navigator?.gpu){
      try{const adapter=await self.navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(adapter)return'webgpu'}catch{}
    }
    throw new Error('这台平板没有可用的 WebGPU；Kokoro 的 WASM 初始化会导致页面重载，已安全停止。请使用 Piper 本地人声');
  }
  // Desktop WebGPU drivers can complete inference yet return corrupted audio.
  // WASM is slower, but deterministic and is the safe default for Kokoro speech.
  return'wasm';
}

async function loadModel(){
  if(tts)return tts;
  if(loading)return loading;
  loading=(async()=>{
    postMessage({type:'status',state:'loading',message:'首次使用需下载约 92 MB；平板将分阶段缓存并初始化'});
    await ensureModelCached();
    const device=await chooseBackend();
    postMessage({type:'status',state:'loading',message:device==='webgpu'?'正在用平板 GPU 初始化 Kokoro…':'正在用电脑稳定模式初始化 Kokoro…'});
    const {KokoroTTS}=await import(KOKORO_MODULE);
    tts=await KokoroTTS.from_pretrained(MODEL_ID,{
      dtype:'q8',
      device,
      progress_callback:event=>postMessage({type:'status',state:'loading',message:progressText(event)})
    });
    postMessage({type:'ready'});
    return tts;
  })().catch(error=>{
    loading=null;
    postMessage({type:'error',message:error?.message||String(error)});
    throw error;
  });
  return loading;
}

function splitLongPiece(piece,maxLength){
  const words=piece.split(/\s+/).filter(Boolean),out=[];let line='';
  for(const word of words){
    if(line&&line.length+word.length+1>maxLength){out.push(line);line=word}else line+=(line?' ':'')+word;
  }
  if(line)out.push(line);
  return out;
}

function splitText(text,maxLength=220){
  const clean=String(text||'').replace(/\s+/g,' ').trim();
  if(!clean)return[];
  const sentences=clean.match(/[^.!?。！？]+[.!?。！？]*/g)||[clean],chunks=[];let chunk='';
  for(const raw of sentences){
    const sentence=raw.trim();if(!sentence)continue;
    if(sentence.length>maxLength){
      if(chunk){chunks.push(chunk);chunk=''}
      chunks.push(...splitLongPiece(sentence,maxLength));
    }else if(chunk&&chunk.length+sentence.length+1>maxLength){chunks.push(chunk);chunk=sentence}
    else chunk+=(chunk?' ':'')+sentence;
  }
  if(chunk)chunks.push(chunk);
  return chunks;
}

async function runJobs(){
  if(running)return;
  running=true;
  try{
    while(pendingJob){
      const job=pendingJob;pendingJob=null;activeJob=job.id;
      const model=await loadModel();
      if(activeJob!==job.id)continue;
      const chunks=splitText(job.text);
      postMessage({type:'speech-start',id:job.id,total:chunks.length});
      for(let index=0;index<chunks.length;index++){
        if(activeJob!==job.id)break;
        const audio=await model.generate(chunks[index],{voice:job.voice||'af_heart',speed:job.speed||1});
        if(activeJob!==job.id)break;
        postMessage({type:'audio',id:job.id,index,total:chunks.length,blob:audio.toBlob()});
      }
      if(activeJob===job.id)postMessage({type:'speech-done',id:job.id});
    }
  }catch(error){postMessage({type:'speech-error',id:activeJob,message:error?.message||String(error)})}
  finally{running=false;if(pendingJob)runJobs()}
}

self.onmessage=event=>{
  const data=event.data||{};
  if(data.type==='download')ensureModelCached().then(()=>postMessage({type:'downloaded'})).catch(error=>postMessage({type:'error',message:error?.message||String(error)}));
  if(data.type==='prepare')loadModel().catch(()=>{});
  if(data.type==='cancel'){activeJob=Number(data.id)||0;pendingJob=null}
  if(data.type==='speak'){activeJob=data.id;pendingJob=data;runJobs()}
};
