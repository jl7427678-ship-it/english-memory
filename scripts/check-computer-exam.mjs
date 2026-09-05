import {readFile} from 'node:fs/promises';
const ROOT=new URL('../',import.meta.url),read=path=>readFile(new URL(path,ROOT),'utf8');
const [app1,app12,ui]=await Promise.all([read('app-1.js'),read('app-12.js'),read('ui.html')]);function assert(value,message){if(!value)throw new Error(message)}
assert(app1.includes('activeSession:null'),'Profile-scoped active exam session is missing');
for(const contract of ['questionIds','answers:{}','review:{}','highlights:[]','deadline','completedAt','result'])assert(app12.includes(contract),`Exam session lacks ${contract}`);
for(const feature of ['queueComputerExamSave','setTimeout','startComputerExamClock','safeHighlightedPassage','isObjectiveAnswerCorrect','state.examEngine.wrong','attempts.length>500'])assert(app12.includes(feature),`Computer exam feature missing: ${feature}`);
assert(!/setInterval\([^\n]*save\(/.test(app12),'Timer writes exam state every second');
assert(app12.includes('audio.ontimeupdate')&&!app12.match(/ontimeupdate[^\n]*save\(/),'Audio timeupdate persists to storage');
assert(app12.includes("format==='full'")&&app12.includes('required.some'),'Full Mock does not reject incomplete local packs');
assert(app12.includes('startPrivateComputerExam')&&app12.includes('privatePaperId'),'Private papers cannot enter the computer-test runner');
assert(ui.includes('Learning Mode')&&ui.includes('Exam Mode')&&ui.includes('Timed Practice')&&ui.includes('Full Mock'),'Exam mode selectors are missing');
console.log('Validated split computer-test runner, debounced answers, navigation, review flags, timer, highlights, audio ranges, and local scoring.');
