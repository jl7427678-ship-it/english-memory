# English Lexical Relations — Sources and Licensing

更新时间：2026-09-07

## Scope

`scripts/build-english-relations.mjs` collects the unique normalized English lemma set from TOEIC Full, IELTS Core, and 考研英语, then creates one shared lookup layer. It does not modify or duplicate the source decks. Generated relation shards are derivative data files and retain the source identifiers stored on each relation.

## Sources

| Source | Use | License | Redistribution | Attribution |
| --- | --- | --- | --- | --- |
| Princeton WordNet 3.0 via `wordnet-db@3.1.14` | synsets for synonyms; explicit `+` pointers for derivational word-family relations | WordNet License | Yes, including commercial use, provided the copyright/license notice is preserved | Princeton University; full notice in `data/english-relations-LICENSE.txt` |
| English Wikipedia, “List of commonly misused English words” | only word groups explicitly listed by the article, plus its concise distinction text | CC BY-SA 4.0 | Yes, with attribution and ShareAlike | Wikipedia contributors; article URL and revision are stored in the manifest |
| English Wiktionary verified seed | retained small supplemental records for `decision` and `affect` | CC BY-SA 4.0 and GFDL | Yes, subject to attribution and applicable ShareAlike terms | English Wiktionary contributors; entry URLs are stored with the records |

Commercial dictionary text from Cambridge, Oxford, Merriam-Webster, Collins, and Longman is not copied into the repository.

## Quality rules

- Word-family data comes only from WordNet's explicit derivational relation pointer; spelling similarity is never used.
- Synonyms come only from the same WordNet synset, retain a short sense label, are de-duplicated, and are limited to eight per lemma.
- Confusables come only from groups explicitly named together by the Wikipedia source. No edit-distance, pronunciation, or model-generated guesses are used.
- Missing categories remain absent and the UI hides them.
- The original WordNet database is build-only and is not committed or downloaded by browsers.

## Generated coverage

The canonical counts are stored in `data/english-word-relations.json` under `coverage` and `sourceContributions`. Run `npm run build:english-relations` to rebuild and `npm run check:english-relations` for the targeted integrity check.
