# Ghost Inside · 那顿没有结束的晚餐（2.5D MVP 原型）

一个可在浏览器直接游玩的中文单人叙事推理原型。设计依据为同目录 `GHOST_INSIDE_GDD_2.5D_MVP_v0.1.md`，入门要求见 `ONBOARDING_SPEC.md`。

- 一间抽象 2.5D 晚餐房间、固定四个时刻（19:10–19:13）、六条线索（M01–M06）、一条信念链上两处可核对的推断。
- 全流程单鼠标可完成：点击调查 → 现场回放 → 点推断、选 1–2 条已发现依据 → 写/组合解释 → 预览 → 亲手完成行动（到桌边把话说完，或到门口先暂停）。
- 两种结局是同一信念松动后的不同练习；每轮只取一种，可保留证据换一种重试，或清空重开。
- 固定事实不可改写：父亲动机未知；不出现道歉、疾病、家庭秘密；不承诺心理治疗效果。
- M05（19:13 的餐盘）必须主动核对回放或针对性追问才会取得，不会按对话次数发放。

## 启动

要求 Node.js ≥ 20（无第三方运行时依赖，无需 `npm install`）。

```bash
cd "Ghost Inside_2.5D_Prototype_Building"
npm start          # 等价于 node server.mjs，默认 http://127.0.0.1:4173
```

浏览器打开 `http://127.0.0.1:4173` 即可游玩。可用环境变量：`PORT`、`HOST`。

> **端口冲突提示**：旧 demo（`../game/web`，`npm start`）默认也占用 4173，且启动时会强杀端口占用者。若 4173 被旧 demo 抢占（页面标题是「心灵调理师 · 最优人生」即为旧版），用 `PORT=4180 npm start` 换端口启动本 MVP，或先停掉旧 demo 的进程树再启动。

## AI 模式（诚实边界）

- 默认**备用互动**：所有回应由本地固定事实校验生成，界面左下角持续显示「备用互动」徽标；不会把固定回应冒充实时 AI。
- 若要接入实时模型，通过服务端环境变量配置（密钥只存在服务端，绝不进入前端）：

```bash
GHOST_AI_URL=https://your-gateway.example/v1/respond \
GHOST_AI_TOKEN=*** \
GHOST_AI_TIMEOUT_MS=8000 \
npm start
```

服务端会校验 provider 回应：禁止引用未解锁证据、禁止范围外效果/行动、禁止改写固定世界（道歉、疾病等）；任一不通过自动回退备用互动并在响应中附带 `providerErrors`。注意：自动化检查只验证了 mock provider 的行为，**真实模型未接入、未验证**。

## 目录结构

```
index.html            入口页
server.mjs            静态服务 + /api/status + /api/respond（AI 校验与回退）
src/game-data.js      固定世界数据：证据、时刻、推断、提示、短句组合
src/game.js           纯函数状态机（reduceGame）
src/ui.js             渲染与交互（无框架、无内联 onclick）
src/ai-contract.js    请求校验、provider 上下文、回应白名单校验、备用回应生成
src/styles.css        冷紫/暖琥珀抽象 2.5D 场景与响应式样式
tests/                node:test 规则测试 + 服务端集成测试 + Playwright e2e
scripts/check.mjs     一键全量检查入口
```

## 测试

```bash
npm test              # 规则测试 + 服务端集成测试 + 浏览器 e2e（e2e 复用 ../../game/web 的 Playwright）
node scripts/check.mjs  # 语法、HTML/CSS 基线、全部测试
```

e2e 覆盖：A 路线（留下表达）、B 路线（先暂停）单鼠标全流程、M05 信息门槛、保留证据重试、清空重开、Tab 焦点、360px 窄屏无溢出、44px 点击面积。

## 尚未验证的事项（诚实声明）

- 真实陌生人试玩未开展；自动检查通过不代表游戏好玩。人工验收表见 `MANUAL_CHECKLIST.md`。
- 实时 AI 未接入真实 provider，只通过了 mock 集成测试。
- 未授权生产部署或对外发布；仅本地开发与预览。
