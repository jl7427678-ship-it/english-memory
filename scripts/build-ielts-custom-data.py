"""Rebuild the licensed public practice pack from pinned upstream checkouts.

Usage: python3 scripts/build-ielts-custom-data.py /path/to/ielts-prep /path/to/sifu-reading /path/to/lucho-listening
The user's New Channel Speaking PDF and sources without republication permission
must never be inputs to this public build.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UPSTREAM = Path(sys.argv[1]).resolve() / 'content/core-en/data'
SOURCE = 'https://github.com/Luxshan2000/ielts-prep'
REVISION = '10282cc853a03b6984907fec0affe6cbbd4fe0b0'
assert subprocess.check_output(['git', '-C', str(Path(sys.argv[1]).resolve()), 'rev-parse', 'HEAD'],text=True).strip() == REVISION, 'BandReady source revision changed'


def rows(name):
    return [json.loads(line) for line in (UPSTREAM / name).read_text().splitlines() if line.strip()]


def provenance():
    return {'sourceRepo': SOURCE, 'sourceRevision': REVISION,
            'sourceType': 'original', 'licenseClass': 'clearly-open',
            'contentLicense': 'CC0-1.0', 'availability': 'public-compatible'}


scripts = {item['id']: item for item in rows('listening_scripts.jsonl')}
listening = []
for index, test in enumerate(rows('listening_tests.jsonl'), 1):
    parts = []
    for part in range(1, 5):
        source = scripts[test[f'p{part}_id']]['script_json']
        parts.append({'number': part, 'title': source['title'],
                      'lines': [{'speaker': line.get('speaker', ''), 'text': line['text'],
                                 'pauseAfterMs': line.get('pause_after_ms', 0)} for line in source['lines']],
                      'questions': [{'number': q['n'], 'type': q['type'],
                                     'instruction': q.get('instruction', ''),
                                     'options': q.get('options'),
                                     'prompt': q['prompt'], 'answer': q['answers'],
                                     'explanation': q.get('explanation', '')} for q in source['questions']]})
    nums = [q['number'] for part in parts for q in part['questions']]
    assert nums == list(range(1, 41)) and all(q['answer'] for part in parts for q in part['questions'])
    listening.append({'id': f'L{index:03d}', 'title': test['title'], 'sourceId': test['id'],
                      'parts': parts, 'questionCount': 40, 'answerCount': 40,
                      'audioType': 'TTS', 'audioStatus': 'runtime-generation-required',
                      'audio': [{'part': p, 'mode': 'runtime-browser-tts', 'source': 'part.lines'} for p in range(1, 5)],
                      'transcript': True, 'availability': 'public-compatible', **provenance()})

passages = {item['id']: item for item in rows('reading_passages.jsonl')}
reading = []
for test in rows('reading_tests.jsonl'):
    if test['format'] != 'academic':
        continue
    parts = []
    for number in range(1, 4):
        source = passages[test[f'p{number}_id']]['passage_json']
        groups = [{'type': group['type'], 'instruction': group.get('instructions_extra') or '',
                   'options': group.get('options'),
                   'layout': ({**group['layout'], 'image': 'data/ielts-custom-media/dg_front_pack_panel.svg'}
                              if (group.get('layout') or {}).get('kind') == 'diagram' else group.get('layout')),
                   'questions': [{'number': question['number'], 'prompt': question['prompt'],
                                  'answers': question['answers'],
                                  'explanation': question.get('explanation', '')}
                                 for question in group['questions']]}
                  for group in source['question_groups']]
        parts.append({'number': number, 'title': source['title'],
                      'texts': source['texts'], 'groups': groups})
    nums = [q['number'] for part in parts for group in part['groups'] for q in group['questions']]
    assert sorted(nums) == list(range(1, 41)) and all(q['answers'] for p in parts for g in p['groups'] for q in g['questions'])
    reading.append({'id': f'R{len(reading)+1:03d}', 'title': test['title'],
                    'sourceId': test['id'], 'parts': parts, 'questionCount': 40,
                    'answerCount': 40, **provenance()})

task1, task2 = [], []
for prompt in rows('writing_prompts.jsonl'):
    if prompt['task_type'] == 'ac_task1':
        assert prompt['prompt_text'].strip() and prompt['chart_spec']
        task1.append({'id': f'WT1-{len(task1)+1:03d}', 'sourceId': prompt['id'],
                      'type': prompt['genre'], 'prompt': prompt['prompt_text'],
                      'mediaType': 'chart-spec', 'chartSpec': prompt['chart_spec'], **provenance()})
    elif prompt['task_type'] == 'task2':
        assert prompt['prompt_text'].strip()
        task2.append({'id': f'WT2-{len(task2)+1:03d}', 'sourceId': prompt['id'],
                      'type': prompt['genre'], 'prompt': prompt['prompt_text'], **provenance()})

assert (len(listening), len(reading), len(task1), len(task2)) == (7, 8, 38, 42)
if len(sys.argv) > 3:
    source_path = Path(sys.argv[3]).resolve()
    source_revision = '78f7ebf2b430114998aae6806cb92c1a4a475594'
    assert subprocess.check_output(['git','-C',str(source_path),'rev-parse','HEAD'],text=True).strip() == source_revision, 'Listening source revision changed'
    location = 'datasets/practice-drills/listening/ielts-listening-band-8.0-test-001'
    folder = source_path / location
    source = json.loads((folder/'manifest.json').read_text())
    parts = []
    for section in source['sections']:
        number = section['section_number']
        audio_file = folder / f'section-{number}.mp3'
        assert audio_file.stat().st_size > 100000, f'missing section audio {number}'
        questions = []
        for group in section['question_groups']:
            for q in group['questions']:
                assert q.get('answer') is not None
                questions.append({'number': q['question_order'], 'type': group['question_type'],
                                  'prompt': '\n'.join(filter(None, [group.get('instructions'),q['text'],
                                                               '\n'.join(q.get('options') or [])])),
                                  'answer': q.get('accepted_answers') or [q['answer']],
                                  'explanation': q.get('explanation', '')})
        parts.append({'number': number, 'title': section['title'], 'transcript': section['transcript'],
                      'audioUrl': f'https://raw.githubusercontent.com/LuchoBazz/ielts-ai-dataset/{source_revision}/{location}/section-{number}.mp3',
                      'questions': questions})
    assert [p['number'] for p in parts] == [1,2,3,4]
    assert [q['number'] for p in parts for q in p['questions']] == list(range(1,41))
    listening.append({'id':'L018','title':source['title'],'sourceId':source['id'],
                      'parts':parts,'questionCount':40,'answerCount':40,
                      'audioType':'prerecorded-TTS','audioStatus':'source-mp3',
                      'audio':[{'part':p['number'],'url':p['audioUrl']} for p in parts],
                      'transcript':True,'sourceRepo':'https://github.com/LuchoBazz/ielts-ai-dataset',
                      'sourceRevision':source_revision,'sourceType':'synthetic',
                      'contentLicense':'CC BY 4.0','licenseClass':'clearly-open',
                      'availability':'public-compatible'})
if len(sys.argv) > 2:
    assert subprocess.check_output(['git', '-C', str(Path(sys.argv[2]).resolve()), 'rev-parse', 'HEAD'],text=True).strip() == 'f90eeb3597b99440b97e308a31c2c7b715540b4e', 'Reading source revision changed'
    ts = Path(sys.argv[2]).resolve() / 'src/data/mockTestData.ts'
    expression = """const fs=require('fs'),vm=require('vm');let s=fs.readFileSync(process.argv[1],'utf8').replace(/^import type[^\\n]*\\n/gm,'').replace('const passages: ReadingPassage[] =','const passages =').replace('const questions: Question[] =','const questions =').replace('export const mockTestData = { passages, questions };','globalThis.out={passages,questions};');let ctx={};vm.runInNewContext(s,ctx,{timeout:1000});process.stdout.write(JSON.stringify(ctx.out));"""
    result = json.loads(subprocess.check_output(['node', '-e', expression, str(ts)], text=True))
    assert len(result['passages']) == 3
    assert sorted(q['questionNumber'] for q in result['questions']) == list(range(1, 41))
    assert all(q.get('correctAnswer') for q in result['questions'])
    groups = []
    for index, passage in enumerate(result['passages'], 1):
        questions = [q for q in result['questions'] if q['passageId'] == passage['id']]
        groups.append({'number': index, 'title': passage['title'],
                       'texts': [{'paragraphs': [{'id': '', 'text': passage['content']}]}],
                       'groups': [{'type': 'mixed', 'instruction': '',
                                   'questions': [{'number': q['questionNumber'],
                                                  'prompt': '\n'.join(filter(None, [q.get('groupInstruction'), q.get('groupContent'), q.get('question')])),
                                                  'answers': [{'value': q['correctAnswer']}] + [{'value': a} for a in q.get('acceptableAnswers', [])],
                                                  'explanation': q.get('explanation', '')} for q in questions]}]})
    reading.append({'id': 'R009', 'title': 'Academic Reading Practice', 'sourceId': 'mockTestData',
                    'parts': groups, 'questionCount': 40, 'answerCount': 40,
                    'sourceRepo': 'https://github.com/sifu-ewu/ielts-reading-mock-test',
                    'sourceRevision': 'f90eeb3597b99440b97e308a31c2c7b715540b4e',
                    'sourceType': 'original', 'contentLicense': 'MIT (repository; author describes original content)',
                    'licenseClass': 'clearly-open', 'availability': 'public-compatible'})
pack = {'schemaVersion': 1, 'source': provenance(), 'listening': listening,
        'reading': reading, 'writingTask1': task1, 'writingTask2': task2}
out = ROOT / 'data/ielts-custom-open.json'
out.write_text(json.dumps(pack, ensure_ascii=False, separators=(',', ':')) + '\n')
print(out.name, out.stat().st_size, 'bytes')

# Stable reference slots.  External material without an explicit content licence
# is metadata only: no question, transcript, recording, or passage is shipped.
extra_listening = []
for number in range(8, 21):
    if number == 18: continue
    repository = ('DuyPham97/eduko-ielts-listening' if number <= 17 else
                  'LuchoBazz/ielts-ai-dataset' if number == 18 else
                  'AdriaRM96/ielts-listening-audio-pipeline' if number == 19 else
                  'maqsudjon-cell/cdi-listening-6')
    extra_listening.append({'id': f'L{number:03d}', 'sourceRepo': f'https://github.com/{repository}',
                            'sourceType': 'synthetic' if number <= 19 else 'unknown',
                            'audioType': 'prerecorded-TTS' if number <= 19 else 'unknown',
                            'questionCount': 40, 'answerCount': 40,
                            'licenseClass': 'clearly-open' if number == 18 else 'personal-use-candidate',
                            'availability': 'local-only' if number != 18 else 'pending',
                            'loaded': False})

serial_tests = ['series-1/test-01.json'] + [f'series-{series}/test-{test:02d}.json'
                                               for series in range(2, 7) for test in range(1, 5)]
extra_reading = [{'id': f'R{number:03d}', 'sourceRepo': 'https://github.com/Serial24/ielts-reading-data',
                  'sourceTest': serial_tests[number-10],
                  'licenseClass': 'copyright-risk', 'availability': 'local-only',
                  'loaded': False} for number in range(10, 31)]

speaking_ids = ([('PL', n) for n in (1, 3, 4, 5, 7, 8)] +
                [('PE', n) for n in (1, 5, 6, 7, 8, 9, 10, 11)] +
                [('OB', n) for n in (1, 3, 4, 5, 6, 7, 9, 10)] +
                [('EV', n) for n in (2, 5, 6, 7, 10, 12, 13, 14)])
assert len(speaking_ids) == 30
part1_pool = {cat: [f'P1-{cat}{i:02d}' for i in range(1, n + 1)]
              for cat, n in [('PL', 4), ('PE', 2), ('OB', 15), ('EV', 9), ('AB', 8)]}
ordered = []
while any(part1_pool.values()):
    for category in ('PL', 'PE', 'OB', 'EV', 'AB'):
        if part1_pool[category]:
            ordered.append(part1_pool[category].pop(0))
repeated = [item for item in ordered if item[3:5] in ('PL', 'PE', 'EV', 'AB')][:14]
repeated += [item for item in ordered if item not in repeated][:8]
first, available = ordered[:30], ordered[30:] + repeated
second = []
for first_id in first:
    choice = next(item for item in available if item[3:5] != first_id[3:5] and item != first_id)
    available.remove(choice)
    second.append(choice)
assert not available
speaking = []
for index, ((category, ordinal), p1a, p1b) in enumerate(zip(speaking_ids, first, second), 1):
    suffix = f'{category}{ordinal:02d}'
    speaking.append({'id': f'S{index:03d}',
                     'part1TopicIds': [f'P1-M{(index-1)%5+1:02d}', p1a, p1b],
                     'part2CueCardId': f'P2-{suffix}', 'part3GroupId': f'P3-{suffix}'})

# Fixed, round-robin genre distribution; the bank IDs never depend on these slots.
def interleave(items):
    by_type = {}
    for item in items:
        by_type.setdefault(item['type'], []).append(item['id'])
    result = []
    while any(by_type.values()):
        for group in by_type.values():
            if group: result.append(group.pop(0))
    return result

w1, w2 = interleave(task1), interleave(task2)
mock_tests = []
for index in range(1, 31):
    listening_id = ('L018' if index == 8 else f'L{index:03d}' if index <= 20 else None)
    reading_id = f'R{index:03d}'
    missing = (["listening"] if listening_id not in {item['id'] for item in listening} else []) + (
        ["reading"] if reading_id not in {item['id'] for item in reading} else [])
    mock_tests.append({'id': f'mock_{index:02d}', 'label': f'Mock Test {index:02d}',
                       'kind': 'custom-training-mock', 'listeningId': listening_id,
                       'listeningStatus': ('requires-tts' if index <= 7 else 'prerecorded-tts' if index == 8 else 'ready' if index == 18 else
                                           'not-loaded' if index <= 20 else 'pending'),
                       'readingId': reading_id, 'writingTask1Id': w1[index-1],
                       'writingTask2Id': w2[index-1], 'speakingSetId': f'S{index:03d}',
                       'availability': 'public-compatible' if not missing else 'local-only',
                       'missingSections': missing,
                       'status': 'ready' if not missing else 'pending' if index > 20 else 'incomplete',
                       'fullReady': not missing})

manifest = {'schemaVersion': 1, 'season': '2026-09/12', 'kind': 'custom-training-mock',
            'speakingSource': {'name': '新航道 2026 年 9–12 月口语抢鲜版 0903',
                               'availability': 'bundled', 'loaded': True,
                               'path': 'data/ielts-speaking-2026-09.json',
                               'expectedCounts': {'part1Topics': 43, 'part1Questions': 247,
                                                  'part2Cards': 46, 'part3Groups': 46,
                                                  'part3Questions': 233}},
            'speakingSets': speaking, 'listeningReferences': extra_listening,
            'readingReferences': extra_reading, 'mocks': mock_tests}
(ROOT / 'data/ielts-custom-manifest.json').write_text(
    json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n')
