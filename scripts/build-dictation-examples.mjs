import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=file=>fs.readFile(new URL(file,root),'utf8');
const norm=text=>String(text||'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function contains(sentence,word){return new RegExp('(^|[^A-Za-z0-9\'])'+escape(norm(word)).replace(/ /g,'\\s+')+'(?=$|[^A-Za-z0-9\'])','i').test(sentence)}
const entries={};
const manifest=JSON.parse(await read('data/toeic-manifest.json'));
for(const chunk of manifest.full.chunks){
 const data=JSON.parse(await read(chunk.file));
 for(const word of data.words){
  const sentence=String(word.example||'').trim(),lemma=norm(word.word);
  if(!lemma||!sentence||!contains(sentence,lemma)||sentence.split(/\s+/).length<5||!/[.!?]$/.test(sentence))continue;
  entries[lemma]={sentence,translation:String(word.exampleZh||''),source:'toeic-vocab-tw'};
 }
}
const supplemental=(await read('data/dictation-supplement.tsv')).trim().split(/\r?\n/).slice(1);
for(const line of supplemental){
 const [word,sentence,translation]=line.split('\t');
 if(!word||!sentence||!translation||!contains(sentence,word))throw Error('Invalid supplemental sentence: '+word);
 entries[norm(word)]={sentence,translation,source:'original-practice'};
}
const listening=JSON.parse(await read('data/ielts-listening-300.json'));
const missing=listening.words.filter(word=>!entries[norm(word.word)]).map(word=>word.word);
if(missing.length)throw Error('Listening words still need natural examples: '+missing.join(', '));
const data={id:'vocab-dictation-examples',version:'2026.10.26.1',description:'Sentence completion practice. These are learning examples, not official exam recordings or questions.',sources:[{id:'toeic-vocab-tw',title:'TOEIC bilingual vocabulary examples',url:'https://huggingface.co/datasets/kknono668/toeic-vocab-tw',license:'CC BY-SA 4.0',usage:'Original dataset examples reused with target-word blanks; no official TOEIC or IELTS questions.'},{id:'original-practice',title:'Independently written practice examples',license:'CC BY-SA 4.0',usage:'Original supplementary English sentences and Chinese translations.'}],count:Object.keys(entries).length,entries};
await fs.writeFile(new URL('data/vocab-dictation-examples.json',root),JSON.stringify(data));
console.log('Built '+data.count+' sentence examples; IELTS listening coverage '+listening.words.length+'/'+listening.words.length+'.');
