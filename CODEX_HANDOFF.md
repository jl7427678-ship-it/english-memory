# 串题记忆室 · English Memory Lab — Codex 接手文档

更新时间：2026-09-05

## 1. 项目位置

- GitHub 仓库：`jl7427678-ship-it/english-memory`
- GitHub Pages：`https://jl7427678-ship-it.github.io/english-memory/`
- 默认分支：`main`
- 当前为纯静态前端/PWA，无后端。
- 最新已确认 Pages workflow 部署成功的 commit：`4948307681df4fdd014e985b9e91d1bed8c8d00a`。

## 2. 用户真正想要的产品

这是一个低认知负担、偏“记忆训练”的英语学习网页，当前主要服务 TOEIC Speaking & Writing，后续扩展 IELTS、考研英语、意大利语。

用户不想做复杂设置，更希望打开就能背。手机 iPhone Safari 和桌面浏览器都要好用，并能“添加到主屏幕”当作 PWA。

核心要求：

1. 串题/故事背诵
2. 句子挖空输入
3. 口语复述
4. TOEIC / IELTS 串题考试
5. 类似百词斩的四选一筛词
6. 中文释义不能出现 `N/A / undefined / 空白`
7. 大词库第一次加载后本机缓存
8. UI 简洁、紫色系、移动端优先
9. 以后继续增加意大利语学习功能

## 3. 当前文件结构

主要文件：

- `index.html`：入口
- `boot.js`：加载 `ui.html` 和主 JS
- `ui.html`：页面 DOM
- `styles.css`：主要样式
- `theme.css`：UI 补充主题
- `app.js`：按顺序加载 `app-1.js` ~ `app-5.js` 以及 `vocab-patch.js`
- `app-1.js` ~ `app-5.js`：主业务逻辑拆分文件
- `vocab-patch.js`：目前用于覆盖/增强内置词库逻辑，重点是 TOEIC
- `service-worker.js`：PWA 缓存
- `manifest.webmanifest`
- `.github/workflows/pages.yml`：GitHub Pages 自动部署

注意：当前代码是迭代过程中拆出来的，`vocab-patch.js` 是补丁式覆盖，不是理想最终架构。Codex 后续应逐渐把补丁逻辑整理进正式模块，而不是继续无限叠 patch。

## 4. 已有功能

### 串题/句子背诵

- TXT / MD 粘贴或导入
- DOCX / PDF 浏览器解析
- 自动拆句、故事节点
- 完整阅读
- 30% 挖空
- 60% 挖空
- 首字母提示
- 关键词提示
- 完整复述
- 英语 TTS
- 浏览器语音识别（支持时）
- 本地评分：覆盖率、关键词、完整度
- 可选 AI 深度评分（用户自己填 API）
- 熟练度评级与错句复习

### 写作挖空

- 输入框逐空填写
- Enter 跳下一个空
- 最后一个 Enter 自动检查
- 正确绿色 / 错误红色
- 可修改后重新检查
- 百分比成绩

### 单词学习

- 英文 → 中文四选一
- 桌面 1/2/3/4 快捷键
- 中文 → 英文拼写
- 反应速度影响强化次数：
  - 错：5 次
  - 慢正确：3 次
  - 犹豫：2 次
  - 秒选：1 次
- 强化轮答错会回流
- 1/3/7/14/30 天复习思路
- 100 / 300 / 500 / 全部 批次
- IndexedDB 缓存内置词库
- localStorage 保存主要学习状态

## 5. 当前内置词库

### TOEIC

目标保留两个：

- `TOEIC 核心 1250`
- `TOEIC 完整 11154`

当前 TOEIC 数据来自：

`kknono668/toeic-vocab-tw`

当前 `vocab-patch.js` 使用 Hugging Face Dataset Viewer `/rows` API，每 100 词一批拉取。

代码当前已经改成：

- 单路下载
- 每批 100 行
- 20 秒超时
- 对 429 / 408 / 5xx 自动重试
- 指数/递增等待：2.5s、5s、10s、18s、30s、45s
- 每约 2000 词主动暂停
- 中文释义过滤：N/A / null / undefined / 空释义等不能进入题目
- 繁体 → 简体使用 `opencc-js`

### 当前实际问题

用户之前安装 `TOEIC 完整 11154` 时，在大约 2200 词卡住。

这是旧的 6 路并发版本造成的 Hugging Face 匿名接口限流。最新版本已经改为单路稳定下载，但**用户还没有确认新版本是否完整安装成功**。

即使最新版本可用，长期仍不推荐运行时从 Hugging Face 拉 11154 词。

## 6. Codex 的第一优先级：彻底解决 TOEIC 完整词库加载

不要继续依赖浏览器实时请求 Hugging Face 111 次。

推荐最终方案：**开发阶段一次性预处理词库，生成静态 JSON 放在本仓库，网页运行时只请求自己 GitHub Pages 同源文件。**

建议实现：

```text
data/
  toeic-core.json
  toeic-full-01.json
  toeic-full-02.json
  ...
  toeic-full-12.json
```

每个 full chunk 约 800~1000 词，避免单文件过大。

增加构建脚本，例如：

```text
scripts/build-toeic.mjs
```

脚本负责：

1. 下载原始 TOEIC 数据
2. 只保留需要字段
3. 去重
4. 删除无中文释义数据
5. 繁体转简体（最好在构建阶段完成）
6. 根据 `star_rating` 排序
7. 生成核心 1250
8. 生成完整分片
9. 输出 manifest，例如 `data/toeic-manifest.json`

运行时：

- 核心词库读取 `toeic-core.json`
- 完整版并行/顺序加载本仓库静态 chunks
- IndexedDB 缓存
- 不再调用 Hugging Face Dataset Viewer

这会比现在稳定很多，也是用户明确更希望的方案。

## 7. 一个必须顺手修的现有 bug：IELTS URL

当前主代码里 IELTS 配置仍可能写成：

`https://raw.githubusercontent.com/grhliu/wordtyper-vocabularies/main/vocabularies/ielts_core.json`

这个文件名之前验证过是错的。

正确为：

`https://raw.githubusercontent.com/grhliu/wordtyper-vocabularies/main/vocabularies/ielts.json`

该词库约 4974 词。

请检查 `app-4.js` 中 `BUILTIN_VOCAB.ielts_core` 并修正。

考研主词库之前使用约 4787 词的 `kaoyan.json`。

## 8. 意大利语下一阶段需求

用户刚提出要找“意大利语 ↔ 汉语对应词库”。

希望最终在同一个 App 中增加：

- 🇮🇹 意大利语核心词库
- 🇮🇹 意大利语完整词库

优先考虑的开放数据来源：

### Wikidict / open-dict-data

已有 `it-zh`（Italian → Chinese）和 `zh-it`（Chinese → Italian）语言对。

适合生成纯单词/短释义词库。

### Kaikki / Wiktionary

机器可读数据丰富，可补：

- 词性
- 词形变化
- 释义
- 可能的发音等

但原始数据较大，必须开发阶段预处理，不要让手机运行时直接下载。

### Tatoeba

适合补充 Italian ↔ Chinese 例句。

长期可以让意大利语词卡包含：

```text
parlare
说；讲话
Vorrei parlare con te.
我想和你谈谈。
```

### 意大利语推荐架构

最好同 TOEIC 一样采用静态预处理：

```text
data/
  italian-core.json
  italian-full-01.json
  italian-full-02.json
  ...
```

并增加 build script，避免运行时依赖外站。

核心版可考虑按 CEFR 做：

- A1-A2：约 1500~2500 高频生活词
- B1-B2：进一步扩展
- Full：完整 Italian → Chinese 词库

如果没有可靠 CEFR 标注，不要伪造等级。可以先按频率源或公开 CEFR 数据做交叉匹配。

## 9. 数据格式建议

未来所有内置词库统一一个 schema：

```json
{
  "id": "toeic_full",
  "title": "TOEIC 完整",
  "language": "en",
  "targetLanguage": "zh-CN",
  "version": "2026.09",
  "words": [
    {
      "word": "negotiate",
      "meaning": "协商；谈判",
      "phonetic": "",
      "pos": "v.",
      "example": "",
      "exampleZh": "",
      "tags": ["TOEIC"],
      "rank": 1
    }
  ]
}
```

运行时学习进度不要写回词库对象本体，继续存 `state.vocab.progress` / IndexedDB，避免升级词库版本时丢失用户进度。

## 10. UI 风格

当前视觉方向：

- Accent：`#6c63e8` / `#8b7cf6`
- 浅灰紫背景
- 24px 大圆角卡片
- 柔和阴影
- 紫色渐变主按钮
- desktop：左侧 sticky 导航
- mobile：底部导航 + iOS safe area
- 单词训练尽量一屏只聚焦一个词
- 手机按钮必须大、易点
- 输入框至少 16px 字号，防 Safari 自动缩放

不要把 UI 改成复杂后台管理系统。

## 11. PWA / 部署

- GitHub Pages 已启用 Source = GitHub Actions
- `.github/workflows/pages.yml` 自动部署 `main`
- Service Worker 目前对同源资源采用 network-first 思路，以减少用户一直吃旧缓存的问题
- 之前出现过新词库卡片因 PWA 缓存不更新而看不到的问题，所以每次重大 JS 更新要同步 bump cache/version

建议 Codex 后续：

1. 加一个明确的 `APP_VERSION`
2. 页面设置页显示版本号
3. service worker cache 名由 `APP_VERSION` 派生
4. 新版本激活后可提示“发现新版，点此刷新”

这样以后调试会简单很多。

## 12. 已知工程债务

1. `vocab-patch.js` 是临时补丁结构，应最终整合
2. `app-1.js`~`app-5.js` 是人为拆分，不是模块化工程
3. 没有 Vite/npm 正式构建系统
4. 没有自动测试
5. 无真正浏览器 E2E 测试
6. 大词库处理仍依赖客户端过多
7. API Key 当前如果用户填入，会保存在浏览器本地；不能把任何真实 key commit 到 public GitHub
8. 如果未来多人共享 AI 评分，需要后端 proxy，不能在 public 前端内置 key

Codex 可以考虑逐步迁移到 Vite，但不要一次重写所有功能。优先保持线上可用，分阶段迁移。

## 13. 建议 Codex 接手后的执行顺序

第一阶段：稳定当前版本

1. 拉取仓库并跑本地静态站
2. 检查 Console 是否有 JS error
3. 修 IELTS `ielts.json` URL
4. 把 TOEIC 11154 预处理成仓库静态分片
5. 删除/停用浏览器实时 Hugging Face 下载逻辑
6. 测试 TOEIC 核心和完整版：安装 → 四选一 → 拼写 → 刷新 → IndexedDB 恢复
7. 验证 GitHub Pages

第二阶段：意大利语

1. 调研并下载 Wikidict `it-zh`
2. 规范化为统一 schema
3. 清理无中文、重复、短语异常项
4. 生成 Italian Full 静态 chunks
5. 选择可靠频率/CEFR 数据生成 Italian Core
6. 可选用 Tatoeba 补例句
7. UI 增加 Italian 分类
8. 增加 Italian TTS（`it-IT`）

第三阶段：工程整理

1. 给词库单独建立 `vocab/` 模块
2. 提取 IndexedDB service
3. 提取 spaced repetition service
4. 添加基本单元测试
5. 再评估是否迁移 Vite

## 14. 用户体验要求

用户希望 Codex“直接做”，而不是给很多教程。

遇到问题：

- 优先自己读代码、查日志、修复
- 不要让用户反复手动配置
- 如果确实必须用户操作，只要求一次、一个最小动作
- 不要因为某个外部 API 不稳定就让用户一直重试
- 能静态打包的资源尽量静态打包

## 15. Codex 第一条建议指令

打开仓库后可以直接执行：

> Read `CODEX_HANDOFF.md` first. Inspect the current codebase and keep all existing features working. First fix the vocabulary infrastructure: correct the IELTS source to `ielts.json`, replace the runtime Hugging Face TOEIC full-deck downloader with build-time generated same-origin static JSON chunks, preserve IndexedDB progress, and verify both TOEIC Core 1250 and TOEIC Full 11154 on mobile-sized and desktop layouts. Do not rewrite the whole app at once. After TOEIC is stable, prepare an Italian→Chinese vocabulary ingestion pipeline using Wikidict/open-dict-data, with an Italian core deck and a full deck.