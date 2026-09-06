# 串题记忆室 · English Memory Lab — Codex 接手文档

更新时间：2026-09-06

## 30. 快速筛词、词形详情与中文背诵导入

- Vocabulary 新增“快速筛词”：只显示单词、已有 IPA/POS、朗读和原词库序号；认识/模糊/不认识分别写入 `quickStatus`，不修改 `level/mastered/seen`。
- 快速筛词位置使用最小兼容字段 `state.vocab.quickResume[deckId]`；内置词的 `state.vocab.progress[deckId|word]` 数组只在索引 9 追加可选 `quickStatus`。旧数据无需迁移，Core / Full 和不同语言 deck 继续完全隔离。
- 词条详情增加默认折叠的“词族 / 词形”和“易混词”。只显示词库已有 `wordFamily/confusables`，Italiano 可按现有 `infinitive/plural` 及同 deck 的 source-provided 反向关系展示；没有可靠数据时显示“暂无”，未生成或下载补充数据。
- 用户侧训练入口统一为“背诵训练”，相关测试入口称“复述测试”；旧 `state.docs/state.study`、存储 key 和训练逻辑不变。
- 新增 `memorization-text.js` 与 `app-20.js` 小型适配层：TXT/MD 支持 BOM、严格 UTF-8、GB18030/GBK 自动回退和手动编码选择；乱码或替换字符不会继续导入。中文按换行分段，使用 `Intl.Segmenter` 与本地 fallback 拆句、提取非虚词关键词，并按完整关键词挖空。
- DOCX/PDF 继续使用原 Mammoth/PDF.js；无文本层 PDF 显示“该 PDF 未检测到可提取文本”，未加入 OCR。TXT/MD、DOCX、PDF 分别设 8/30/50 MB 上限，PDF 80 页上限；长文记忆骨架每批只渲染 40 段，用户文件不进入 precache。
- 导入后显示文件名、字符/段落/句子数、语言、编码和关键词数；关键词为 0 时禁用坏掉的挖空并提示继续全文阅读。
- 专项检查通过：Italiano Core 4000 / Full 16327、English TOEIC Core、quick resume/status 契约、UTF-8 中文、GB18030 中文、中文 Markdown、1500 段较大文本、中文拆句/关键词/挖空、词形折叠。仓库没有现成 DOCX/PDF 样本，因此没有声称完成样本解析验证；浏览器控制连接在本环境不可用，未声称真机/浏览器交互验证。
- Service Worker 更新为 `english-memory-lab-v5-ui-20260906-27`，只新增两个小型 JS 文件；未预缓存用户文件或大型数据分片。

## 29. Vocabulary Engine 进度、断点续学与完整浏览

- 在冻结 Vocabulary Engine 外增加 `app-19.js` 小型增强层，没有替换四选一、拼写、错词强化、复习算法、词库加载或 IndexedDB。
- 每个 Core / Full / 自定义词库现在分别显示总词数、已学、未学、已掌握、待复习、错词/强化中、今日新学、掌握百分比和当前新词位置。
- “学习到第几个词”与“掌握多少词”独立计算。“继续学习”按原词库顺序从下一未学词开始；现有未完成 session 继续恢复原题目和队列。
- `state.vocab.resume[deckId]` 只保存一个整数位置；内置词原有 `state.vocab.progress[deckId|word]` 数组向后兼容追加索引 8 的 `firstSeen` 时间，用于准确统计今日新学。旧记录无需 migration，缺失值按 0 处理。
- “查看完整词库”按原顺序展示，支持中英文搜索和全部/未学/学习中/已掌握/待复习/错词筛选；每页只渲染 50 项，不创建上万 DOM 节点。
- 单词详情只显示现有中文、词性、IPA、Italian gender/plural/infinitive、学习状态、TTS 与例句。例句在 UI 统一为 `sentence/translation/source/generated` 兼容视图；旧 `example/exampleZh` 直接映射，缺失时显示“暂无例句”，没有生成或补充数据。
- 没有复制词库、改变 IndexedDB schema、预缓存大词库分片、调用 AI 或迁移数据。Service Worker 为 `english-memory-lab-v5-ui-20260906-26`，只增加小型 `app-19.js`。
- 新增 `check:vocab-experience` 专项检查。只验证 Italiano Core 4000、Italiano Full 16327、英文 TOEIC Core 1250、继续位置序列化、浏览筛选/分页契约和已有双语例句；未运行全量测试。

## 25. Italiano 外部来源一次性审计

- 新增 `ITALIAN_SOURCES_AUDIT.md`，以后直接复用，不重复扫描四个指定上游。
- 采用 MIT 许可的 `Open-Apps-Studio/lingo-lessons` 固定提交 `aa65f4e...`：实际为 1 Section / 5 Units / 20 Lessons / 220 Exercises，适合作为 early A1 零基础主线。
- `CuplexUser/LingoFlow` 虽为 MIT，但 Italian 内容从 English 模板经 LibreTranslate 产生；50 条 grammar 中存在英语语法提示与 Italian 答案错位，不能直接作为语法教材。3 篇 story 仅可在逐篇人工复核后考虑。
- `Kendrick-Stein/Dimenticato` 与 `rennerdo30/murmura` 均无明确项目 LICENSE，禁止复制；Murmura 还缺少 README 声称的 listening 数据。
- Grammar 第一版只可使用 lingo-lessons 自带 guidebook/练习；更完整变位数据仍是明确缺口，需要以后另找许可清楚的结构化来源。
- 本阶段只增加审计文档，没有运行时、数据结构、Service Worker 或用户数据变化。

## 26. Italiano early A1 零基础主线

- `data/italian-course.json`：固定适配自 `Open-Apps-Studio/lingo-lessons` 的 MIT Italian pack，实际 1 Section、5 Units、20 Lessons、220 Exercises。
- 五类练习已统一进入现有 Italiano 页面：选择 120、词块排序 40、填空 20、配对 20、输入 20；其中 listen 模式调用现有 `it-IT` TTS，不复制音频。
- 完成上一课才解锁下一课；保存当前课、当前 exercise、已完成课程和每课最佳结果；完成后可直接进入下一课或重练。
- Today 与每周计划的 Italiano 入口现在进入课程页，并显示“继续第 X 课”；Vocabulary 仍直接复用已有 Core 4000 / Full 16327。
- 新增 profile 隔离的兼容字段 `state.italianCourse`；没有数据迁移，没有改变 `englishMemoryLab_v1`、IndexedDB 或 `deckId|word`。
- Service Worker 更新为 `english-memory-lab-v5-ui-20260906-22` 并加入 `app-16.js`；176 KB 课程正文按需读取，不进入 precache，第一次成功读取后由现有 runtime cache 保存。
- 新增 `npm run check:italian-course`。全套语法与静态契约回归通过。公开 GitHub Pages 已用 Chrome 完整走完第 1 课的选择、听辨、词块、填空、配对和输入流程；完成后第 2 课解锁，刷新后仍保持 `1 / 20`，页面自身无 console error。Safari / iPhone 的实际声音仍未真机验证。

## 27. Italiano 本地中文辅助

- 新增独立 `app-17.js`，不重建词库：优先查询 IndexedDB 已安装的 Italian Core / Full；否则先按需读取现有 Core 第 1 分片，查不到才读第 2 分片，只保存在内存与现有 HTTP runtime cache。
- 课程提示和单元词汇支持点击查询中文；展示词库实际存在的 meaning、POS、gender、plural、infinitive、IPA、rank。复数通过词库 plural 反查，动词原形优先使用 infinitive，再读取 source-provided 中文形态说明，不使用 AI 猜测。
- 句子提供“查看这句的中文辅助”，结果是逐词释义并明确整句翻译接口未启用；默认不做整页或全文翻译。
- 可加入/移出生词，当前 profile 内保存 `state.italianCourse.savedWords`；复习沿用 Day 0 / 1 / 3 / 7 / 14 / 30，Today 待复习数与优先复习任务包含 Italian 生词。
- `it-IT` 手动朗读沿用现有 TTS。没有 API、AI、词库复制、IndexedDB schema 变化或数据迁移。
- Service Worker 更新为 `english-memory-lab-v5-ui-20260906-23`，只预缓存小型 `app-17.js`，不预缓存 Italian 正文分片。
- 公开 Chrome 已验证 `ragazza` 显示中文、noun/feminine/复数/IPA/rank；`sono` 能从词库来源说明回到 `essere`。加入生词后侧栏显示 1 条到期，Today 待复习与优先任务均变为 1；逐词句子辅助明确不提供整句翻译；页面自身无 console error。

## 28. Italiano Grammar / Conjugation 与 Reading / Listening 决定

- 新增 `app-18.js` 与 Italiano 内部“Grammar / 动词”视图，统一显示 lingo-lessons 5 个 Unit 的原始 guidebook、来源内动词标签和对应已解锁课程练习，不暴露外部 App。
- 来源实际覆盖：冠词、gender/plural、形容词一致、基本语序、`essere`、`stare` 问候、`volere`、`mangiare/bere`、`andare/arrivare/partire/trovare`。当前没有来源支持 `avere` 完整变位、规则动词完整范式或更广不规则动词表，UI 明确显示缺口。
- 没有采用 Dimenticato/Murmura（无明确许可证），也没有采用 LingoFlow grammar（英语语法提示错位）。没有人工或 AI 伪造完整变位数据。
- Reading / Listening 审计后的决定：LingoFlow 仅 3 篇机器翻译 story，需逐篇人工复核；Murmura 无许可证且不存在 listening 数据。因此本轮不接入独立分级 Reading。主课程已有 20 个 `mode: listen` 的 `it-IT` TTS 听辨练习；独立分级阅读 0、独立音频听力 0。
- 公开 Chrome 验证 Grammar 5 张来源卡、按主线解锁和返回课程练习正常。验证时发现词库缺少独立 `essere` 词条，已在 `app-17.js` 增加从 source-provided infinitive/形态说明到现有变位词的反向索引，不新增或伪造词条。
- 修复发布后再次用公开 Chrome 验证：点击 `essere` 会返回已有 `sono` 词条并显示 `lemma: essere`；应用自身 console 无 error。Safari / iPhone 语音仍需真机验证。
- Service Worker 更新为 `english-memory-lab-v5-ui-20260906-25`；课程正文和 Italian 词库分片继续按需缓存。

## 24. 冻结边界（Italiano 学习系统起点）

- 新增 `CODEX_FREEZE.md`，以 `20eb779242b20cad4f8849bf27d4617b16b9e5a4` 为冻结基线。
- 已验证的词库、IELTS Atlas Reading、串题、写作、先秦文学、计划/机考/私人题库、App Shell、旺旺、PWA 与 TTS 均为 FROZEN。
- 后续 Italiano 开发采用独立数据和最小 adapter；除明确缺陷或必要接口接入外，不重扫、不重构冻结模块。
- Italian Core 4,000 / Full 16,327 只作为现有本地词典和 Vocabulary Engine 使用，禁止重复构建或复制。

## 23. Italiano 静态词库（本轮）

本轮只新增 Italiano 词库；IELTS Listening、AI、政治题库和全站 UI 重构均未开展。

- `data/italian-full-01.json` 至 `data/italian-full-09.json`：Italiano Full 16,327 词；Core 4,000 直接复用排名最前的 2 个分片，不再保存重复的 Core 大文件。
- `data/italian-manifest.json`：版本、来源、许可证、数量、分片与 SHA-256。
- `scripts/build-italian.mjs`：构建时下载并流式读取公开源，大型原始文件只放临时目录，构建完成即删除。
- `scripts/check-italian-data.mjs` / `npm run check:italian`：校验数量、中文释义、重复项、排名、分片校验和、TTS、进度隔离和缓存策略。

数据来源：

- 中文释义与原有语法元数据：中文维基词典，经 Kaikki / Wiktextract 结构化提取；CC BY-SA 4.0 + GFDL。
- 频率与 rank：`hermitdave/FrequencyWords` 的 Italian OpenSubtitles2018 50k；内容 CC BY-SA 4.0，生成器 MIT。
- 构建阶段完成繁体转简体与无效项过滤。没有使用 AI 生成中文释义、词性、性别、复数、不定式或级别。
- Full 当前可用字段统计：POS 10,410、gender 3,948、plural 2,908、infinitive 5,864、IPA 4,812、双语例句 280；数据源没有的字段保持空值，未伪造 CEFR level。

运行时使用现有 Vocabulary Engine 的最小 adapter：

- `italian_core` 和 `italian_full` 是独立 deck ID，进度继续使用 `deckId|word`，与 TOEIC / IELTS / 考研英语完全隔离。
- 四选一、拼写、100 / 300 / 500 / 全部、错词回流、Day 0 / 1 / 3 / 7 / 14 / 30 和 IndexedDB 缓存全部复用现有逻辑。
- 每个 runtime deck 携带 `speechLang`；Italiano 自动与手动朗读使用 `it-IT`，原英语串题和词库仍使用原设置。
- Learning Library 在当前 profile 显示 Italiano 时展示课程入口；Today 的 Italiano 任务也可以进入现有词库页。
- Core 和 Full 都是用户点击后按需读取；每次最多并行读取 2 个分片。Core 与 Full 共用静态分片，避免重复下载或存放相同词条。Service Worker 只预缓存小型 `italian-manifest.json`，不预缓存任何 Italian 正文。
- IndexedDB schema 与 localStorage key 均未变更，也没有数据迁移。

Service Worker cache：`english-memory-lab-v5-ui-20260906-21`。

静态回归已通过全部 JS syntax、Italiano、TOEIC、Exam Engine、先秦文学、计划、练习、私人题库、机考、本地老师、听说读写、IELTS Atlas、存储、站点与 UI contract 检查。首次公开发布时发现单独的 `italian-core.json` 上传内容损坏，随后改为 Core 复用 Full 前 2 个已校验分片，并重新做线上安装测试。Chrome 公开站点已验证项目显示、Learning Library 入口、Core/Full 卡片、Core 安装和训练；Safari / iPhone 的实际声音输出仍需真机验证。

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

## 12. 倒数日与自由学习计划（Phase 2）

新增兼容字段 `state.planner`，每个 Local Profile 各自保存：

- `maxDailyReviews`：每日最大复习量，默认 100。
- `schedules`：按项目配置任务名称、数量/分钟、单位、周一至周日、启用状态。
- `taskStatus`：为后续任务状态扩展预留；当前 Today 完成勾选仍兼容使用既有 `todayChecklist`。

当前能力：

- 每个显示中的项目可设置 `examDate`，Today 项目卡显示 D-x。
- 可建立“新词 30”“Reading 1 篇”“Listening 1 Section”“名词解释 5 题”等数量计划，也可按分钟学习。
- 可自由选择周一至周日，暂停、恢复或删除每周计划。
- Today 根据当前 profile、当天星期与启用计划自动生成任务，不再写死展示所有预设课程。
- 到期错句与词汇复习始终排在新内容前，并受每日最大复习量约束。
- 词汇继续使用原有 `[0,1,3,7,14,30]`；串题卡新增向后兼容的 `reviewStep`，旧 `ease/reps/due` 字段保留，并扩展到同样的 Day 0/1/3/7/14/30。
- 先秦文学现有题量计划仍会进入 Today，不修改其题型或覆盖率逻辑。

新增运行时文件 `app-8.js` 与 `npm run check:planner`。当前 Service Worker cache 为 `english-memory-lab-v5-ui-20260905-12`。Phase 2 的全部语法、存储、计划、词库、题库、静态站点与 UI contract 检查通过；浏览器与 Safari 真机验证限制同上。

## 13. 通用 Exam Engine（Phase 3）

已新增 adapter 层，不替换也不改写 Vocabulary Engine：

- 每个 profile 新增 `state.examEngine`：`questions`、`attempts`、`wrong`、`review`。
- `normalizeExamQuestion()` 提供统一题目字段，包括 `id/projectId/type/section/stem/options/answer/keywords/referenceAnswer/points/explanation/source/sourceType/license/attribution/tags/content/audio`。
- `adaptPreqinQuestion()` 将现有先秦文学数据映射到统一接口，但现有课程 UI 与 `state.questionEngine` 继续原样工作。
- 汉语言 / 先秦文学：仅 `term_definition`、`short_answer`、`essay`。
- TOEIC：Listening Part 1–4、Reading Part 5–7。
- IELTS：Reading、Listening；Writing / Speaking 明确保留到后续。
- 自定义项目可自行勾选选择、判断、填空、名词解释、简答、论述，至少保留一种。
- 没有本地题库的分区诚实显示“等待题库接入”，不伪造题目、不调用 AI。

新增运行时文件 `app-9.js`、考试训练入口和 `npm run check:exam`。当前 Service Worker cache 为 `english-memory-lab-v5-ui-20260905-13`。Phase 3 的语法、存储、计划、Exam Engine、词库、题库、站点与 UI contract 检查全部通过；浏览器与 Safari 真机验证限制同上。

## 14. 后续阶段顺序

1. Phase 9–11：建立 serverless AI Gateway、Provider abstraction、缓存/预算/熔断和管理员总开关；部署与密钥配置需要独立安全环境。
2. 土地资源管理与考研政治必须等各自资料和题型配置，不使用先秦文学题型比例。
3. GitHub Pages 前端不得继续作为未来 API Key 存储位置；AI Gateway 完成前不要新增前端 AI 能力。

## 15. TOEIC / IELTS 开源练习（Phase 4）

已接入小规模、可审计的内置练习包，不复制第三方完整 App，也不包含商业教材、官方往年试卷或无许可音频：

- `data/exam-practice.json` 包含 10 道 TOEIC Reading Part 5 与 9 道 IELTS Reading 练习题。
- TOEIC 题目取自并适配 `kdeppaei/toeic-question-ocean` 的原创模拟题，许可证 MIT。
- IELTS 阅读取自并缩编 `LuchoBazz/ielts-ai-dataset` 的 AI 合成模拟材料，许可证 CC BY 4.0。
- 全部内容在数据与 UI 中明确标为 `Practice / Simulation · 非官方真题`，并保存 `source/sourceType/license/attribution`。
- `THIRD_PARTY_NOTICES.md` 保存完整来源与使用说明；`aimerfeng/ists` 仅用于研究本地优先结构和版权隔离策略，没有复制其代码或题目。
- 新增轻量练习工作区：选择题与 T/F/NG、短答案均完全本地判分；错题进入当前 profile 的 `state.examEngine.wrong`，答题记录进入 `attempts` 且最多保留 500 条，避免无限增长。
- 内置题目只作为静态 JSON 读入内存，不重复写进每个 profile 的 localStorage；只持久化用户作答记录。
- 没有引入 PDF、音频或 Blob，Service Worker 仅缓存小型结构化 JSON。当前缓存版本为 `english-memory-lab-v5-ui-20260905-14`。

新增运行时文件 `app-10.js` 与 `npm run check:practice`。语法、词库、先秦题库、存储、计划、Exam Engine、练习数据、站点和 UI contract 全部通过。Vite 在当前执行环境因 `uv_interface_addresses` 失败，独立 HTTP 会话也无法被另一执行会话访问，因此没有声称完成浏览器、Console、Service Worker runtime 或 Safari 真机验证；上线后仍需在真实浏览器执行该项回归。

## 16. 私人题库（Phase 5）

已新增 `My Library / 私人题库`，用于用户合法拥有的 PDF、MP3、M4A、WAV 和答案文本：

- 独立 IndexedDB：`englishMemoryLab_private_library_v1`，`papers` 保存结构化试卷，`blobs` 保存二进制文件，不改变现有词库 IndexedDB。
- 每份试卷记录 `profileId`；列表只读取当前 Local Profile 的内容，不把私人元数据写进 public GitHub 或共享内置题库。
- PDF 在浏览器本地解析，解析文字可预览和人工修改；默认不保存原 PDF，只有用户主动勾选“保留原 PDF”时才写 Blob。
- 音频支持多选，每个文件绑定一个可编辑 Section；PDF 与音频都读取一次并计算 SHA-256，同一文件只保存一份 Blob。
- Answer Key 支持逐行粘贴并规范化为题号与答案；Preview 显示项目、页数、PDF 保留状态、Section 绑定与答案数。
- 删除试卷时会检查全部 profile 的引用，只有不存在其他引用时才删除对应 Blob，避免重复文件与孤儿文件长期占空间。
- 表单输入只更新内存，不逐键写 localStorage / IndexedDB；点击保存才执行持久化。
- Service Worker 不缓存任何私人 PDF / MP3 / M4A / WAV，只新增运行时代码，缓存版本为 `english-memory-lab-v5-ui-20260905-15`。

新增运行时文件 `app-11.js` 与 `npm run check:private-library`。语法、词库、先秦题库、存储、计划、Exam Engine、练习数据、私人题库、站点和 UI contract 全部通过。浏览器与真机验证限制同 Phase 4，未声称已完成 IndexedDB 真机容量、iPhone 文件选择器或音频格式兼容验证。

## 17. IELTS / TOEIC 机考界面（Phase 6）

已新增通用但按项目配置的机考 runner，不改 Vocabulary Engine：

- Exam Engine 可选择 `Learning Mode / Exam Mode` 与专项练习、Timed Practice、Full Mock。
- Full Mock 启动前检查项目要求的题型是否都有本地题目；当前资源不足时明确拒绝，不把小型练习包冒充完整套题。
- IELTS Reading / 通用阅读使用左侧文章、右侧题目的双栏布局，移动端自动改为单栏。
- 支持题号导航、已答状态、Review 标记、文章选中文字高亮、上一题/下一题。
- 答案只在内存中逐键更新，900ms 防抖后进入原有合并写机制；倒计时每秒只更新 UI，不每秒写盘。
- 交卷后按标准答案完全本地判分，未答计错，错题写入当前 profile 的 `state.examEngine.wrong`，attempts 继续限制为最多 500 条。
- Listening / TOEIC Part 1–4 共用音频 runner；音频按需从私人题库 IndexedDB 读取，不预缓存、不重复保存、不写播放进度。
- `question.audio` 已支持 `sha256/start/end/sectionId`，为 questionGroup 音频区间预留；timeupdate 只负责到结束点暂停，不持久化。
- 私人试卷增加明确的 `examType`；列表可直接进入机考。Answer Key 生成本地判题占位题号，PDF 解析文字作为本地题面，Section 音频按题号区间绑定。没有 Answer Key 时拒绝本地判分。
- IELTS Listening 非 40 题时明确显示“当前资料非标准 40 题”。
- 当前 Service Worker cache 为 `english-memory-lab-v5-ui-20260905-16`。

新增运行时文件 `app-12.js` 与 `npm run check:computer-exam`。全部语法与九项 contract / 数据回归通过；浏览器、Console、Service Worker runtime、Safari/iPhone 音频与 IndexedDB 仍需在线上真机验证，未声称已验证。

## 18. 本地 IELTS / TOEIC 老师（Phase 7）

新增完全离线、无需 AI 的固定教学策略：

- IELTS Reading：定位、同义替换、T/F/NG 区分、Matching 排除、常见范围与因果陷阱。
- IELTS Listening：答案内容与词性预测、signal words、自我纠正型 distractor、拼写、单复数、数字与 word limit。
- TOEIC Part 1–4 分别提供图片动作、问答类型、对话预读、独白场景策略；Part 5–7 分别提供语法空格、篇章衔接与多篇阅读定位策略。
- Learning Mode 在作答阶段显示固定策略；Exam Mode 作答时不显示，交卷后统一展示分析。
- 本地交卷结果按错题展示用户答案、参考答案、已有 explanation 和对应答题步骤。
- 错因可多选记录：定位、同义替换、词汇、干扰项、拼写、单复数、粗心、时间不足。
- 错因保存在当前 profile 的 `state.examEngine.wrong[questionId].reasons`，重复做错不会覆盖历史已选原因。
- 不调用 AI、不写 API Key，也没有增加高频写盘；错因只在用户点击时进入原有合并保存。
- 当前 Service Worker cache 为 `english-memory-lab-v5-ui-20260905-17`。

新增运行时文件 `app-13.js` 与 `npm run check:local-teacher`。全套语法、数据、存储、计划、机考、教学策略、站点与 UI contract 回归通过；浏览器与真机验证限制同前。

## 19. 英语听说读写（Phase 8）

新增统一入口，但继续复用现有业务能力：

- 听：私人题库真实音频 / Section 机考入口、当前串题句子的 TTS 听写、带音频错题重听。
- 错题现在只额外保存小型 `audio` 引用、题干与答案，不复制 Blob；错题重听从 IndexedDB 按 SHA-256 读取同一份音频，支持 start/end 范围且不写 timeupdate。
- 说：继续使用现有 Speech Recognition；新增 MediaRecorder 录音与 `<audio>` 回放。录音 Blob 只留内存，不写 localStorage / IndexedDB，清除或离开页面时停止麦克风并释放 Object URL。
- 读：直接进入 TOEIC / IELTS 双栏机考与本地判分。
- 写：复用现有单词拼写、逐空输入、Enter 下一空、挖空和默写，不引入较重的 LanguageTool / Whisper / sherpa；当前也未为了拼写检查强行加入 nspell。
- 当前 Service Worker cache 为 `english-memory-lab-v5-ui-20260905-18`，仍不缓存音频/PDF。

新增运行时文件 `app-14.js` 与 `npm run check:language-skills`。全部语法和十项专项/回归检查通过；麦克风权限、iOS MediaRecorder 格式与真实音频回放仍需真机验证。

## 20. 每阶段回归清单

1. `node --check` 检查所有运行时 JS
2. `npm run check:data`
3. `npm run check:questions`
4. `npm run check:storage`
5. `npm run check:planner`
6. `npm run check:exam`
7. `npm run check:site`
8. `npm run check:ui`
9. 浏览器检查主要交互和 Console
10. 检查 Service Worker 与离线入口
11. 检查 TOEIC 核心 1250、完整 11154、IELTS、考研
12. 刷新后确认 localStorage / IndexedDB 状态仍在
13. 重大前端更新同步 bump Service Worker cache version和静态资源版本

## 21. 下一位 Codex 的起始要求

先读取 GitHub `main` 最新提交和真实代码，再读本文档。保留全部现有功能与数据契约；每次只完成一个清晰阶段。若文档与代码或线上行为冲突，以代码和线上行为为准。不要重新实现已经完成的 TOEIC 静态词库，不要恢复 `vocab-patch.js`，不要进行全量重写。

## 22. IELTS Atlas Reading 题库（本轮）

在现有 Exam Engine 外围新增了最小 Atlas adapter，没有替换 Vocabulary Engine、机考 runner 或既有 19 道内置模拟题：

- 上游：`sallowayma-git/IELTS-practice`（IELTS Atlas），固定到提交 `1e2e47ed18f1a9005af8ae0e5592f80ee8d412b3`，避免远端数据格式无提示变化。
- 实际目录统计：234 篇 Reading 单篇试卷 / passage、645 个题组、3143 个可判分答案字段。
- 解析覆盖：227 篇有解析文件，7 篇暂无解析；解析文件内共有 2170 条逐题解析 item。没有解析的题目会诚实显示“暂无现成解析”。
- `data/ielts-atlas-manifest.json` 只保存约 100KB 的元数据目录，不复制 8MB 以上的题文与解析资产。
- 用户进入 `IELTS → Reading` 后才显示 Atlas 目录；选择试卷后只读取该卷的 exam shard 与 explanation shard。来源固定到 commit raw URL，Service Worker 沿用现有远程按需缓存策略，不把 234 卷加入 precache。
- `app-15.js` 负责安全提取 Atlas 注册数据、清理上游 HTML、把拖放题降级为移动端可用的 select、兼容单选/填空/配对/多选，并在一次交卷时集中本地判分。
- 答题过程只更新内存，不逐键写盘；交卷时一次性写入当前 profile 的 `state.examEngine.atlasHistory`、既有 `attempts` 与 `wrong`。历史最多 200 卷，attempts 继续沿用 500 条上限。
- 题文、答案、解析不写入 localStorage / IndexedDB，不跨 profile 复制；Atlas 历史与错题继续按 Local Profile 隔离。
- 上游 GPL-3.0 授权针对代码；上游 README 明确提醒题源、文章、图片和解析可能涉及第三方权利。本仓库只发布独立 adapter 与元数据，题文按需从上游读取，并在 UI 与 `THIRD_PARTY_NOTICES.md` 保留版权提示，不宣称为官方 IELTS 真题。
- 新增 `scripts/build-ielts-atlas.mjs` 用于从指定上游 checkout 重建目录，新增 `npm run check:atlas` 验证固定版本、实际数量、按需加载与不预缓存题目分片。
- PWA cache 已更新为 `english-memory-lab-v5-ui-20260906-19`，仅新增 `app-15.js` 和 Atlas manifest 到核心离线缓存。

本轮完整静态回归通过，包括 15 个运行时脚本语法、TOEIC 1250/11154、先秦文学 20 题、存储保护、计划、Exam Engine、原练习、私人题库、机考、本地老师、听说读写、PWA 入口与 UI contract。本地 Vite 仍因 `uv_interface_addresses` 环境错误无法启动，但部署后已在云端 Chrome 对线上 GitHub Pages 完成真实交互：启用 IELTS 项目、进入 Reading、加载 234 篇 Atlas 目录；“茶叶简史”13 个答案全部正确得到 13/13 并显示 13 条现有解析；“组织设计”复选题限制、配对下拉和错误提交结果正常。过滤浏览器扩展自身日志后，页面 Console 无 error。Safari / iPhone / PWA 真机仍未验证，不得声称已验证。
