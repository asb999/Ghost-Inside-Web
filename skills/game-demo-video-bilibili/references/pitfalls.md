# 踩坑记录（每条都真实发生过，多数导致过一次完整报废重跑）

## 一、录屏驱动

1. **测试模式的 `stepSimulation` 会永久冻结渲染**。本例游戏的 GameClock 在 testMode 下 `rAF` 直接 return（`if (this.testMode) return`），且 testMode 不可逆——一旦调用，画面永远停在最后一帧，录出来是"通关成功但全程静止"。对策：真实键盘事件 + 实时时钟；`__game` 只用 `snapshot()` 和 `input()`。
2. **页内同步驱动（page.evaluate 一次跑完整个流程）快到没帧**：整个通关 6 秒墙钟完成，视频里只渲染了几帧。对策：每 1-2 秒让出主线程（waitForTimeout）让 rAF 跑。
3. **Playwright 每步往返开销在 headless 下被放大**：软渲染 WebGL 打满主线程，一次 snapshot 要 ~10s，3 步走 3 分钟。对策：有头浏览器（真实 GPU）后往返降到 ~100ms。
4. **headless: true 的三大问题**：CPU 软渲染（慢+丢帧）、请求易挂起（模型文件 4 分钟加载不出来）、无法验证用户所见。录屏必须 `headless: false`。
5. **window blur 清空按键状态**（游戏 Input 的防呆设计）：弹窗/切窗口会导致角色站桩。对策：`addInitScript(() => window.addEventListener('blur', e => e.stopImmediatePropagation(), true))`。
6. **游戏物理参数决定机器人写法**：负重时跳跃高度不够过 1.55m 障碍 → 必须等移动障碍甩到侧面再冲；最终大断层（5.5m）要贴边起跳。写机器人前先读游戏的跳跃初速度/重力/障碍物碰撞盒，别凭感觉写。
7. **资源加载卡死要有兜底**：进页面先 `fetch` 预取最大的模型文件（写 HTTP 缓存）；75s 未就绪自动 reload 重来一次；录制前探测目标可达（本地优先、线上兜底）。
8. **对话/剧情节拍的停顿决定成片质量**：无停顿速通 <60s，解说（~80s 语音）塞不下；每节拍 sleep 900-3200ms 后总长 83s，刚好 1 分半。

## 二、TTS 与合成

9. **edge-tts 网络抖动产出 0 字节/损坏 mp3**，ffprobe 直接报 "Failed to find two consecutive MPEG audio frames"。对策：生成后校验文件 >2KB，失败删除重试（最多 4 次，间隔 3s）。
10. **Node `execFileSync(file, args, 'utf8')` 第三参必须传对象** `{ encoding: 'utf8' }`——传字符串直接 TypeError。
11. **解说总长 > 画面时长会整体后飘**：先合并短句（三个"拿起 X"并成一句）、删非必要句、语速 +15%，把滞后压进窗口容差。
12. **字幕与游戏自带字幕栏重叠**：游戏 UI 在底部 70px 有字幕条，ASS 的 MarginV 要给到 112（中文）/8（英文副行），并抽帧验证。
13. **`-shortest` 会截掉比视频长的尾句解说**：用 `tpad=stop_mode=clone:stop_duration=4` 给视频补尾帧代替。
14. **掐头去加载死镜头后，所有字幕/解说时间轴要同步平移**（`shift(t) = t - TRIM`），`-ss` 放在 `-i` 之前才快。

## 三、B 站投稿（创作中心是 Vue SPA，处处是坑）

15. **深链会被路由守卫重定向回首页**（`/platform/content/video`、`/platform/upload-manager/video` 都不行）。对策：从首页出发点侧边栏，或用最终能用的 `upload-manager/article`（它是统一稿件管理，视频也在里面）。
16. **稿件列表卡片是 `div.article-card`**，不是 tr/li/[class*=item]——通用选择器全落空。定位用 `.article-card` + `filter({ hasText: 标题关键词 })`。
17. **投稿表单（新版单页）**：简介是 Quill 编辑器（`div.ql-editor`），Playwright `fill` 无效——要 DOM 直填 `innerText` + 派发 input/change 事件；标题是带 placeholder 的 textarea。
18. **「立即投稿」按钮**：`button:visible` 过滤经常匹配不到（被浮层挡住）；最终成功的是 `getByText('立即投稿', { exact: true }).last().click({ force: true })`。注意 `getByText('更换', {exact:false})` 会误中「更换**视频**」——非精确匹配慎用短词。
19. **创作声明必选**：2026 新规，AI 生成内容（AI 模型、AI 语音）必须声明「含AI生成内容」，否则投稿按钮无效。流程：Escape 关浮层 → 点声明输入框 → 选「含AI生成内容」。
20. **封面对话框**：点「添加封面/封面设置」不会弹系统 filechooser，是页内对话框；里面第 2 个 `input[type=file]`（`accept="image/png, image/jpeg"`）才是图片上传口（第 1 个是视频）。对话框挂载要 20s+，用 `waitForSelector('input[type=file]')` 而非固定 sleep。
21. **编辑已发布稿件的封面入口要 hover**：封面小部件的 `span.edit-text`（「封面设置」）默认不可见，先 `hover()` 封面图再点。
22. **封面「完成」点了没反应**：2.8MB 图片上传中预览只是本地 blob，立刻点完成会被忽略。等 12s 再点，且用元素真实坐标 `page.mouse.click(x, y)`（DOM click 不触发 Vue 处理器）。
23. **抓 BV 号别抓页面**：页面里混着推荐位/旧视频的 BV。用登录态 API `GET member.bilibili.com/x/web/archives?status=all`，审核中稿件在 `data.arc_audits[].Archive`（嵌套的 Archive 字段，直接取 a.bvid 是 undefined），已发布在 `data.archives[]`。按标题正则匹配自己的稿件。
24. **改封面会触发重新审核**，BV 号不变，通常几分钟恢复「开放浏览」；改完用 API 复查 `pic` 字段的 hash 是否变化（从 `ca7dcb62...` 变 `f996ed26...` 即成功），并下载新封面肉眼终验。
25. **登录态持久化**：`launchPersistentContext(profile)` 存 cookie，扫码一次永久有效；每次操作前检查 `page.url()` 是否被踢到 passport.bilibili.com。

## 四、经验顺序

正确的首次执行顺序 = 前置检查（ffmpeg/edge-tts/服务器探测）→ 录制（有头+键盘+停顿）→ 抽帧验片 → TTS（带重试）→ 合成 → 再抽帧验字幕 → 登录 → 投稿 → 取 BV → （需要时）改封面 → API 终验。任何一步省掉验证，后面都会加倍还回来。
