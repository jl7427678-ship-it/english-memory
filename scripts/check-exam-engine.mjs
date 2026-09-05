import { readFile } from 'node:fs/promises';

const ROOT=new URL('../',import.meta.url),read=path=>readFile(new URL(path,ROOT),'utf8');
const [app1,app6,app9,data]=await Promise.all([read('app-1.js'),read('app-6.js'),read('app-9.js'),read('data/preqin-literature.json')]);
const catalog=JSON.parse(data);
function assert(condition,message){if(!condition)throw new Error(message)}

assert(app1.includes('examEngine:{questions:[],attempts:[],wrong:{},review:{}}'), 'Exam Engine profile state is missing');
for(const type of ['toeic_part_1','toeic_part_2','toeic_part_3','toeic_part_4','toeic_part_5','toeic_part_6','toeic_part_7','ielts_reading','ielts_listening','term_definition','short_answer','essay'])assert(app9.includes(type),`Missing exam type ${type}`);
assert(app9.includes("chinese:['term_definition','short_answer','essay']"), 'Chinese course types were changed');
assert(!app9.includes("chinese:['choice'"), 'Chinese course was made choice-first');
assert(app9.includes('normalizeExamQuestion')&&app9.includes('adaptPreqinQuestion'), 'Question schema adapter is missing');
for(const field of ['sourceType','license','attribution','content','audio'])assert(app9.includes(field),`Normalized schema lacks ${field}`);
assert(catalog.course.allowedTypes.join(',')==='term_definition,short_answer,essay', 'Pre-Qin source catalog types changed');
assert(app6.includes('course.allowedTypes'), 'Pre-Qin UI no longer uses course-specific types');

console.log('Validated project-specific TOEIC, IELTS, Chinese, and custom Exam Engine configurations.');
