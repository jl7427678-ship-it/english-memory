import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const data = JSON.parse(read('data/ielts-listening-300.json'));
assert.equal(data.words.length, 300);
assert.equal(new Set(data.words.map(item => item.word.toLowerCase())).size, 300);
assert.equal(data.groups.length, 20);
for (const group of data.groups) {
  assert.equal(group.count, 15);
  assert.equal(data.words.filter(item => item.tags.includes(group.title)).length, 15);
}
assert.ok(data.words.every(item => /[\u3400-\u9fff]/.test(item.meaning)));
assert.match(data.selectionMethod, /非真题词频排名/);
const source = read('app-2.js') + '\n' + read('app-3.js');
const functions = ['compactMeaning', 'cleanBuiltinWords', 'fetchStaticVocabList'];
const context = {normWord: text => text.toLowerCase().trim(), validVocabMeaning: text => /[\u3400-\u9fff]/.test(text), fetchVocabJson: async () => data};
vm.createContext(context);
for (const name of functions) {
  const line = source.split('\n').find(line => line.startsWith('function ' + name + '(') || line.startsWith('async function ' + name + '('));
  assert.ok(line, name);
  vm.runInContext(line, context);
}
const meta = {id: data.id, version: data.version, expected: 300, url: 'data/ielts-listening-300.json'};
assert.equal((await context.fetchStaticVocabList(meta)).length, 300);
await assert.rejects(context.fetchStaticVocabList({...meta, version: 'wrong'}));
await assert.rejects(context.fetchStaticVocabList({...meta, expected: 301}));

const handlers = {};
const calls = [];
const buttons = ['learn', 'browse', 'spell'].map(action => ({dataset: {listeningWords: action}, addEventListener: (_, handler) => {handlers[action] = handler;}}));
const panel = {querySelectorAll: () => buttons, scrollIntoView() {}, focus() {}};
const status = {};
const browser = {};
const entryContext = {URLSearchParams, location: {search: '?deck=ielts_listening_300'}, document: {getElementById: id => ({ieltsListeningWords: panel, ieltsListeningWordsStatus: status, vocabBrowser: browser})[id]}, nav: page => calls.push(page), primeSpeech() {}, ensureBuiltinDeck: async () => meta, renderVocabHome() {}, openVocabBrowser: deck => calls.push(['browse', deck.id]), startVocabSpell: id => calls.push(['spell', id]), startVocabContinue: id => calls.push(['learn', id]), console: {warn() {}}};
vm.runInNewContext(read('ielts-listening-vocab.js'), entryContext);
assert.equal(calls[0], 'vocab');
for (const action of ['learn', 'browse', 'spell']) {
  await handlers[action]();
  assert.deepEqual(calls.at(-1), [action, data.id]);
  assert.ok(buttons.every(button => !button.disabled));
}
entryContext.ensureBuiltinDeck = async () => {throw new Error('offline')};
await handlers.learn();
assert.match(status.textContent, /重试/);
assert.ok(buttons.every(button => !button.disabled));
assert.ok(read('app.js').includes("'ielts-listening-vocab.js'"));
assert.ok(read('service-worker.js').includes("'./data/ielts-listening-300.json'"));
console.log('PASS: 300 unique words, 20 groups, Chinese definitions, loader validation, direct navigation, existing training/browse/spelling integration and retry handling.');
