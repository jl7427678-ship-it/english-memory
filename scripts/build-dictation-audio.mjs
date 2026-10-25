// Build-time only. Install kokoro-js@1.2.1 and lamejs@1.2.1 in a separate tools directory.
// node --use-env-proxy scripts/build-dictation-audio.mjs <tools-directory>
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const tools=path.resolve(process.argv[2]||'../kokoro-audio-build');
const {KokoroTTS}=await import(pathToFileURL(path.join(tools,'node_modules/kokoro-js/dist/kokoro.js')).href);
const lame={};vm.createContext(lame);vm.runInContext(fs.readFileSync(path.join(tools,'node_modules/lamejs/lame.all.js'),'utf8'),lame);
const deck=JSON.parse(fs.readFileSync(path.join(root,'data/ielts-listening-300.json'),'utf8'));
const examples=JSON.parse(fs.readFileSync(path.join(root,'data/vocab-dictation-examples.json'),'utf8'));
const voice='af_heart',speed=.9,version='heart-v1';
const relative=`assets/dictation/ielts-listening-300/${version}/`,output=path.join(root,relative);
fs.mkdirSync(output,{recursive:true});
const manifest={id:'ielts-listening-300-audio',version,deckId:deck.id,engine:'Kokoro-82M-v1.0',voice,speed,sampleRate:24000,format:'mp3',license:'CC-BY-SA-4.0',entries:{}};
const model=await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{dtype:'q8',device:'cpu',progress_callback:event=>{if(event.status==='done')console.log('Model file ready: '+event.file)}});
for(const [index,word] of deck.words.entries()){
  const key=word.word.normalize('NFKC').replace(/[’‘]/g,"'").trim().replace(/\s+/g,' ').toLowerCase(),example=examples.entries[key];
  if(!example?.sentence)throw Error('Missing sentence: '+key);
  const digest=createHash('sha256').update(example.sentence).digest('hex').slice(0,12),filename=`${String(index+1).padStart(3,'0')}-${digest}.mp3`,file=path.join(output,filename);
  let duration;
  if(!fs.existsSync(file)){
    const audio=await model.generate(example.sentence,{voice,speed});
    const pcm=audio.audio,sampleRate=audio.sampling_rate;duration=pcm.length/sampleRate;
    if(sampleRate!==24000||duration<.5||!pcm.every(Number.isFinite))throw Error('Invalid generated audio: '+key);
    let energy=0;const samples=new Int16Array(pcm.length);for(let i=0;i<pcm.length;i++){energy+=pcm[i]*pcm[i];samples[i]=Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767)}
    if(energy/pcm.length<.000001)throw Error('Silent audio: '+key);
    const encoder=new lame.lamejs.Mp3Encoder(1,sampleRate,64),chunks=[];
    for(let i=0;i<samples.length;i+=1152){const chunk=encoder.encodeBuffer(samples.subarray(i,i+1152));if(chunk.length)chunks.push(Buffer.from(chunk))}
    chunks.push(Buffer.from(encoder.flush()));fs.writeFileSync(file,Buffer.concat(chunks));
  }
  const bytes=fs.readFileSync(file);duration=duration||bytes.length*8/64000;
  manifest.entries[key]={sentence:example.sentence,file:relative+filename,bytes:bytes.length,duration:Number(duration.toFixed(3)),sha256:createHash('sha256').update(bytes).digest('hex'),source:example.source};
  console.log(`${index+1}/${deck.words.length} ${key}: ${bytes.length} bytes`);
}
manifest.count=Object.keys(manifest.entries).length;manifest.totalBytes=Object.values(manifest.entries).reduce((sum,entry)=>sum+entry.bytes,0);
fs.writeFileSync(path.join(root,'data/ielts-listening-300-audio.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Finished: ${manifest.count} sentences, ${(manifest.totalBytes/1048576).toFixed(2)} MB`);
