import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [raw, app, helper, grammar, ui, worker, notices] = await Promise.all([
  read('data/italian-course.json'), read('app-16.js'), read('app-17.js'), read('app-18.js'), read('ui.html'), read('service-worker.js'), read('THIRD_PARTY_NOTICES.md')
]);
const data = JSON.parse(raw);
const assert = (value, message) => { if (!value) throw new Error(message); };
const units = data.sections.flatMap(section => section.units);
const lessons = units.flatMap(unit => unit.lessons);
const exercises = lessons.flatMap(lesson => lesson.exercises);
const counts = exercises.reduce((out, item) => ({ ...out, [item.type]: (out[item.type] || 0) + 1 }), {});

assert(data.level === 'early-A1', 'Course must not overclaim CEFR coverage');
assert(data.source.license === 'MIT' && data.source.revision, 'Pinned source/license missing');
assert(data.sections.length === 1 && units.length === 5 && lessons.length === 20 && exercises.length === 220, 'Italian course counts changed');
for (const [type, count] of Object.entries({ select: 120, wordBank: 40, fillBlank: 20, match: 20, typeAnswer: 20 })) assert(counts[type] === count, `${type} count changed`);
assert(app.includes("fetch('data/italian-course.json')") && app.includes('completedLessons') && app.includes("lang:'it-IT'"), 'Course runtime contract missing');
assert(helper.includes('italianClickableText') && helper.includes('idbGetDeck') && helper.includes('ITALIAN_REVIEW_DAYS=[0,1,3,7,14,30]'), 'Local Chinese helper/review contract missing');
assert(helper.includes("italianDictionaryManifest.core.chunks[index]") && !helper.includes('idbPutDeck'), 'Dictionary lookup must reuse on-demand source data without duplicate writes');
assert(grammar.includes('ITALIAN_GRAMMAR_LABELS') && grammar.includes('unit.guidebook') && grammar.includes('当前真实缺口'), 'Source-based grammar guide is missing');
assert(ui.includes('id="page-italiano"') && ui.includes('id="italianLessonStage"'), 'Italian course UI missing');
const coreLine = worker.split('\n').find(line => line.startsWith('const CORE=')) || '';
assert(worker.includes('app-16.js') && worker.includes('app-17.js') && worker.includes('app-18.js') && !coreLine.includes('data/italian-course.json') && !coreLine.includes('italian-full-'), 'Course and dictionary bodies must be cached on demand, not precached');
assert(notices.includes('Open-Apps-Studio/lingo-lessons') && notices.includes('MIT'), 'Italian source notice missing');
console.log(`Validated Italian course: ${data.sections.length} section, ${units.length} units, ${lessons.length} lessons, ${exercises.length} exercises.`);
