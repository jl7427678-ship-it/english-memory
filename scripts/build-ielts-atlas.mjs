import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const upstreamRoot = resolve(process.argv[2] || '../atlas-source');
const repoRoot = resolve(new URL('../', import.meta.url).pathname);
const examDir = resolve(upstreamRoot, 'assets/generated/reading-exams');
const explanationDir = resolve(upstreamRoot, 'assets/generated/reading-explanations');
const sourceCommit = process.argv[3] || '1e2e47ed18f1a9005af8ae0e5592f80ee8d412b3';

function loadRegistered(file, registryName) {
  let payload;
  const context = { [registryName]: { register(_id, data) { payload = data; } } };
  vm.runInNewContext(file, context, { timeout: 1000 });
  if (!payload) throw new Error(`Unable to read registered data from ${registryName}`);
  return payload;
}

const files = (await readdir(examDir)).filter(name => /^p.*\.js$/.test(name)).sort();
const exams = [];
let questionCount = 0;
let questionGroupCount = 0;
let explanationCount = 0;
let explanationItemCount = 0;

for (const filename of files) {
  const exam = loadRegistered(await readFile(resolve(examDir, filename), 'utf8'), '__READING_EXAM_DATA__');
  const explanationPath = resolve(explanationDir, filename);
  let hasExplanation = true;
  let explanationItems = 0;
  try {
    await access(explanationPath);
    const explanation = loadRegistered(await readFile(explanationPath, 'utf8'), '__READING_EXPLANATION_DATA__');
    explanationItems = (explanation.questionExplanations || []).reduce((sum, group) => sum + (group.items || []).length, 0);
    explanationCount += 1;
    explanationItemCount += explanationItems;
  } catch {
    hasExplanation = false;
  }
  const questions = Object.keys(exam.answerKey || {}).length;
  const groups = (exam.questionGroups || []).length;
  questionCount += questions;
  questionGroupCount += groups;
  exams.push({
    id: exam.examId,
    title: exam.meta?.title || exam.examId,
    category: exam.meta?.category || '',
    frequency: exam.meta?.frequency || '',
    difficultyScore: exam.meta?.difficultyScore ?? null,
    questionCount: questions,
    questionGroupCount: groups,
    hasExplanation,
    explanationItemCount: explanationItems,
    examPath: `assets/generated/reading-exams/${filename}`,
    explanationPath: hasExplanation ? `assets/generated/reading-explanations/${filename}` : null
  });
}

const manifest = {
  schemaVersion: 1,
  source: {
    name: 'IELTS Atlas',
    repository: 'https://github.com/sallowayma-git/IELTS-practice',
    commit: sourceCommit,
    license: 'GPL-3.0 (code); question content remains subject to upstream third-party rights notice',
    rawBase: `https://raw.githubusercontent.com/sallowayma-git/IELTS-practice/${sourceCommit}/`
  },
  generatedAt: new Date().toISOString(),
  stats: { examCount: exams.length, passageCount: exams.length, questionGroupCount, questionCount, explanationCount, explanationItemCount },
  exams
};

await writeFile(resolve(repoRoot, 'data/ielts-atlas-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built IELTS Atlas manifest: ${exams.length} exams, ${questionCount} answer fields, ${explanationCount} explanation files.`);
