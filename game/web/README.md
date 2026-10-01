# Ghost Inside：心灵调理师 · 网页 Demo（第一章「最优人生」）

10/5 线上提交版 MVP。3D 跑酷探索 + 轻战斗 + AI 表态点的科幻互动叙事切片（约 6 分钟）。

## 安装与启动

```bash
# 1) 安装依赖（首次；需要 Node 20.19+ / 22.12+，本机 Node 24 已验证）
cd game/web
npm install

# 2) 安装浏览器自检用的 Chromium（首次，可选——仅跑 harness 需要）
node node_modules/@playwright/test/cli.js install chromium

# 3) 启动（构建 + 本地预览，默认 http://127.0.0.1:4173/）
npm start            # 端口可用环境变量 GHOST_PORT 覆盖

# 开发模式（热更新）
npm run dev

# 仅构建（产物在 dist/，相对路径，可挂任意静态目录/子路径）
npm run build
```

## 检查

```bash
# 在仓库根目录执行：17 项机器自检（H00 门禁 + H01–H16）
bash ./ask_astra.sh check
```

## 环境变量

| 变量 | 作用域 | 说明 |
|---|---|---|
| `GHOST_PORT` | 进程 | `npm start` 的预览端口，默认 4173 |
| `VITE_GHOST_PROVIDER_URL` | 构建期（会进入公开产物） | 可选：LLM 网关地址。**只填公开网关 URL，绝不填含 key 的地址**——私密 key 只保存在网关服务端 |
| `?provider=` | URL 查询参数 | 仅供自检 harness 故障注入使用，正式发布不要携带 |

不配置 provider 时游戏完整可玩：表态点使用数据文件内的固定回退文本（`fallbacks.hold / timeout`）。

## 操作

- ← → 移动 · 空格 跳跃 · E 交互（关闭掌声终端 / 转化怪物）
- 战斗中 ↑↓ 前后移动
- 表态点：输入一句判断（≤60 字）+ 点选已解锁的证据

## 玩法与红线

心理压力 = 怪物；战斗以「转化」为胜利，不以击杀。三条红线：不宣称疗效 · 不替当事人做人生决定 · AI 只读证据写反馈。LLM 采用受限输出（只从数据内反馈模板中选择），非法输出/超时/断网一律走固定回退，流程永不中断。

## 数据

- `../data/cases/case_001_optimal_life.json`：本关全部内容（节拍 / 47 条修改记录 / 污染脚本 / 台词 / 回退）
- 旧案例 `white_corridor.json` 为只读基线（SHA-256 锁定于 `.astra/baselines/`），运行时不加载

## 交付物

- `dist/`：静态构建产物（相对路径，支持任意子路径静态托管）
- 根目录 `DEMO_CHECKLIST.md`：人工走查表（心流/共鸣/演出节奏等机器无法判定的体验项）
