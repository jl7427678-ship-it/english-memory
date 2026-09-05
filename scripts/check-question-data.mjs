import { readFile } from 'node:fs/promises';

const data=JSON.parse(await readFile(new URL('../data/preqin-literature.json',import.meta.url),'utf8'));
const expectedTypes={term_definition:8,short_answer:8,essay:4};

function assert(condition,message){if(!condition)throw new Error(message)}

assert(data.project.id==='chinese','Project id must remain chinese');
assert(data.course.id==='preqin-literature','Course id must remain preqin-literature');
assert(JSON.stringify(data.course.allowedTypes)===JSON.stringify(Object.keys(expectedTypes)),'Course type configuration changed');
assert(!data.course.allowedTypes.includes('choice')&&!data.course.allowedTypes.includes('true_false'),'Pre-Qin literature must not expose choice or true/false by default');
assert(data.questions.length===20,'Expected exactly 20 V1 seed questions');
assert(new Set(data.questions.map(question=>question.id)).size===data.questions.length,'Question ids must be unique');

for(const [type,count] of Object.entries(expectedTypes)){
  assert(data.questions.filter(question=>question.type===type).length===count,`Expected ${count} ${type} questions`);
}

for(const question of data.questions){
  assert(question.projectId==='chinese'&&question.courseId==='preqin-literature',`Invalid ownership: ${question.id}`);
  assert(data.course.allowedTypes.includes(question.type),`Disallowed type: ${question.id}`);
  assert(['poetry','prose'].includes(question.moduleId),`Invalid module: ${question.id}`);
  assert(question.stem&&question.referenceAnswer&&question.source,`Missing required content: ${question.id}`);
  assert(['先秦文学（诗歌）','先秦文学（散文）'].includes(question.source.material),`Unverified material: ${question.id}`);
  assert(question.source.section&&question.source.excerpt,`Missing source detail: ${question.id}`);
  if(question.type==='term_definition')assert(Array.isArray(question.keywords)&&question.keywords.length>0,`Missing term keywords: ${question.id}`);
  if(question.type==='short_answer')assert(Array.isArray(question.scorePoints)&&question.scorePoints.length>0,`Missing score points: ${question.id}`);
  if(question.type==='essay')assert(Array.isArray(question.outlinePoints)&&question.outlinePoints.length>0&&question.suggestedMinutes,`Missing essay outline: ${question.id}`);
}

console.log('Validated project-configured types and 20 source-attributed Pre-Qin literature seed questions (8/8/4).');
