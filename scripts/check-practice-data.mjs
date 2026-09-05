import {readFile} from 'node:fs/promises';
const ROOT=new URL('../',import.meta.url),read=path=>readFile(new URL(path,ROOT),'utf8');
const [raw,app10,worker,notices]=await Promise.all([read('data/exam-practice.json'),read('app-10.js'),read('service-worker.js'),read('THIRD_PARTY_NOTICES.md')]);
const catalog=JSON.parse(raw);function assert(value,message){if(!value)throw new Error(message)}
assert(catalog.label==='Practice / Simulation'&&/not official/i.test(catalog.notice),'Practice content is not clearly marked as simulation');
assert(catalog.packs.length>=2,'Expected TOEIC and IELTS practice packs');
const questions=catalog.packs.flatMap(pack=>pack.questions.map(question=>({...question,pack})));
assert(questions.filter(item=>item.pack.projectId==='toeic').length>=10,'TOEIC starter pack is incomplete');
assert(questions.filter(item=>item.pack.projectId==='ielts').length>=9,'IELTS starter pack is incomplete');
for(const {id,stem,answer,pack} of questions){assert(id&&stem&&answer!==undefined,`Question is incomplete: ${id||'unknown'}`);for(const field of ['sourceType','license','attribution','source'])assert(pack[field],`${id} pack lacks ${field}`)}
assert(catalog.packs.some(pack=>pack.license==='MIT')&&catalog.packs.some(pack=>pack.license==='CC BY 4.0'),'Required source licenses are missing');
assert(app10.includes('isObjectiveAnswerCorrect')&&app10.includes('state.examEngine.wrong'),'Local scoring or wrong-answer capture is missing');
assert(app10.includes('attempts.length>500'),'Attempt history is not bounded');
assert(worker.includes('data/exam-practice.json'),'Practice catalog is not available offline');
assert(notices.includes('kdeppaei/toeic-question-ocean')&&notices.includes('LuchoBazz/ielts-ai-dataset'),'Attribution notice is incomplete');
console.log(`Validated ${catalog.packs.length} licensed practice packs and ${questions.length} local-score questions.`);
