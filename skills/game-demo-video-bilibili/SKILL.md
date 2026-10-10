---
name: game-demo-video-bilibili
description: 游戏演示视频全流程：Playwright 自动通关录屏、edge-tts 中文语音解说、中英双语 ASS 字幕、ffmpeg 合成 MP4，以及哔哩哔哩（B站）投稿全流程——扫码登录、上传发布、抓取 BV 号、发布后修改封面。Use whenever the user wants to 录制游戏通关视频/演示视频/Walkthrough、给视频配音解说或加双语字幕、合成或压缩视频、上传视频到 B站/哔哩哔哩、发 BV 号、改 B 站封面——即使只提到其中一步也应该触发本技能。
---

# 游戏演示视频制作与 B 站投稿

把一个可在浏览器运行的游戏 Demo，做成一支**带中文语音解说、中英双语字幕的自动通关视频**，并**发布到哔哩哔哩**。

`scripts/` 下的 7 个脚本于 2026-10 在真实项目（Ghost Inside · Three.js 游戏）上完整跑通并成功发布（BV1VjpP6tEZ2），可直接复用或按 `ADAPT` 注释改造。**动手前必读 `references/pitfalls.md`**——里面是 15+ 条真实失败换来的踩坑记录（testMode 冻结渲染、headless 软渲染、B 站 SPA 路由、Vue 按钮要点法、封面 12 秒上传等待等），每一条都曾让流程报废过至少一次。

## 前置条件

```bash
npm i -D playwright && npx playwright install chromium   # Node 18+
winget install Gyan.FFmpeg                                 # 需含 libass（full 版）
pip install edge-tts                                       # 微软神经语音，免费
```

游戏需支持 `?test=1` 调试钩子：暴露 `window.__game = { snapshot, input, stepSimulation }`。
**注意：只允许用 `snapshot()` 读状态和 `input()` 发按键，绝不调用 `stepSimulation`**（原因见 pitfalls #1）。

## 阶段一：录制自动通关视频（record-walkthrough.mjs）

1. 复制脚本，改两处（搜 `ADAPT`）：
   - `TARGETS`：本地服务器地址（优先）+ 线上部署地址（兜底）
   - 关卡数据：物品/交互点坐标、跳跃位置、阶段名（从游戏源码的快照结构里读）
2. 关键约束（缺一不可）：
   - **有头浏览器**（`headless: false`）——headless 用 CPU 软渲染 WebGL，会慢 10 倍且丢帧
   - **真实键盘事件**驱动（`page.keyboard.down/up`），不是测试接口
   - `addInitScript` 拦截 window blur（否则失焦清空按键，录到一半角色站桩）
   - 告知用户：**屏幕会弹出浏览器窗口自动玩游戏，约 2-5 分钟，不要点别的窗口抢焦点**
3. 叙事节拍加停顿：每个交互/剧情点后 `sleep(900~3200)`，成片节奏才像真人 walkthrough（一次速通 <60s 会太快，解说塞不下）
4. 产出：`walkthrough_raw.webm`（原始录屏）+ `timeline.json`（事件名→秒数的对轴数据）

## 阶段二：解说语音与双语字幕（narration.json → tts.mjs → compose.mjs）

1. 写 `narration.json`（每句一行，`win` 绑定 timeline 事件窗口）：

```json
{
  "voice": "zh-CN-YunxiNeural", "rate": "+15%",
  "lines": [
    { "id": "L01", "win": ["game_started", "tutorial_1"], "cn": "2077年，算法替人类管理情绪。", "en": "The year 2077..." }
  ]
}
```

2. `node tts.mjs` — 生成 `tts_L01.mp3` 等（内置 4 次重试 + 文件大小校验，edge-tts 网络抖动会产出损坏文件）
3. `SPEED=1 node compose.mjs` — 一条命令合成：
   - 掐头（`-ss` 去掉加载死镜头，时间轴整体平移）
   - 解说按事件窗口对轴排布（同窗多句自动顺延，不重叠）
   - ASS 字幕：中文主行 + 英文副行，**MarginV=112/8 避开游戏自带字幕栏**（重叠过，调过）
   - `tpad` 尾部补帧 4s（防止结束语被截断）、H.264/AAC、`+faststart`
4. 验证（必做）：`ffmpeg -ss N -i out.mp4 -frames:v 1 check.png` 抽 3-4 帧，肉眼确认画面非黑屏、字幕渲染无乱码、不遮游戏 UI

## 阶段三：B 站投稿（bili-*.mjs，需有头浏览器）

按序执行，`.bili-profile` 持久化登录态：

| 步骤 | 脚本 | 要点 |
|---|---|---|
| 1 登录 | `bili-login.mjs` | 弹二维码等用户扫（≤5 分钟）；登录态存 profile，之后免扫 |
| 2 投稿 | `bili-upload.mjs` | 视频→DOM 直填标题/简介（简介是 ql-editor，普通 fill 无效）→标签→封面对话框传官方主视觉→创作声明选**「含AI生成内容」**（平台新规，AI 素材必须声明）→「立即投稿」force-click |
| 3 取链接 | `bili-geturl.mjs` | 调 `/x/web/archives` API，从 `arc_audits[].Archive` 按标题匹配取 BV 号 |
| 4 改封面 | `bili-edit-cover.mjs` | 内容管理→article-card 行→编辑→**hover 封面图**显出「封面设置」→上传→**等 12s 图片上传完**再点「完成」（坐标点击）→「立即投稿」→API 验证 `pic` hash 变化 |

改标题/简介/标签/封面/声明都改脚本顶部的常量块。改封面会触发重新审核，链接不变。

## 输出物清单

`walkthrough_raw.webm`（无字幕底片）、`walkthrough_解说版.mp4`（成片）、`narration.json`（解说稿，可改后只重跑 tts+compose）、`timeline.json`、`bili_url.txt`（BV 链接）。

## 何时不适用

- 游戏无浏览器版（纯原生）→ 只能手动录制（OBS / Win+Alt+R），阶段二三仍可用
- 要发 YouTube 而非 B 站 → 上传部分需换（录制/合成部分完全通用）
