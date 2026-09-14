import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../vocab-sync-core.js');
const core=globalThis.VocabularySyncCore;
const app=fs.readFileSync(new URL('../app-22.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../ui.html',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../supabase/vocabulary-sync.sql',import.meta.url),'utf8');
const config=fs.readFileSync(new URL('../sync-config.js',import.meta.url),'utf8');

const row=(lemma,updated,mutation,extra={})=>({profile_id:'local-default',deck_id:'toeic_core',lemma,client_updated_at:updated,mutation_id:mutation,...extra});
const deviceA=[row('alpha',100,'a-1',{recognition:'known'}),row('beta',101,'a-2',{mistake_count:1})];
const deviceB=core.mergeByKey([],deviceA,core.progressKey);
assert.deepEqual(deviceB.map(item=>item.lemma).sort(),['alpha','beta'],'B 应拉取 A 的两个词');
deviceB.push(row('gamma',102,'b-1',{level:1}));
const deviceA2=core.mergeByKey(deviceA,deviceB,core.progressKey);
assert.deepEqual(deviceA2.map(item=>item.lemma).sort(),['alpha','beta','gamma'],'A/B 不同词应取并集');
assert.equal(core.chooseWinner(row('same',200,'a'),row('same',201,'b')).mutation_id,'b','较新的时间应胜出');
assert.equal(core.chooseWinner(row('same',201,'a'),row('same',201,'b')).mutation_id,'b','同时间按 mutation_id 确定性选择');
assert.equal(core.mergeByKey([row('offline',300,'a')],[row('remote',301,'b')],core.progressKey).length,2,'离线新增不应覆盖远端不同词');

assert.match(app,/DEBOUNCE_MS=15000/);
assert.match(app,/BATCH_SIZE=200/);
assert.match(app,/await pull\(since\)[\s\S]*await pushDirty\(\)[\s\S]*await pull\(since\)/);
assert.match(app,/signInWithOtp/);
assert.match(app,/verifyOtp/);
assert.doesNotMatch(app,/signInWithPassword|signUp\s*\(/);
assert.match(ui,/id="vocabSyncEmail"/);
assert.match(ui,/id="vocabSyncOtp"/);
assert.doesNotMatch(ui,/id="vocabSyncPassword"/);
assert.match(sql,/enable row level security/g);
assert.match(sql,/\(select auth\.uid\(\)\) = user_id/g);
assert.match(sql,/security invoker/g);
assert.match(sql,/grant select, insert, update/);
assert.doesNotMatch(sql,/grant delete/);
assert.doesNotMatch(config,/service_role|secret/i);
assert.match(config,/supabasePublishableKey:'sb_publishable_/);

new Function(fs.readFileSync(new URL('../vocab-sync-core.js',import.meta.url),'utf8'));
new Function(app);
console.log('Vocabulary Cloud Sync checks passed');
