const KOKORO_MODULE='https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const MODEL_ID='onnx-community/Kokoro-82M-v1.0-ONNX';
let tts=null,loading=null,activeJob=0,pendingJob=null,running=false;

function progressText(event){
  if(!event||typeof event!=='object')return '正在准备高质量语音…';
  if(event.status==='progress'&&Number.isFinite(event.progress))return `正在下载语音模型 ${Math.round(event.progress)}%`;
  if(event.status==='initiate')return `正在下载 ${String(event.file||'语音模型').split('/').pop()}`;
  if(event.status==='done')return '正在初始化语音模型…';
  return '正在准备高质量语音…';
}

async function loadModel(){
  if(tts)return tts;
  if(loading)return loading;
  loading=(async()=>{
    postMessage({type:'status',state:'loading',message:'首次使用需下载约 100 MB 语音模型'});
    const {KokoroTTS}=await import(KOKORO_MODULE);
    tts=await KokoroTTS.from_pretrained(MODEL_ID,{
      dtype:'q8',
      device:'wasm',
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

function splitText(text,maxLength=420){
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
  if(data.type==='prepare')loadModel().catch(()=>{});
  if(data.type==='cancel'){activeJob=Number(data.id)||0;pendingJob=null}
  if(data.type==='speak'){activeJob=data.id;pendingJob=data;runJobs()}
};
