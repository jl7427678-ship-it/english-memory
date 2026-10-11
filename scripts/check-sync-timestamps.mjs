import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app-22.js',import.meta.url),'utf8');
const syncSource=source.slice(source.indexOf('  async function syncNow('),source.indexOf('  function scheduleSync('));
const formatSource=source.slice(source.indexOf('  function formatSyncTime('),source.indexOf('  function renderSync('));
const cursor='2026-10-11T11:34:01.889588+00:00';
let clock='2026-10-11T15:50:00.000Z';
class TestDate extends Date{constructor(...args){super(...(args.length?args:[clock]))}}
let disk,failAt=null,pulledCursor=cursor;
const calls=[],notices=[];
const context={Date:TestDate,client:{},currentUser:{id:'test-user'},syncing:false,syncTimer:null,navigator:{onLine:true},syncStore:{version:1,lastSyncAt:cursor,dirty:{progress:{},resume:{},settings:{}}},clearTimeout(){},renderSync:message=>notices.push(message),toast:message=>notices.push(message),seedLocalData(){},console:{warn(){}},pull:async since=>{calls.push(since);if(failAt==='pull')throw Error('read failed');return pulledCursor},pushDirty:async()=>{if(failAt==='push')throw Error('write failed')},persistStore:()=>{if(failAt==='persist')throw Error('storage failed');disk=JSON.stringify(context.syncStore)}};
vm.createContext(context);
vm.runInContext(syncSource+formatSource,context);

// Old stores contain only the server cursor: never pretend it was a successful sync time.
assert.equal(context.formatLastSync(),'待完成首次同步');
assert.equal(await context.syncNow(),true);
assert.equal(context.syncStore.lastSuccessAt,clock);
assert.equal(context.syncStore.lastSyncAt,cursor);
assert.deepEqual(calls,[cursor,cursor]);
context.syncStore=JSON.parse(disk);
assert.equal(context.syncStore.lastSuccessAt,clock,'completion survives reload');

// No new data still updates the completion clock; both reads retain the original cursor.
clock='2026-10-11T15:51:00.000Z';
assert.equal(await context.syncNow({quiet:true}),true);
assert.equal(context.syncStore.lastSuccessAt,clock);
assert.equal(context.syncStore.lastSyncAt,cursor);
const lastSuccess=clock;
clock='2026-10-11T15:52:00.000Z';
for(const failure of ['pull','push','persist']){
  failAt=failure;
  assert.equal(await context.syncNow(),false);
  assert.equal(context.syncStore.lastSuccessAt,lastSuccess,failure+' must not report success');
  assert.equal(context.syncing,false);
}
failAt=null;
for(const [key,value] of [['client',null],['currentUser',null],['syncing',true]]){
  const old=context[key];context[key]=value;
  const before=notices.length;
  assert.equal(await context.syncNow(),false);
  assert.ok(notices.length>before,'blocked manual sync must explain why');
  assert.equal(context.syncStore.lastSuccessAt,lastSuccess);
  context[key]=old;
}
context.navigator.onLine=false;
assert.equal(await context.syncNow(),false);
assert.match(notices.at(-1),/离线/);
context.navigator.onLine=true;

// A truly new remote modification advances only the data cursor to the server time.
pulledCursor='2026-10-11T15:51:40.000Z';
assert.equal(await context.syncNow(),true);
assert.equal(context.syncStore.lastSyncAt,pulledCursor);
assert.equal(context.syncStore.lastSuccessAt,clock);
context.syncStore={lastSyncAt:null};pulledCursor=null;
assert.equal(await context.syncNow(),true,'an empty cloud can still sync successfully');
assert.equal(context.syncStore.lastSuccessAt,clock);
assert.equal(context.syncStore.lastSyncAt,null);
assert.equal(context.formatSyncTime('invalid','unknown'),'unknown');
const ui=fs.readFileSync(new URL('../ui.html',import.meta.url),'utf8');
assert.match(ui,/本机最后同步成功时间/);
assert.match(ui,/云端数据更新时间/);
assert.match(ui,/id="vocabSyncDataUpdated"/);
console.log('PASS: legacy stores, no-change/manual/background sync, persistence, failures, blocked actions, independent data cursor and empty cloud.');
