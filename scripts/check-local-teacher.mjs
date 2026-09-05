import {readFile} from 'node:fs/promises';
const ROOT=new URL('../',import.meta.url),read=path=>readFile(new URL(path,ROOT),'utf8');const [app12,app13]=await Promise.all([read('app-12.js'),read('app-13.js')]);function assert(value,message){if(!value)throw new Error(message)}
for(const type of ['ielts_reading','ielts_listening','toeic_part_1','toeic_part_2','toeic_part_3','toeic_part_4','toeic_part_5','toeic_part_6','toeic_part_7'])assert(app13.includes(type),`Teaching strategy missing: ${type}`);
for(const reason of ['locating','paraphrase','vocabulary','distractor','spelling','number','careless','time'])assert(app13.includes(reason),`Wrong-answer reason missing: ${reason}`);
assert(app12.includes("session.mode==='learning'")&&app12.includes("session.mode!=='learning'"),'Learning and Exam modes do not separate pre-answer hints');
assert(app12.includes('renderLocalTeacherResult'),'Exam Mode does not show post-submit analysis');
assert(app12.includes("reasons:previous?.reasons||[]"),'Wrong-answer reasons are not preserved across attempts');
assert(app13.includes('save({refresh:false})'),'Wrong-answer reason recording is not persisted');
console.log('Validated offline IELTS/TOEIC teaching strategies, Learning/Exam separation, post-submit analysis, and wrong-reason capture.');
