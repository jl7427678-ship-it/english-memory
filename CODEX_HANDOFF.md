# 串题记忆室 · English Memory Lab — Codex 接手文档

更新时间：2026-09-05

## 1. 项目与优先级

- GitHub：`jl7427678-ship-it/english-memory`
- 默认分支：`main`
- GitHub Pages：`https://jl7427678-ship-it.github.io/english-memory/`
- 纯静态 HTML / CSS / JavaScript PWA，无后端。
- 本轮实施起点：GitHub `main` commit `a4062b28bfb47666d7a1d77c083e9ebcc3eda203`。
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
- `app.js`：按顺序加载 `app-1.js` 至 `app-5.js`
- `app-1.js`：状态、localStorage、基础工具
- `app-2.js`：串题训练、TTS、语音识别、词库配置和 IndexedDB
- `app-3.js`：内置词库安装、缓存、自定义词库及训练会话
- `app-4.js`：词汇答题、拼写、考试、AI 可选评分、错句复习
- `app-5.js`：统计、文件导入、设置、数据备份、PWA 安装
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

狗狗 mascot 必须优先使用用户后续提供的正式图片资源。未收到资源前，不允许用 CSS、emoji 或临时插画伪造另一只狗。

专业名称必须始终写作“土地资源管理”，禁止写成图书馆资源管理、图书情报或图管。

## 9. 后续阶段顺序

1. 完成 TTS 局部修复与回归
2. 更新本 HANDOFF
3. 建立 Design Tokens、App Shell、新导航和新版“今日”首页（已完成骨架）
4. 停止并报告，不继续大规模开发
5. 下一阶段先接入用户提供的正式 UI 参考图与狗狗 mascot assets，再细化首页视觉
6. 之后做学习库整合、训练中心题型 adapter、计划模块
7. 安全后端存在后再接 AI Provider；真实 API key 不得写进公开前端
8. Safari / UI / Plan 稳定后再做 Italiano 静态词库

## 10. 每阶段回归清单

1. `node --check` 检查所有运行时 JS
2. `npm run check:data`
3. `npm run check:site`
4. `npm run check:ui`
5. 浏览器检查主要交互和 Console
6. 检查 Service Worker 与离线入口
7. 检查 TOEIC 核心 1250、完整 11154、IELTS、考研
8. 刷新后确认 localStorage / IndexedDB 状态仍在
9. 重大前端更新同步 bump Service Worker cache version 和静态资源版本

## 11. 下一位 Codex 的起始要求

先读取 GitHub `main` 最新提交和真实代码，再读本文档。保留全部现有功能与数据契约；每次只完成一个清晰阶段。若文档与代码或线上行为冲突，以代码和线上行为为准。不要重新实现已经完成的 TOEIC 静态词库，不要恢复 `vocab-patch.js`，不要进行全量重写。
