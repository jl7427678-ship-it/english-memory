const PIPER_MODULE='https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.3/+esm';
const DEFAULT_VOICE='en_US-hfc_female-medium';
let piper=null,session=null,loading=null,activeJob=0,pendingJob=null,running=false;

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

function downloadStatus(progress){
  const total=Number(progress?.total)||0,loaded=Number(progress?.loaded)||0;
  if(total>0)return `正在下载 Piper 人声 ${Math.min(100,Math.round(loaded/total*100))}%`;
  return loaded>0?`正在下载 Piper 人声 ${Math.round(loaded/1048576)} MB`:'正在下载 Piper 本地人声…';
}

async function loadVoice(voice=DEFAULT_VOICE){
  if(session)return session;
  if(loading)return loading;
  loading=(async()=>{
    postMessage({type:'status',state:'loading',message:'首次使用需下载约 80 MB，正常情况下只下载一次'});
    piper=await import(PIPER_MODULE);
    session=new piper.TtsSession({
      voiceId:voice,
      progress:event=>postMessage({type:'status',state:'loading',message:downloadStatus(event)})
    });
    await session.waitReady;
    postMessage({type:'ready',voice});
    return session;
  })().catch(error=>{
    session=null;loading=null;
    postMessage({type:'error',message:error?.message||String(error)});
    throw error;
  });
  return loading;
}

async function runJobs(){
  if(running)return;
  running=true;
  try{
    while(pendingJob){
      const job=pendingJob;pendingJob=null;activeJob=job.id;
      const engine=await loadVoice(job.voice||DEFAULT_VOICE);
      if(activeJob!==job.id)continue;
      const chunks=splitText(job.text);
      postMessage({type:'speech-start',id:job.id,total:chunks.length});
      for(let index=0;index<chunks.length;index++){
        if(activeJob!==job.id)break;
        postMessage({type:'status',state:'speaking',message:`正在生成第 ${index+1}/${chunks.length} 段`});
        const blob=await engine.predict(chunks[index]);
        if(activeJob!==job.id)break;
        postMessage({type:'audio',id:job.id,index,total:chunks.length,blob});
      }
      if(activeJob===job.id)postMessage({type:'speech-done',id:job.id});
    }
  }catch(error){postMessage({type:'speech-error',id:activeJob,message:error?.message||String(error)})}
  finally{running=false;if(pendingJob)runJobs()}
}

self.onmessage=event=>{
  const data=event.data||{};
  if(data.type==='prepare')loadVoice(data.voice||DEFAULT_VOICE).catch(()=>{});
  if(data.type==='cancel'){activeJob=Number(data.id)||0;pendingJob=null}
  if(data.type==='speak'){activeJob=data.id;pendingJob=data;runJobs()}
};
