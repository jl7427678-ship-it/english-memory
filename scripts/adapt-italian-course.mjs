import { readFile, writeFile } from 'node:fs/promises';

const SOURCE_REVISION = 'aa65f4eafcf8c6c777249767a9ec681a68c2bed3';
const SOURCE_URL = `https://raw.githubusercontent.com/Open-Apps-Studio/lingo-lessons/${SOURCE_REVISION}/src/content/packs/it-en.json`;
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/adapt-italian-course.mjs <downloaded-it-en.json>');

const source = JSON.parse(await readFile(input, 'utf8'));
const unitLabels = ['基础入门', '问候与礼貌', '食物与饮品', '常见动物', '旅行出行'];
const sections = source.sections.map((section, sectionIndex) => ({
  id: section.id,
  title: section.title,
  titleZh: sectionIndex === 0 ? '第一阶段 · 零基础' : `第 ${sectionIndex + 1} 阶段`,
  units: section.units.map((unit, unitIndex) => ({
    id: unit.id,
    title: unit.title,
    titleZh: unitLabels[unitIndex] || unit.title,
    description: unit.description,
    guidebook: unit.guidebook,
    words: unit.words,
    lessons: unit.lessons.map((lesson, lessonIndex) => ({
      id: lesson.id,
      title: lesson.title,
      titleZh: `第 ${lessonIndex + 1} 课`,
      exercises: lesson.exercises
    }))
  }))
}));

const output = {
  id: 'italian-beginner-course',
  version: '2026.09.06.1',
  level: 'early-A1',
  title: 'Italiano · 从零开始',
  source: {
    repository: 'Open-Apps-Studio/lingo-lessons',
    path: 'src/content/packs/it-en.json',
    revision: SOURCE_REVISION,
    url: SOURCE_URL,
    license: 'MIT',
    attribution: 'Adapted from Open-Apps-Studio/lingo-lessons'
  },
  sections
};

await writeFile(new URL('../data/italian-course.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Adapted ${sections.length} section(s), ${sections.flatMap(s => s.units).length} unit(s), ${sections.flatMap(s => s.units).flatMap(u => u.lessons).length} lesson(s).`);
