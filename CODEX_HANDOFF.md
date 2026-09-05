# 串题记忆室 · English Memory Lab — Codex 接手文档

更新时间：2026-09-05

## 1. 项目与优先级

- GitHub：`jl7427678-ship-it/english-memory`
- 默认分支：`main`
- GitHub Pages：`https://jl7427678-ship-it.github.io/english-memory/`
- 纯静态 HTML / CSS / JavaScript PWA，无后端。
- 当前连续开发起点：GitHub `main` commit `5dbf5446ac65fd20e38ab838c2cf91bfe871d6b2`。
- 旧 HANDOFF 曾停留在 `4948307...`，已经过时；永远以 GitHub `main` 最新提交、当前代码和线上行为为准。

开发必须渐进进行。禁止全量重写、另建项目、强迁 React/Vue，或者为了 UI 调整破坏业务逻辑。

## 2. 必须保留的本地数据契约

- localStorage key：`englishMemoryLab_v1`
- 内置大词库 IndexedDB：`englishMemoryLab_vocab_cache_v1`
- IndexedDB object store：`decks`
- 内置词库学习进度：`state.vocab.progress`
- 进度 key：`deckId|word`，不能退回仅使用 `word`
- 词库数据与用户进度分离，更新静态词库不能清空现有进度。

任何 UI 或导航重构都必须保留这些 key 和数据形状。除非有明确迁移方案，不得更名。

## 3. 当前代码结构

- `index.html`：页面入口及 PWA 元信息
- `boot.js`：加载 `ui.html` 和 `app.js`
- `ui.html`：现有页面 DOM
- `styles.css`：基础样式和功能组件样式
- `theme.css`：视觉主题、响应式和移动端导航
- `app.js`：按顺序加载 `app-1.js` 至 `app-6.js`
- `app-1.js`：状态、localStorage、基础工具
- `app-2.js`：串题训练、TTS、语音识别、词库配置和 IndexedDB
- `app-3.js`：内置词库安装、缓存、自定义词库及训练会话
- `app-4.js`：词汇答题、拼写、考试、AI 可选评分、错句复习
- `app-5.js`：统计、文件导入、设置、数据备份、PWA 安装
- `app-6.js`：先秦文学 Question Engine adapter、草稿与课程计划
- `service-worker.js`：PWA 缓存与离线回退
- `data/`：仓库内静态 TOEIC 数据
- `scripts/`：词库构建和静态检查

`vocab-patch.js` 已经退出运行时并从仓库删除。不要重新创建或加载它。

## 4. 已完成的 TOEIC 静态词库基础设施

TOEIC 不再在手机运行时请求 Hugging Face Dataset Viewer，也不再发送约 111 次 `/rows` 请求。

当前文件：

- `data/toeic-core.json`：核心 1250 词
- `data/toeic-full-01.json` 至 `data/toeic-full-12.json`：完整 11154 词
- `data/toeic-manifest.json`：版本、数量、分片和校验信息
- `scripts/build-toeic.mjs`：开发阶段一次性生成数据
- `scripts/check-vocab-data.mjs`：检查数量、重复项和中文释义
- `scripts/check-static-site.mjs`：检查入口、词库地址、缓存与进度契约

构建阶段已经完成繁体转简体、去重、无效中文释义过滤和重要度排序。运行时从 GitHub Pages 同源静态 JSON 加载，再写入 IndexedDB。

禁止恢复 Hugging Face Runtime Dataset API。

## 5. 当前内置词库

| 词库 | 数量 | 数据方式 |
| --- | ---: | --- |
| TOEIC 核心 | 1250 | 同源静态 JSON + IndexedDB |
| TOEIC 完整 | 11154 | manifest + 12 分片 + IndexedDB |
| IELTS 核心 | 约 4974 | WordTyper JSON + IndexedDB |
| 考研英语 | 约 4787 | WordTyper JSON + IndexedDB |

IELTS 正确地址：

`https://raw.githubusercontent.com/grhliu/wordtyper-vocabularies/main/vocabularies/ielts_core.json`

`ielts.json` 不存在，不要改回去。

## 6. 必须保留的已有功能

### 词汇

- 英文到中文四选一
- 中文到英文拼写
- 100 / 300 / 500 / 全部批次
- 桌面 1 / 2 / 3 / 4 快捷键
- 根据正确率和反应速度安排 1 / 2 / 3 / 5 次强化
- 强化轮错词回流
- 1 / 3 / 7 / 14 / 30 日复习
- 自定义词库
- 内置词库 IndexedDB 缓存
- localStorage 学习状态

### 串题 / 写作

- TXT / Markdown / DOCX / PDF 导入
- 自动拆句和故事节点
- 完整阅读、30% 挖空、60% 挖空、首字母、关键词、完整复述
- 逐空输入、Enter 下一空、最后一空自动检查
- 正确绿色、错误红色、修改后重新检查、百分比成绩
- TTS 朗读
- Speech Recognition 语音识别（浏览器支持时）
- 本地评分、熟练度、错句复习、串题考试
- 用户自行配置的可选 OpenAI-compatible AI 评分

### PWA

- GitHub Pages Actions 部署
- Service Worker 离线回退
- iPhone 添加到主屏幕提示
- 导出 / 导入本地学习数据

## 7. Safari / iPhone TTS 修复（本轮）

根因不是“Safari 完全不支持朗读”。TTS 使用 `window.speechSynthesis`；语音识别使用 `SpeechRecognition / webkitSpeechRecognition`，两者兼容范围不同。

旧词汇自动朗读代码在 `setTimeout(..., 80)` 后调用 `speak()`，可能脱离 Safari 认可的用户 gesture。旧 `speak()` 还会在每次播放前无条件 `cancel()`，没有等待 voice 列表，也没有处理 Safari 取消后立刻播放的不稳定性。

当前修复：

- 首次 pointer / keyboard 交互初始化 speech synthesis
- 监听 `voiceschanged`
- 缓存与当前 `en-US` / `en-GB` 匹配的英语 voice
- 手动“朗读 / 发音”按钮直接在点击处理函数中调用 `speak`
- 移除词汇自动朗读外层 80ms 定时器
- 仅在已有朗读或待播内容时 cancel，并延迟约 70ms 重启
- 自动朗读在尚未完成首次交互时安静跳过，不阻塞训练
- TTS 失败不影响四选一、拼写或串题流程
- 设置页明确区分“朗读”和“语音识别”

当前只完成代码层兼容修复。尚未在真实 iPhone Safari、iPhone 主屏幕 PWA 或 macOS Safari 上验证声音输出；后续不得把代码检查写成真机验证。

## 8. 新 App Shell 与今日首页（本轮已完成骨架）

已经在现有技术基础上建立统一 Design Tokens 和导航骨架：

- 今日
- 学习库
- 训练
- 计划
- 我的

Desktop 使用 sidebar，Mobile 使用 bottom navigation。“今日 / 学习库 / 训练”是核心行为，“计划”负责调度，“我的”是辅助入口。

当前已完成：

- 新版“今日”默认首页
- 当天 6 项学习清单、完成数量、剩余预计时间和进度条
- TOEIC 背词与串题可进入现有功能；尚未开发的项目明确显示“准备中 / 规划中”
- 学习项目卡：TOEIC 背词、TOEIC 串题、Italiano、考研政治、汉语言、土地资源管理
- 训练中心聚合现有四选一、拼写、串题背诵、串题考试和错句复习入口
- 计划页仅提供诚实的功能预告，不伪造通知能力
- “我的”聚合统计、设置和数据迁移入口
- 添加 `todayChecklist` 作为 localStorage 状态中的兼容性字段；没有更名或迁移旧字段
- 添加 `scripts/check-ui-contract.mjs`，检查静态 ID、页面、导航目标和核心项目名称

视觉方向：Apple / iOS inspired，clean、bright、minimal、airy、friendly、cute but not childish。使用大留白、圆角卡片、克制色彩与柔和阴影。

狗狗 mascot 已使用用户提供的正式旺旺插画资源接入，不允许再用 CSS、emoji 或临时插画替换。仓库中保留 6 个优化后的 WebP 状态：`hello`、`thinking`、`celebrate`、`active`、`reading`、`rest`。当前“今日”欢迎区使用 `hello`，六项计划全部完成后自动切换 `celebrate`；其余状态留给后续真实场景，避免每张卡片都放狗。原始 1254px PNG 未放入站点，网页版本统一为 512px WebP，每张约 27–35 KB。

本次 mascot 接入没有增加或迁移任何 localStorage / IndexedDB 字段。活动中的图片状态已经加入 Service Worker 核心离线缓存。

专业名称必须始终写作“土地资源管理”，禁止写成图书馆资源管理、图书情报或图管。

## 9. 汉语言 / 先秦文学 Question Engine V1

已根据用户提供的两份真实资料建立首个专业课课程模板：

- `data/preqin-literature.json`：课程配置与 20 道人工 seed questions
- `app-6.js`：不侵入旧词汇/串题逻辑的 Question Engine adapter
- 题量严格为：名词解释 8、简答题 8、论述题 4
- 所有题目、关键词、评分点、提纲、参考答案和来源摘要只依据《先秦文学（诗歌）》与《先秦文学（散文）》
- 每题保留 `source.material`、`source.section`、`source.excerpt`

课程的 `allowedTypes` 目前仅为：

- `term_definition`
- `short_answer`
- `essay`

禁止默认加入选择题或判断题。Question Engine 必须继续按每个课程/项目自己的 `allowedTypes` 渲染，不能用统一题型比例覆盖汉语言、土地资源管理或考研政治。

当前训练能力：

- 诗歌 / 散文模块筛选
- 名词解释逐关键点覆盖检查
- 简答题逐评分点覆盖与遗漏提示
- 论述题大文本、字数、分段结构提示、提纲与参考答案
- 查看资料依据
- 草稿保存
- 手动加入/移出待复习
- 创建“名词解释 × 5 / 简答题 × 3 / 论述题 × 1”计划
- 计划记录完成题量与基础关键词覆盖率

以上检查明确不是语义评分或正式考试分数；未接入 AI 深度评分。新增本地状态位于 `state.questionEngine`，属于向后兼容的新字段，没有修改旧 `docs`、`vocab`、`vocab.progress`、`logs`、`vocabLogs` 或 IndexedDB 结构。

离线核心已加入 `app-6.js`、`data/preqin-literature.json` 与旺旺读书插画。新增 `npm run check:questions` 验证课程题型配置、8/8/4 题量、唯一 ID、来源和 schema。

## 10. 存储 / SSD 保护（Phase 0）

已对真实运行时代码完成写盘审计并做局部修复：

- 保留 `englishMemoryLab_v1`、`englishMemoryLab_vocab_cache_v1`、`decks` 和 `deckId|word`，无数据迁移。
- `localStorage` 写入集中到 `persistStateNow()`；普通 `save()` 合并写入，并限制持续训练时最多约每 5 秒落盘一次。
- `pagehide` 与页面转入后台时同步 flush，降低延迟写入导致的进度丢失风险。
- 先秦文学答题草稿输入时只更新内存，800ms debounce 后保存；用户点击“保存草稿”仍立即落盘。
- 文档导入只在用户选文件后读取；同一份文件以 SHA-256 识别，避免重复保存结构化资料。
- PDF / DOCX 解析后默认只保存抽取文字与来源元数据，`retained:false`；不保存原文件 Blob。
- 运行时没有每秒持久化计时器、`audio timeupdate` 持久化或 AI streaming token 持久化。
- Service Worker 核心缓存没有 PDF、MP3、WAV 或 M4A。
- 新增 `npm run check:storage`，持续检查集中写入、草稿 debounce、SHA-256 去重和大文件 precache 禁令。

Phase 0 静态回归已通过全部语法、词库、题库、站点、UI 与存储检查。云端浏览器无法连接本地 `terminal.local:4173`，因此本阶段没有声称完成真实浏览器交互或 Safari 真机验证；部署后仍需在实际 Chrome / Safari / iPhone PWA 上补验。

## 11. Local Profile（Phase 1）

已建立不侵入原业务逻辑的本地学习空间：

- Profile 元数据 key：`englishMemoryLab_profiles_v1`。
- 默认 profile ID：`local-default`；默认 profile 继续直接读写原 `englishMemoryLab_v1`，已有学习数据不搬迁、不复制。
- 新 profile 使用 `englishMemoryLab_v1:profile:<id>`，切换前立即 flush 当前状态，切换后整页重新初始化，避免跨 profile 的内存缓存泄漏。
- 每个 profile 独立保存资料、计划、题库状态、错题/复习、词汇进度、学习日志、设置和项目配置。
- IndexedDB 中的大型内置词库仍作为只读缓存共享，避免同一套 11154 词重复占空间；每个 profile 的 `deckId|word` 学习进度仍独立存在自己的 localStorage 状态中。
- “我的”支持新增、切换、改名和删除非默认空间；清空学习数据只清空当前空间。
- 项目支持显示、隐藏、上下排序、归档/恢复，以及新增自定义考试、专业课或语言项目。
- 预设项目：TOEIC、IELTS、Italiano、考研政治、汉语言、土地资源管理、自定义考试/专业课；另保留现有考研英语词库项目。
- 默认空间只显示 TOEIC 与汉语言，其他预设保留但默认隐藏；“今日”与内置词库均按当前 profile 的项目配置过滤，不再展示所有课程。

新增运行时文件 `app-7.js`。当前 Service Worker cache 为 `english-memory-lab-v5-ui-20260905-11`。Phase 1 的语法、存储、词库、题库、静态站点和 UI contract 检查均通过；本地浏览器连接限制仍存在，因此未声称浏览器或 Safari 真机验证。

## 12. 后续阶段顺序

1. Phase 2：项目考试日、D-x、自由周计划、每日数量/时长、Day 0/1/3/7/14/30 与 Today 自动任务。
2. Phase 3：通用 Exam Engine adapter；保留 Vocabulary Engine，并按项目配置允许题型。
3. 后续再按用户给定顺序推进题库资源研究、私人题库、本地机考/教学、听说读写，最后才接安全 serverless AI Gateway。
4. 土地资源管理与考研政治必须等各自资料和题型配置，不使用先秦文学题型比例。
5. GitHub Pages 前端不得继续作为未来 API Key 存储位置；AI Gateway 完成前不要新增前端 AI 能力。

## 13. 每阶段回归清单

1. `node --check` 检查所有运行时 JS
2. `npm run check:data`
3. `npm run check:questions`
4. `npm run check:storage`
5. `npm run check:site`
6. `npm run check:ui`
7. 浏览器检查主要交互和 Console
8. 检查 Service Worker 与离线入口
9. 检查 TOEIC 核心 1250、完整 11154、IELTS、考研
10. 刷新后确认 localStorage / IndexedDB 状态仍在
11. 重大前端更新同步 bump Service Worker cache version 和静态资源版本

## 14. 下一位 Codex 的起始要求

先读取 GitHub `main` 最新提交和真实代码，再读本文档。保留全部现有功能与数据契约；每次只完成一个清晰阶段。若文档与代码或线上行为冲突，以代码和线上行为为准。不要重新实现已经完成的 TOEIC 静态词库，不要恢复 `vocab-patch.js`，不要进行全量重写。
