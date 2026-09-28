import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const app3=read('app-3.js'),app4=read('app-4.js'),app19=read('app-19.js'),ui=read('ui.html');

assert(app3.includes('screenWrongIds:[]'),'普通四选一没有初始化第一遍错词队列');
assert(app3.includes('function vocabWordAttempted(w){return Number(w?.correct||0)+Number(w?.wrong||0)>0}'),'已学状态没有按真实作答记录判断');
assert(app3.includes('const unseen=shuffle(d.words.filter(w=>!vocabWordAttempted(w))),seen=shuffle(d.words.filter(vocabWordAttempted));pool=[...unseen,...seen]'),'普通四选一没有优先选择真正未作答词');
assert(app19.includes('if(vocabWordAttempted(word))learned++'),'已学统计仍可能把仅进入未作答的词计为已学');
assert(app19.includes('.filter(word=>!vocabWordAttempted(word))'),'继续学习没有排除仅进入未作答的假进度');
const attemptedMatch=app3.match(/function vocabWordAttempted\(w\)\{[^\n]+\}/);
assert(attemptedMatch,'找不到真实作答判断函数');
const attemptedContext={};
vm.runInNewContext(`${attemptedMatch[0]};this.vocabWordAttempted=vocabWordAttempted`,attemptedContext);
assert(!attemptedContext.vocabWordAttempted({seen:1,correct:0,wrong:0}),'只进入后退出的词不应计入已学');
assert(attemptedContext.vocabWordAttempted({seen:1,correct:1,wrong:0}),'答对词应计入已学');
assert(attemptedContext.vocabWordAttempted({seen:1,correct:0,wrong:1}),'答错词也应计入已学');
assert(app19.includes('screenWrongIds:[]'),'继续学习没有初始化第一遍错词队列');
assert(app4.includes("if(!s.screenWrongIds.includes(w.id))s.screenWrongIds.push(w.id)"),'第一遍答错没有进入第二遍强化队列');
assert(app4.includes('ok?`✓ 第一遍通过'),'第一遍答对没有直接通过');
assert(!app4.includes('强化轮还会出现 ${repeats} 次'),'第一遍答对仍提示会重复');
assert(app4.includes("if(!q.length){finishVocabSession();return}"),'第一遍全对时没有直接完成');
assert(ui.includes('第一遍答对 → 直接通过，不再重复'),'页面没有说明新的两遍规则');
assert(ui.includes('第一遍答错 → 第二遍重复强化 5 次'),'页面没有说明错词强化规则');

const match=app4.match(/function buildVocabReinforceQueue\(ids\)\{[^\n]+\}/);
assert(match,'找不到可验证的错词强化队列函数');
const context={shuffle:items=>items};
vm.runInNewContext(`${match[0]};this.buildVocabReinforceQueue=buildVocabReinforceQueue`,context);
const queue=context.buildVocabReinforceQueue(['wrong-a','wrong-a','wrong-b']);
assert(queue.length===10,'两个唯一错词应各强化 5 次');
assert(queue.filter(id=>id==='wrong-a').length===5&&queue.filter(id=>id==='wrong-b').length===5,'错词强化次数不正确');
assert(!queue.includes('correct-c'),'答对词不应进入第二遍');
assert(context.buildVocabReinforceQueue([]).length===0,'全对时强化队列应为空');

console.log('Vocabulary two-pass choice flow: first-pass once, correct words pass, wrong words reinforce 5x, reflow preserved: PASS');
