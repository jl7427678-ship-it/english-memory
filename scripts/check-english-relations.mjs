import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const relations=JSON.parse(await fs.readFile(new URL('../data/english-word-relations.json',import.meta.url)));
const toeic=JSON.parse(await fs.readFile(new URL('../data/toeic-core.json',import.meta.url)));
const adapter=await fs.readFile(new URL('../app-21.js',import.meta.url),'utf8');
const vocabConfig=await fs.readFile(new URL('../app-2.js',import.meta.url),'utf8');
const ui=await fs.readFile(new URL('../ui.html',import.meta.url),'utf8');

assert.equal(relations.schemaVersion,2);
assert(relations.coverage.matchedWords>9000,'应覆盖九千以上现有英语词条');
assert.equal(Object.keys(relations.shards).length,26,'应按首字母生成 26 个按需分片');
const allEntries={};
for(const shard of Object.values(relations.shards)){
  const text=await fs.readFile(new URL(`../${shard.file}`,import.meta.url),'utf8');
  assert.equal(Buffer.byteLength(text),shard.bytes,`${shard.file} bytes`);
  assert.equal(createHash('sha256').update(text).digest('hex'),shard.sha256,`${shard.file} sha256`);
  const entries=JSON.parse(text).entries;
  assert.equal(Object.keys(entries).length,shard.count,`${shard.file} count`);
  for(const [word,entry] of Object.entries(entries)){assert.equal(allEntries[word],undefined,`${word} 不应跨分片重复`);allEntries[word]=entry}
}
assert.equal(Object.keys(allEntries).length,relations.coverage.matchedWords);
assert.equal(Object.keys(allEntries).filter(word=>word==='decision').length,1,'decision 只存一份，不按 deck 复制');
for(const word of ['decision','affect'])assert(toeic.words.some(item=>item.word===word),`TOEIC 应包含 ${word}`);
assert.match(vocabConfig,/ielts_core:\{id:'ielts_core'/);
assert.match(vocabConfig,/kaoyan_core:\{id:'kaoyan_core'/);
const decision=allEntries.decision.relations,affect=allEntries.affect.relations;
assert(decision.family.length,'family');
assert(decision.synonyms.length,'synonyms');
assert(decision.collocations.length,'collocations');
assert(affect.confusables.length,'confusables');
assert(allEntries.decide.relations.family.some(item=>item.word==='decision'&&item.pos==='n.'&&item.source==='wordnet-3.0'),'decide word family');
assert(allEntries.important.relations.synonyms.some(item=>item.word==='significant'&&item.sense&&item.source==='wordnet-3.0'),'important synonyms with sense');
assert(allEntries.economic.relations.confusables.some(item=>item.word==='economical'&&item.difference&&item.source==='wikipedia-misused-words'),'economic/economical confusable');
assert.equal(allEntries['no-relation-word'],undefined,'无关联数据的词保持空');
assert.match(adapter,/\['family','词族'\]/);
assert.match(adapter,/\['synonyms','近义词'\]/);
assert.match(adapter,/\['collocations','常用搭配'\]/);
assert.match(adapter,/\['confusables','易混词'\]/);
assert.match(adapter,/if\(!groups\.length\)return''/);
assert.match(adapter,/ENGLISH_RELATION_DECKS/);
assert.match(adapter,/englishRelationShardPromises/);
assert.match(adapter,/manifest\.shards/);
assert.match(adapter,/\$\{label\} \$\{entry\.relations\[key\]\.length\}/,'折叠标题显示数量');
assert.doesNotMatch(adapter,/italian/i);
assert.match(ui,/data-vquick-status="known"/);
assert.match(vocabConfig,/quickStatus:p\[9\]/);
console.log(`PASS English relations: ${relations.coverage.matchedWords} shared entries, 26 lazy shards, family/synonyms/collocations/confusables contract, no-data safe hide, quick-filter/progress preserved.`);
