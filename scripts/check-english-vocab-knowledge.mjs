import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');
const [adapter,quick,config,storage,ui,styles,importantShard,economicShard,aShard,toeic]=await Promise.all([
  read('app-21.js'),read('app-20.js'),read('app-2.js'),read('app-3.js'),read('ui.html'),read('styles.css'),
  read('data/english-relations-i.json'),read('data/english-relations-e.json'),read('data/english-relations-a.json'),read('data/toeic-core.json')
]);
const important=JSON.parse(importantShard).entries.important;
const economic=JSON.parse(economicShard).entries.economic;
const noRelations=JSON.parse(aShard).entries['a copy of'];
const core=JSON.parse(toeic).words;

assert(important.relations.family.some(item=>item.word==='importance'),'important 应有 Word Family');
assert(important.relations.synonyms.some(item=>item.word==='significant'),'important 应有 Synonyms');
assert(economic.relations.confusables.some(item=>item.word==='economical'&&item.difference),'economic/economical 应保留可靠英文 difference');
assert.equal(noRelations,undefined,'无 relations 的词不应制造空记录');

assert.match(adapter,/function englishMasterLexicon\(/,'应按 lemma 建立运行时 Master Lexicon');
assert.match(adapter,/examTags:new Set\(\)/,'同一 lemma 应只合并考试标签');
assert.match(adapter,/tem8_core:'TEM8'/,'知识层应预留 TEM-8 标签兼容');
assert.match(adapter,/englishMeaningFor\(lexicon,item\.word\)/,'关联词中文应反查 Master Lexicon');
assert.match(adapter,/暂无中文释义/,'Master Lexicon 缺词时应诚实显示占位');
assert.doesNotMatch(adapter,/detail=item\.(sense|difference)/,'UI 不应优先直出英文 sense/difference');

const helperNames=['englishDeckTag','englishMasterLexicon','compactEnglishPos','englishMeaningFor','englishPosFor','confusableDifferenceZh','relationItems','englishAnswerRelationHTML'];
const helperSource=adapter.split('\n').filter(line=>helperNames.some(name=>line.startsWith(`function ${name}(`))).join('\n');
const sandbox={ENGLISH_EXAM_TAGS:{toeic_core:'TOEIC',ielts_core:'IELTS'},builtinDeckCache:new Map(),state:{vocab:{decks:[]}},normWord:value=>String(value||'').trim().toLowerCase(),esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;'),isEnglishRelationDeck:()=>true,primaryDeck:{id:'toeic_core',builtin:true,words:[{word:'important',meaning:'重要的',pos:'adjective'},{word:'importance',meaning:'重要性',pos:'noun'},{word:'crucial',meaning:'至关重要的',pos:'adjective'},{word:'economic',meaning:'与经济有关的',pos:'adjective'},{word:'economical',meaning:'节省的；经济实惠的',pos:'adjective'}]}};
vm.createContext(sandbox);vm.runInContext(helperSource,sandbox);
const familyHtml=vm.runInContext(`relationItems([{word:'importance',pos:'n.'}],'family',englishMasterLexicon(primaryDeck),'important')`,sandbox);
const synonymHtml=vm.runInContext(`relationItems([{word:'crucial',sense:'of extreme importance'}],'synonyms',englishMasterLexicon(primaryDeck),'important')`,sandbox);
const confusableHtml=vm.runInContext(`relationItems([{word:'economical',difference:'English source remains in data'}],'confusables',englishMasterLexicon(primaryDeck),'economic')`,sandbox);
assert.match(familyHtml,/importance.*n\..*重要性/s);assert.match(synonymHtml,/crucial.*至关重要的/s);assert.doesNotMatch(synonymHtml,/extreme importance/);
assert.match(confusableHtml,/economic：与经济有关的；economical：节省的；经济实惠的/);
assert.equal(vm.runInContext(`englishAnswerRelationHTML(null,'plain',englishMasterLexicon(primaryDeck))`,sandbox),'','无 relations 不应生成关联卡');

assert.match(ui,/id="vocabShowRelationsAfterAnswer" type="checkbox"/,'四选一应提供关联词开关');
assert.match(adapter,/vocabShowRelationsAfterAnswer===true/,'开关默认关闭，只有显式 true 才拦截下一题');
assert.match(adapter,/presentAnswerRelationCard/,'开启后应进入独立关联词卡');
assert.match(adapter,/\['family','词族',3\].*\['synonyms','近义词',3\].*\['confusables','易混词',1\]/s,'关联词卡应限制为 3/3/1');
assert.match(adapter,/id="vocabRelationNext"|#vocabRelationNext/,'关联词卡应支持下一题');
assert.match(adapter,/vocabRelationMore/,'关联词卡应进入完整详情');
assert.match(adapter,/if\(!groups\)\{baseAdvanceVocab21/,'无关联数据应直接进入下一题');

for(const status of ['known','fuzzy','unknown'])assert.match(ui,new RegExp(`data-vquick-status="${status}"`),`快速筛词缺少 ${status} 按钮`);
assert.match(adapter,/pointerdown/);assert.match(adapter,/pointermove/);assert.match(adapter,/pointerup/);
assert.match(adapter,/dx>60.*known.*dx<-60.*unknown/s,'右滑认识、左滑不认识应使用明确阈值');
assert.match(styles,/touch-action:pan-y/,'手机横滑时应保留纵向页面滚动');
assert.match(styles,/@media\(max-width:620px\).*vocab-answer-relation-groups\{grid-template-columns:1fr\}/s,'关联卡应有移动端单列布局');

assert.match(config,/quickStatus:p\[9\]/,'刷新后应从 progress 索引 9 恢复快速筛词状态');
assert.match(storage,/w\.quickStatus\|\|''/,'快速筛词状态应写回原兼容槽位');
assert.match(quick,/state\.vocab\.quickResume\[quickDeck\.id\]/,'快速筛词断点应按 deck 保存');
const quickAnswer=quick.match(/function answerVocabQuick\(status\)\{[^\n]+/s)?.[0]||'';
assert(quickAnswer,'应保留快速筛词状态函数');
for(const forbidden of ['mastered','level=','due=','seen++','wrong++','correct++'])assert(!quickAnswer.includes(forbidden),`快速筛词不得修改原 Vocabulary 进度：${forbidden}`);
assert(core.some(word=>word.word==='important'&&word.meaning),'中文反查样本应来自现有 English 词库');

console.log('PASS English Vocabulary knowledge: family/synonyms/confusables/no-data, Chinese Master Lexicon lookup, answer-card off/on/next, quick buttons/swipe/persistence, original progress isolation.');
