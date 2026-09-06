# English Memory Lab — Frozen Modules

更新时间：2026-09-06

冻结基线：`20eb779242b20cad4f8849bf27d4617b16b9e5a4`

本文是后续增量开发的边界清单。以下模块已经在各自完成阶段通过静态契约检查和公开站点回归，标记为 **FROZEN**。开发新功能时不得为了代码风格、统一架构或 UI 整理而重新扫描、重写或迁移这些模块。

只有以下情况可以触碰冻结模块：

1. 新功能必须使用它公开的现有接口，且无法通过独立 adapter 完成。
2. 自动测试或真实浏览器回归发现明确缺陷。
3. 用户明确要求修改该模块。

触碰时必须采用最小改动，说明原因，运行对应契约测试，并保持旧数据兼容。

## FROZEN：数据与存储契约

- localStorage：`englishMemoryLab_v1`
- 词库 IndexedDB：`englishMemoryLab_vocab_cache_v1` / `decks`
- 内置词学习进度：`state.vocab.progress`，键为 `deckId|word`
- 私人题库与大文件：保持现有 profile 隔离、SHA-256 去重、Blob 单份保存和 PDF 原件默认不保留策略
- 禁止清空、改名或无迁移改变以上数据结构

## FROZEN：现有词库与 Vocabulary Engine

- TOEIC Core 1,250 / Full 11,154
- IELTS Core 4,974
- 考研英语 4,787
- Italiano Core 4,000 / Full 16,327
- 四选一、拼写、100 / 300 / 500 / 全部、错词强化、快捷键、IndexedDB 缓存、Day 0 / 1 / 3 / 7 / 14 / 30 复习
- Italiano 后续功能只能查询或调用现有 Italian 静态词库；禁止重建、复制或改写词库正文

对应检查：`check:data`、`check:italian`、`check:storage`、`check:site`。

## FROZEN：学习与考试模块

- IELTS Atlas Reading：234 套索引、3,143 个答案字段、227 条现有解析；按需加载上游题目数据
- 串题 / 故事训练：TXT、Markdown、DOCX、PDF、拆句、阅读、挖空、复述、错句复习
- 写作挖空：逐空输入、Enter 导航、自动检查、红绿反馈、百分比
- 汉语言 / 先秦文学：20 道资料来源题，8 名词解释、8 简答、4 论述
- 通用 Exam Engine、计划、私人题库、IELTS / TOEIC 机考、本地老师、英语听说读写入口

对应检查：`check:atlas`、`check:questions`、`check:exam`、`check:planner`、`check:practice`、`check:private-library`、`check:computer-exam`、`check:local-teacher`、`check:language-skills`。

## FROZEN：App Shell、PWA 与语音

- Today / Learning Library / Training / Plan / My 导航与 Local Profile
- 旺旺插画资源与现有显示逻辑
- GitHub Pages PWA、Service Worker、离线回退和主屏幕能力
- Safari TTS 兼容处理、`voiceschanged`、用户手势初始化、`cancel()` 时序
- TTS 与 Speech Recognition 必须继续作为两个独立能力描述

对应检查：`check:ui`、`check:site`。Safari / iPhone 的实际声音输出仍属于真机验证项，不把代码检查冒充真机结论。

## 本轮允许新增的 Italiano 边界

允许通过新文件和小型 adapter 增加：

- 零基础课程 Section / Unit / Lesson 主线
- 课程进度与 Today“继续学习”任务
- 点击单词的本地中文词典辅助、生词与复习
- 基础 Grammar / Conjugation
- 审计证明必要且许可适合的分级 Reading / Listening

禁止借此重构冻结的 Vocabulary Engine、全站 UI、现有题库、存储 key 或 PWA 架构。大型课程正文按需加载；大音频不进入 Service Worker precache。
