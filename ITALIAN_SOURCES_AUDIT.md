# Italiano 外部课程来源一次性审计

更新时间：2026-09-06

本文件是 Italiano 后续开发的外部来源事实基线。除非上游明确发布新许可证、用户要求重新核验，或已采用文件出现可复现缺陷，后续不得重复扫描四个仓库；直接复用这里记录的路径、统计、许可判断与接入结论。

## 审计方法与边界

- 只读取 README、许可证、Italian 内容目录、课程结构与生成脚本中与本功能直接相关的文件。
- 统计以本文记录的固定提交为准，不把 README 宣传数字当成实际数据。
- 许可证不明确时不复制代码或课程正文。
- 不完整复制任何 App；只允许把许可清楚且实际需要的数据转换为本项目的小型静态 adapter。
- 本项目已有 Italian Core 4,000 / Full 16,327 不在本次重建范围。

## 结论总表

| 项目 | 固定提交 | 实际 Italian 内容 | 许可证 | 决定 |
| --- | --- | --- | --- | --- |
| [Open-Apps-Studio/lingo-lessons](https://github.com/Open-Apps-Studio/lingo-lessons) | `aa65f4eafcf8c6c777249767a9ec681a68c2bed3` | 1 Section、5 Units、20 Lessons、220 Exercises | MIT | **采用**：零基础主线、基础 guidebook、5 类练习、TTS 听辨 |
| [CuplexUser/LingoFlow](https://github.com/CuplexUser/LingoFlow) | `a272d831454a43c6e1bf9e1f5ce6e9457760ecfe` | 783 条 A1–B2 分类练习；3 篇 A1–B1 story | MIT | **暂不直接采用语法**；阅读只在人工复核后可作少量补充 |
| [Kendrick-Stein/Dimenticato](https://github.com/Kendrick-Stein/Dimenticato) | `2a44af065820c6969d0b482ffb5684f05eb01400` | 大型词典、变位、语法书、动词搭配 | 无项目 LICENSE | **不复制**：仅作为能力范围参考 |
| [rennerdo30/murmura](https://github.com/rennerdo30/murmura) | `cfbf3080d846d5df3eebc3873877284ad2889d8d` | 118 词、61 语法主题、26 阅读；没有 listening 数据文件 | 无项目 LICENSE | **不复制**：内容与 README 存在差异且许可不清 |

用户给出的旧仓库名 `Open-Grounds-Studio/lingo-lessons` 当前对应的公开仓库归属为 `Open-Apps-Studio/lingo-lessons`；后续 attribution 使用当前可验证的 canonical URL。

## 1. lingo-lessons：采用为零基础主线

Italian 数据路径：

`src/content/packs/it-en.json`

实际结构：

- Section：1（`Section 1: Beginner`）
- Units：5（Basics 1、Greetings、Food、Animals、Travel）
- Lessons：20（每 Unit 4 课）
- Exercises：220（每课 11 题）
- 目标词条：60 个单元词条，去重后 56 个
- 练习类型：`select` 120、`wordBank` 40、`fillBlank` 20、`match` 20、`typeAnswer` 20
- 听力形式：`select` 中的 `mode: listen`，使用 `audioTarget`；没有需要复制的大音频，可接现有 `it-IT` TTS

guidebook 实际覆盖：名词性别与冠词、`essere`、`mangiare / bere`、基本语序、正式/非正式问候、`volere`、名词复数与形容词一致、旅行介词，以及 `andare / arrivare / partire / trovare`。

适合承担：

- Lesson 1 起步的顺序课程
- Section / Unit / Lesson 解锁与自动下一课
- 选词、词块排序、填空、配对、输入、TTS 听辨
- 最基础的语法说明与课程内变位练习

限制：原包是面向英语母语者的 Beginner 课程，规模只足以标记为 **early A1 / 入门**；上游没有提供正式 CEFR 映射，不能宣称覆盖 A2 或更高。中文辅助必须由本项目本地词典层提供，不能把英文支架伪装成中文课程。

## 2. LingoFlow：许可可用，但内容质量需要隔离

Italian 分类路径：

`server/content/languages/italian/*.json`

实际 15 个分类、783 条：Essentials 68、Conversation 60、Travel 50、Work 58、Health 49、Family & Friends 50、Food & Cooking 50、Grammar 50、Hobbies & Leisure 50、Sports & Fitness 50、News & Media 49、Money & Finance 49、Science & Technology 50、Culture & History 50、Nature & Animals 50。

级别标签：A1 202、A2 201、B1 201、B2 179。练习类型统计：未指定 530、`build_sentence` 77、`flashcard` 43、`pronunciation` 16、`roleplay` 17、`dictation_sentence` 10、`cloze_sentence` 61、`mc_sentence` 8、`dialogue_turn` 21。所有条目带 hints。

Italian stories 路径：

`server/content/stories/italian.json`

实际只有 3 篇：A1、A2、B1 各 1 篇；每篇 3 道理解题，带英文对照、glossary 和 cultural note。没有 B2 story。

生成脚本显示 Italian 分类与 story 以 English 文件为结构源，经 LibreTranslate 批量翻译产生。对 50 条 Italian grammar 做了逐条结构审计后发现，很多 `prompt` 与 `hints` 仍直接讲英语语法规则，例如 third-person `-s`、`do` 问句、英语倒装等；部分 Italian answer 也不自然或不能对应提示。因此：

- 不能直接承担 Grammar / Conjugation 主模块。
- 不能仅凭 A1–B2 标签宣称教材质量或完整 CEFR 覆盖。
- 3 篇 story 只可在逐篇人工复核后作为 Reading 补充；当前阶段不接入。
- 10 条 dictation 不是可靠的分级 Listening 库，也没有配套大型音频；当前阶段不接入。

## 3. Dimenticato：功能丰富，但不具备可复制许可

README 声称约 28,787 个 Italian 词、频率、变位、语法书、动词搭配与搭配练习。相关实现包括 `grammar-book.js`、`conjugation-app.js`、`verb-collocations.js`、`verb-collocations-practice.js` 及 `data/` 下的数据。

仓库没有 LICENSE，`ATTRIBUTION.md` 也明确说明 project itself has no LICENSE。第三方 attribution 不能自动给项目自有 Italian 内容重新授权。因此本项目不得复制其代码、语法书、变位表或搭配数据，也不得把“公开 GitHub”误当成“允许复用”。

适合承担的角色仅为需求参考：语法目录、动词变位、搭配练习是未来可寻找独立开放数据源的能力方向。

## 4. Murmura：不采用

README 宣称 Italian A1–C2 的 vocabulary / grammar / reading / listening。固定提交下的实际数据为：

- `public/data/it/curriculum.json`：1 条路径，只有 A1、A2 的 8 个 milestone
- `vocabulary.json`：118 条（A1 30、A2 48、B1 11、B2 10、C1 8、C2 11）
- `grammar.json`：61 个主题（A1 16、A2 14、B1 8、B2 8、C1 8、C2 7），只有 45 个练习，105 个 Italian example 为空
- `readings.json`：26 篇（A1 6、A2 4、B1 4、B2 4、C1 4、C2 4），共 120 个问题
- `listening.json`：不存在

仓库没有 LICENSE；README 的 “Open source for educational purposes” 不是足够明确的开源许可证。再加上 curriculum、listening 与宣传范围不一致，当前不复制任何内容。

## 最小接入决定

1. 主线只适配 lingo-lessons 的 `it-en.json`，保留来源和 MIT attribution。
2. 课程界面统一留在现有 Italiano 页面，不暴露外部 App 外观或运行时依赖。
3. 中文辅助只查询已有 Italian Core / Full 数据；不复制或重建词库。
4. Grammar 第一版只使用 lingo-lessons 已有 guidebook 与课程练习。完整规则动词、常用不规则动词变位仍是审计后的真实缺口，后续必须另找许可证清楚的结构化数据，不从 Dimenticato/Murmura 抄录，也不凭模型生成。
5. Reading / Listening 当前没有同时满足“质量可靠、许可清楚、真正补缺”的成熟来源；不为凑数量接入低质量或无许可内容。LingoFlow 的 3 篇 story 可在独立人工复核阶段再决定。

## 数据与存储约束

- 只提交转换后的轻量课程 JSON 和 attribution；不复制四个仓库，不保存上游 Git 历史。
- 没有音频 Blob；听辨使用现有浏览器 `it-IT` TTS。
- 课程进度只保存 lesson/exercise 结果，不重复持久化课程正文。
- 静态课程正文按需加载，不加入大词库分片或大音频 precache。
- 不使用 AI，也不创建新的词库副本。
