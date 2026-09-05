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

1. Phase 8：听说读写入口与本地能力整理。
2. Phase 9–11：完成本地系统后才接 serverless AI Gateway、缓存/预算/熔断和管理员总开关。
3. 土地资源管理与考研政治必须等各自资料和题型配置，不使用先秦文学题型比例。
4. GitHub Pages 前端不得继续作为未来 API Key 存储位置；AI Gateway 完成前不要新增前端 AI 能力。

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

## 19. 每阶段回归清单

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

## 20. 下一位 Codex 的起始要求

先读取 GitHub `main` 最新提交和真实代码，再读本文档。保留全部现有功能与数据契约；每次只完成一个清晰阶段。若文档与代码或线上行为冲突，以代码和线上行为为准。不要重新实现已经完成的 TOEIC 静态词库，不要恢复 `vocab-patch.js`，不要进行全量重写。
