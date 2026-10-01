import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),base=path.join(root,'cambridge','ielts9');
const read=name=>JSON.parse(fs.readFileSync(path.join(base,name),'utf8'));
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
const metadata=read('metadata.json');
assert(metadata.availability==='local-only','metadata must remain local-only');
assert(metadata.licenseClass==='copyright-risk','metadata must retain copyright-risk');
assert(metadata.tests.length===4,'metadata must list four tests');
const expectedAudio=new Set(['9-1-1.mp3','9-1-2.mp3','9-1-3.mp3','9-1-4.mp3','9-2-1.mp3','9-2-2.mp3','9-2-3.mp3','Track08.mp3','9-3-1.mp3','9-3-2.mp3','9-3-3.mp3','9-3-4.mp3','9-4-1.mp3','9-4-2.mp3','9-4-3.mp3','9-4-4.mp3']);
for(let number=1;number<=4;number++){
  const test=read(`test${number}.json`),{listening,reading,writing}=test.sections;
  assert(test.id===`cam9-test${number}`,`Test ${number}: id`);
  assert(test.availability==='local-only'&&test.licenseClass==='copyright-risk',`Test ${number}: copyright flags`);
  assert(listening.questionCount===40&&listening.parts.length===4,`Test ${number}: listening shape`);
  assert(reading.questionCount===40&&reading.passages.length===3,`Test ${number}: reading shape`);
  assert(writing.tasks.length===2&&writing.tasks[0].visual===true,`Test ${number}: writing shape`);
  for(const part of listening.parts){assert(expectedAudio.delete(part.audio),`Test ${number}: unexpected or duplicate audio ${part.audio}`);assert(part.pages.length>0,`Test ${number}: listening pages`)}
  for(const passage of reading.passages)assert(passage.pages.length>0,`Test ${number}: reading pages`);
  const raw=JSON.stringify(test).toLowerCase();
  assert(!raw.includes('correctanswer')&&!raw.includes('answerkey')&&!raw.includes('transcripttext'),'public metadata contains private content');
  console.log(`Test ${number}: PASS`);
}
assert(expectedAudio.size===0,`missing audio references: ${[...expectedAudio].join(', ')}`);
for(const forbidden of fs.readdirSync(base))assert(!/\.(pdf|mp3|zip)$/i.test(forbidden)&&!(/private/i.test(forbidden)&&/\.json$/i.test(forbidden)),`private source file committed: ${forbidden}`);
const ui=fs.readFileSync(path.join(root,'ui.html'),'utf8'),app=fs.readFileSync(path.join(root,'app-25.js'),'utf8'),privateLibrary=fs.readFileSync(path.join(root,'app-11.js'),'utf8'),loader=fs.readFileSync(path.join(root,'app.js'),'utf8'),shell=fs.readFileSync(path.join(root,'app-24.js'),'utf8');
assert(ui.includes('CAMBRIDGE IELTS')&&ui.includes('PRIVATE PRACTICE'),'Cambridge landing labels missing');
assert(loader.includes("'app-25.js'")&&shell.includes('renderCambridgeIeltsExam'),'exam adapter is not wired');
assert(privateLibrary.includes("paper.sourceType!=='cambridge_local'"),'Cambridge records must stay out of the generic private-paper list');
assert(app.includes('IndexedDB')&&app.includes('Not provided by the source material.'),'local storage or source-grounded explanation contract missing');
console.log('Cambridge IELTS 9: PASS');
