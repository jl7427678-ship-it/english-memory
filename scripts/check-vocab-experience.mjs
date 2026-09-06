import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const json=file=>JSON.parse(read(file));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const app1=read('app-1.js'),app2=read('app-2.js'),app3=read('app-3.js'),feature=read('app-19.js'),ui=read('ui.html'),app=read('app.js'),sw=read('service-worker.js');

assert(app1.includes('state.vocab.resume=state.vocab.resume||{}'),'缺少向后兼容的 per-deck resume 初始化');
assert(app2.includes('firstSeen:p[8]||0'),'内置词首次学习时间没有从 deckId|word 进度恢复');
assert(app3.includes("w.screenClass||'new',w.firstSeen||0"),'内置词首次学习时间没有保存到原进度记录');
assert(feature.includes('resumeSequential')&&feature.includes('nextUnlearnedWords'),'继续学习没有按下一未学词推进');
assert(feature.includes('pageSize:50'),'完整词库没有限制单页 DOM 数量');
for(const filter of ['all','unlearned','learning','mastered','due','wrong'])assert(ui.includes(`value="${filter}"`),`缺少筛选：${filter}`);
for(const id of ['vocabBrowserSearch','vocabBrowserList','vocabDetailModal','vocabExample'])assert(ui.includes(`id="${id}"`),`缺少 UI：${id}`);
assert(app.includes("'app-19.js'")&&sw.includes("'./app-19.js'"),'Vocabulary 增量模块未进入运行时/PWA');
assert(!sw.match(/italian-full-\d+\.json|toeic-full-\d+\.json/),'大词库分片不得进入 precache');

const italianManifest=json('data/italian-manifest.json');
assert(italianManifest.core.count===4000&&italianManifest.full.count===16327,'Italian Core/Full 数量变化');
const italianCore=json(italianManifest.core.chunks[0].file).words;
const italianFullTail=json(italianManifest.full.chunks.at(-1).file).words;
assert(italianCore.length&&italianFullTail.length,'Italian Core/Full 分片不可读取');
assert(italianCore.some(word=>word.example),'Italiano 已有例句未保留');
const toeic=json('data/toeic-core.json').words;
assert(toeic.length===1250,'English 测试词库数量变化');
const example=toeic.find(word=>word.example);
assert(example&&example.exampleZh,'现有英文双语例句未保留');

const persisted=JSON.parse(JSON.stringify({resume:{italian_core:842},progress:{'italian_core|ciao':[1,1,1,1,0,1,1,'fast',Date.now()]}}));
assert(persisted.resume.italian_core===842&&persisted.progress['italian_core|ciao'][8]>0,'刷新后的继续位置/首次学习时间无法恢复');
console.log('Vocabulary focused checks passed: Italian Core 4000, Italian Full 16327, English 1250, resume, browse filters, examples.');
