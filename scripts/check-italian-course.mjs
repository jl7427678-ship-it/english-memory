import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [raw, app, ui, worker, notices] = await Promise.all([
  read('data/italian-course.json'), read('app-16.js'), read('ui.html'), read('service-worker.js'), read('THIRD_PARTY_NOTICES.md')
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
assert(ui.includes('id="page-italiano"') && ui.includes('id="italianLessonStage"'), 'Italian course UI missing');
const coreLine = worker.split('\n').find(line => line.startsWith('const CORE=')) || '';
assert(worker.includes('app-16.js') && !coreLine.includes('data/italian-course.json'), 'Course runtime must be cached on demand, not precached');
assert(notices.includes('Open-Apps-Studio/lingo-lessons') && notices.includes('MIT'), 'Italian source notice missing');
console.log(`Validated Italian course: ${data.sections.length} section, ${units.length} units, ${lessons.length} lessons, ${exercises.length} exercises.`);
