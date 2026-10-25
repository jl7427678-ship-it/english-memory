// Pre-generated Kokoro audio. No model or external speech service is used here.
(function(){
  const CACHE='english-memory-dictation-audio-v1',MANIFEST='data/ielts-listening-300-audio.json';
  const base=new URL('./',document.baseURI),buffers=new Map(),requests=new Map();
  let manifest=null,loading=null,context=null,source=null,playRun=0,preloadRun=0,downloadRun=0;
  let status={message:'Kokoro Heart 例句音频，首次播放无需加载模型。',cached:0,total:300,downloading:false};
  function emit(next){status={...status,...next};window.dispatchEvent(new CustomEvent('dictation-audio-status',{detail:{...status}}))}
  function norm(value){return String(value||'').normalize('NFKC').replace(/[’‘]/g,"'").trim().replace(/\s+/g,' ').toLowerCase()}
  function validate(data){
    if(data?.id!=='ielts-listening-300-audio'||data.version!=='heart-v1'||data.voice!=='af_heart'||data.count!==300||Object.keys(data.entries||{}).length!==300)throw Error('音频目录不完整，请联网刷新');
    for(const entry of Object.values(data.entries))if(!/^assets\/dictation\/ielts-listening-300\/heart-v1\/\d{3}-[a-f0-9]{12}\.mp3$/.test(entry.file)||!entry.sentence||!Number.isSafeInteger(entry.bytes)||entry.bytes<1000||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('音频目录校验失败');
    return data;
  }
  async function load(){
    if(manifest)return manifest;if(loading)return loading;
    loading=(async()=>{
      const cache=await caches.open(CACHE),url=new URL(MANIFEST,base).href;let data;
      try{const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('目录下载失败');data=validate(await response.clone().json());await cache.put(url,response)}
      catch(error){const saved=await cache.match(url);if(!saved)throw error;data=validate(await saved.json())}
      manifest=data;
      const hits=await Promise.all(Object.values(data.entries).map(entry=>cache.match(new URL(entry.file,base).href)));
      const cached=hits.filter((response,index)=>response&&Number(response.headers.get('content-length'))===Object.values(data.entries)[index].bytes).length;
      emit({cached,total:data.count,totalBytes:data.totalBytes,message:`Kokoro Heart · 已缓存 ${cached} / ${data.count} 条整句音频`});return data;
    })();
    try{return await loading}finally{loading=null}
  }
  function entryFor(question){const entry=manifest?.entries[norm(question?.word)];return entry&&entry.sentence===question.sentence?entry:null}
  async function hash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('')}
  async function checkedBytes(response,entry){
    if(!response?.ok||!/audio\//i.test(response.headers.get('content-type')||''))return null;
    const bytes=await response.arrayBuffer();return bytes.byteLength===entry.bytes&&await hash(bytes)===entry.sha256?bytes:null;
  }
  async function audioBytes(entry){
    const url=new URL(entry.file,base).href;if(requests.has(url))return requests.get(url);
    const task=(async()=>{
      const cache=await caches.open(CACHE),saved=await cache.match(url);
      if(saved){const bytes=await checkedBytes(saved,entry);if(bytes)return bytes;await cache.delete(url)}
      const response=await fetch(url,{cache:'no-store'}),bytes=await checkedBytes(response,entry);
      if(!bytes)throw Error('音频未下载完整，请联网重试');
      try{await cache.put(url,new Response(bytes,{headers:{'content-type':'audio/mpeg','content-length':String(bytes.byteLength)}}));emit({cached:Math.min(status.total,status.cached+1)})}catch{emit({message:'音频可播放，但设备空间不足，未能离线保存'})}
      return bytes;
    })();requests.set(url,task);try{return await task}finally{requests.delete(url)}
  }
  function prime(){
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('当前浏览器不支持音频播放');
    if(!context||context.state==='closed')context=new Context();
    if(context.state==='suspended')context.resume().catch(()=>{});return context;
  }
  function stop(){playRun++;if(source){try{source.stop()}catch{}source=null}}
  async function decoded(entry){
    if(buffers.has(entry.file))return buffers.get(entry.file);
    const bytes=await audioBytes(entry),buffer=await prime().decodeAudioData(bytes.slice(0));
    buffers.set(entry.file,buffer);while(buffers.size>4)buffers.delete(buffers.keys().next().value);return buffer;
  }
  async function play(question,{speed=1}={}){
    stop();const run=playRun;emit({message:'正在载入整句音频（无需生成语音）…'});
    try{
      prime();
      await load();if(run!==playRun)return false;const entry=entryFor(question);if(!entry)throw Error('这条例句没有匹配的预制音频');
      const buffer=await decoded(entry);if(run!==playRun)return false;
      if(context.state==='suspended')await context.resume();if(run!==playRun)return false;
      if(context.state!=='running')throw Error('浏览器暂时拦截声音，请再点一次播放');
      const current=context.createBufferSource();current.buffer=buffer;current.playbackRate.value=Math.max(.75,Math.min(1.25,Number(speed)||.9))/.9;current.connect(context.destination);source=current;
      current.onended=()=>{if(source===current){source=null;emit({message:'整句音频播放完毕，可直接重听'})}};current.start();emit({message:'正在播放 Kokoro Heart 预制整句音频'});return true;
    }catch(error){if(run===playRun)emit({message:'播放失败：'+(error?.message||'请联网重试')});return false}
  }
  async function preload(queue,index){
    const run=++preloadRun;
    try{await load();for(const question of queue.slice(index,index+3)){if(run!==preloadRun)return;const entry=entryFor(question);if(entry)await audioBytes(entry)}}catch{/* Optional lookahead must not block the current question. */}
  }
  function cancelDownload(){downloadRun++;emit({downloading:false,message:'下载已暂停，已保存的音频保留；下次可继续'})}
  async function downloadAll(){
    if(status.downloading)return;const run=++downloadRun;emit({downloading:true,message:'正在检查并下载离线音频…'});
    try{
      const data=await load();let count=0;const cache=await caches.open(CACHE);
      for(const entry of Object.values(data.entries)){
        if(run!==downloadRun)return;await audioBytes(entry);
        const saved=await cache.match(new URL(entry.file,base).href);if(!saved||!await checkedBytes(saved,entry))throw Error('设备未能保存音频，请检查剩余空间');
        count++;if(run===downloadRun)emit({cached:count,downloading:true,message:`离线音频已保存 ${count} / ${data.count} 条`});
      }
      if(run===downloadRun)emit({downloading:false,cached:count,message:`${count} 条例句音频已完整保存，可断网播放。出发前请用飞行模式试播。`});
    }catch(error){if(run===downloadRun)emit({downloading:false,message:'离线下载未完成：'+(error?.message||'网络中断')+'；已保存部分保留，可重试'})}
  }
  window.DictationAudio={load,entryFor,play,stop,preload,downloadAll,cancelDownload,getStatus:()=>({...status})};
})();
