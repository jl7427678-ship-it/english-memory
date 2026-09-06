# Third-party practice content

The built-in exam practice packs are simulations. They are not official TOEIC or IELTS examination papers and are not endorsed by the owners of those examinations.

## TOEIC Part 5 starter pack

- Source: [kdeppaei/toeic-question-ocean](https://github.com/kdeppaei/toeic-question-ocean)
- Source file: `question-bank.js`
- License: MIT
- Use here: a small adapted subset of the repository's original simulation questions, with Simplified Chinese explanations.

## IELTS synthetic reading starter pack

- Source: [LuchoBazz/ielts-ai-dataset](https://github.com/LuchoBazz/ielts-ai-dataset)
- Source file: `datasets/synthetic-official-mocks/reading/ielts-reading-academic-001.json`
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- Use here: an adapted and shortened reading passage with a subset of practice question patterns. The upstream dataset describes this material as AI-generated synthetic practice.

## Architecture research only

[aimerfeng/ists](https://github.com/aimerfeng/ists) (MIT) was reviewed for its local-first IELTS practice structure and its explicit policy of excluding copyrighted commercial books, official past papers, scraped question banks, and unlicensed audio. No ISTS code or question content is copied into this repository.

## IELTS Atlas Reading adapter

- Source: [sallowayma-git/IELTS-practice](https://github.com/sallowayma-git/IELTS-practice), known as IELTS Atlas.
- Pinned source revision: `1e2e47ed18f1a9005af8ae0e5592f80ee8d412b3`.
- Source code license: GNU GPL v3.0.
- Integration: this repository contains an independently written adapter and a metadata-only catalog. Reading passages, questions, answers, and explanations are not copied into this repository; each selected exam shard is fetched on demand from the pinned upstream revision.
- Content notice: the upstream project states that question sources, passages, PDFs, images, and explanation material may be subject to third-party rights. Those rights are not granted by its code license. Use is limited here to personal study; the material is not represented as official IELTS content.

## Italiano vocabulary

- Meanings and grammatical metadata: [Chinese Wiktionary](https://zh.wiktionary.org/) extracted by [Kaikki / Wiktextract](https://kaikki.org/zhwiktionary/). License: Creative Commons Attribution-ShareAlike 4.0 and GNU Free Documentation License.
- Frequency ranking: [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords), Italian OpenSubtitles2018 frequency list. Content license: CC BY-SA 4.0; generator code license: MIT.
- Integration: build-time normalization converts Traditional Chinese to Simplified Chinese, removes unusable entries, keeps source-provided part of speech, gender, plural, infinitive, IPA, example and frequency fields where present, and writes one Core deck plus static Full-deck shards. No AI-generated translations or grammatical fields are added.
# Italiano beginner course

- Source: [Open-Apps-Studio/lingo-lessons](https://github.com/Open-Apps-Studio/lingo-lessons), `src/content/packs/it-en.json`
- Pinned revision: `aa65f4eafcf8c6c777249767a9ec681a68c2bed3`
- License: MIT
- Use: the Italian course pack is adapted into the local Section / Unit / Lesson format in `data/italian-course.json`; the upstream application itself is not copied.
