# PLAN

本计划仅用于指导执行，不代表已完成实现或验收。规划环境拒绝了本机读取命令，因此尚未核实仓库内容；下文明确标出的新增路径、接口与字段均为拟定方案。执行者必须完成仓库核对，不能把假设当作现有实现。

目标截止时间：**2026-10-05 20:00，Asia/Shanghai**。完成条件为：网页可启动、七个节拍可完整游玩、自动检查全部通过、人工走查完成。模型资源或真实 LLM 服务未就绪时，分别使用几何体与固定文本，不阻塞交付。

## [S1] 傻瓜级步骤 Fool-proof Steps

1. **确认执行环境、工作目录与现有改动。**

   用户提供的环境为 Windows Git Bash：`MINGW64_NT-10.0-19043 x86_64`。以下命令在 Git Bash 执行，不直接粘贴到 PowerShell。

   ```bash
   cd '/e/About Work since 20251010/Hackathon/EvoMap_Game'
   pwd
   uname -s
   uname -m
   git rev-parse --show-toplevel
   git status --short
   git branch --show-current
   node --version
   npm --version
   bash --version
   rg --version
   ```

   验证：

   - Git 根目录确实为 `EvoMap_Game`。
   - 记录已有改动；不得覆盖、清理或提交用户原有改动。
   - 当前规划会话只有读取权限；实际执行必须在允许写入的会话中进行，不绕过权限限制。
   - Node 使用满足 Vite 要求的版本，推荐现有可用的 Node 22.12+ 或 Node 24。

2. **读取真实资料，消除未核实的仓库假设。**

   ```bash
   rg --files --hidden \
     -g 'AGENTS.md' \
     -g '*GDD*' \
     -g '*README*' \
     -g '*TRIPO*' \
     -g '*white_corridor*' \
     -g '*ask_astra*' \
     -g 'package.json' \
     -g '*lock*' \
     -g '*schema*' \
     -g '.astra/**' \
     -g '!.git/**' \
     -g '!node_modules/**' \
     -g '!**/node_modules/**' \
     .
   ```

   ```bash
   node --input-type=module <<'NODE'
   import fs from 'node:fs';
   const path = 'game/data/cases/white_corridor.json';
   const raw = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
   const data = JSON.parse(raw);
   for (const key of ['agent_contract', 'fallbacks', 'cards']) {
     if (!(key in data)) throw new Error(`Missing required field: ${key}`);
     console.log(JSON.stringify({key, value: data[key]}, null, 2));
   }
   NODE
   ```

   ```bash
   rg -n --hidden \
     -g '!.git/**' \
     -g '!**/node_modules/**' \
     -g '!**/dist/**' \
     'forbidden_actions|white_corridor|agent_contract|最优人生|最優人生|47|10/5|v1\.2' \
     .
   ```

   执行者逐项读取 [S3] 中的资料，并新建 `.astra/REPO_NOTES.md`，记录：

   - GDD v1.2 的实际路径与章节位置。
   - 旧案例三个核心字段的实际类型、子字段与引用方式。
   - 每个 `forbidden_actions` 的 JSON Pointer。
   - 现有网页项目、启动命令、检查入口与依赖管理方式。
   - 已存在的模型、图片、声音及其来源。
   - 旧契约是否与禁词要求冲突。

   **必须停止的情况**：旧案例不存在、必需契约字段不存在、必须原样保留的字段含禁词且无法同时满足要求。不得编造旧契约，不得删改旧文件来消除冲突。

3. **固定本次实现选择和范围。**

   新建 `.astra/DECISIONS.md`，写入以下决定：

   - 推荐 Vite + Three.js + 原生 DOM，不引入额外 UI 框架。
   - 新案例保留旧结构，通过明确的适配层供网页使用。
   - 开场文字使用“状态记录”，替代任务书中与禁词冲突的用语。
   - 判定只有 `accept / revise / hold`；第四档为 `timeout` 固定回退，其判定仍为 `hold`。
   - 默认不配置远程 provider；可选 provider 通过公开网关地址接入。
   - 私密 key 只存在于网关服务端环境，不进入静态网页。
   - 禁词扫描覆盖本次发布的全部文案、数据及其依赖；历史资料不进入发布包。
   - 名义时长为 355 秒，表态输入不强制倒计时。
   - 不实现任务书明确排除的内容。

   若旧契约与拟定方案存在命名差异，记录具体字段映射；不能只写“兼容旧格式”。

4. **建立不可自动重写的旧文件基线。**

   创建目录：

   ```bash
   mkdir -p .astra/baselines
   mkdir -p .astra/harness
   mkdir -p .astra/reports
   mkdir -p game/web
   ```

   使用 [S5] 的基线模板创建 `.astra/harness/baseline.mjs`，然后执行：

   ```bash
   node .astra/harness/baseline.mjs
   ```

   验证：

   - 基线记录旧案例原始字节的 SHA-256。
   - 保存所有 `forbidden_actions` 的路径和值。
   - 再次执行只校验基线，不更新基线。
   - 后续 harness 不得自动生成或刷新基线。

5. **建立网页入口、依赖和检查入口。**

   如果 `game/web/package.json` 已存在，保留原有配置并合并 [S5] 中的 scripts；出现同名不同义脚本时，在 `.astra/REPO_NOTES.md` 记录实际处理方式。

   如果该目录尚不存在项目，创建 [S5] 中的最小 package 文件，再执行：

   ```bash
   npm --prefix game/web install --save-exact three
   npm --prefix game/web install --save-dev --save-exact vite @playwright/test ajv
   node game/web/node_modules/@playwright/test/cli.js install chromium
   npm --prefix game/web ls --depth=0
   ```

   新增：

   - `game/web/index.html`
   - `game/web/vite.config.mjs`
   - `game/web/scripts/start.mjs`
   - `game/web/src/main.js`
   - `game/web/src/styles.css`
   - `.astra/harness/check.mjs`
   - `.astra/harness/check.sh`

   创建根目录 `ask_astra.sh` 的 `check` 分支；如果已有该文件，只接入检查分支，保留原有其他功能。

   验证命令：

   ```bash
   npm --prefix game/web run build
   npm --prefix game/web start
   ```

   第二条命令应构建并启动网页，终端明确显示本地 URL。首次安装依赖与每次启动分开说明；启动命令不得偷偷安装依赖。

6. **完成新案例数据与独立数据检查。**

   新建：

   - `game/data/cases/case_001_optimal_life.json`
   - `game/web/src/data/normalize-case.js`
   - `.astra/harness/contract-map.json`
   - `.astra/harness/checks/data.mjs`

   具体要求：

   - `agent_contract / fallbacks / cards` 保持读取到的实际结构。
   - `forbidden_actions` 保持原路径、原值及数组顺序。
   - 新增节拍、污染事件、47 条修改记录、Ghost 台词与反馈模板。
   - `contract-map.json` 明确原始 JSON 到网页规范视图的字段路径，供独立检查使用。
   - 不把旧案例复制进网页发布资源。

   ```bash
   node .astra/harness/check.mjs --only H05_CASE_CONTRACT
   node .astra/harness/check.mjs --only H07_COPY_LINT
   node .astra/harness/check.mjs --only H08_BEAT_BUDGET
   ```

   修复失败项后重跑对应检查；此时不要求尚未实现的浏览器检查通过。

7. **完成正式流程和 DOM 演出。**

   新增：

   - `src/game/machine.js`：转场规则与前置条件。
   - `src/game/clock.js`：游戏计时、暂停、测试推进。
   - `src/game/input.js`：键盘与测试共用输入入口。
   - `src/ui/story.js`：开场、饭桌、揭示、污染和结尾。
   - `src/ui/statement.js`：60 字输入、证据选择与反馈。
   - `src/game/events.js`：实际发生的事件记录。

   实现严格顺序：

   ```text
   life_slice
   → garden
   → collector
   → dinner
   → pollution
   → statement
   → epilogue
   → closed
   ```

   饭桌三循环作为 `dinner` 内部进度，不能只重复显示同一张图。污染阶段按数据时间轴改变真实 DOM；按钮被删除或禁用后，键盘和鼠标都不得继续触发旧选项。

   验证命令：

   ```bash
   node .astra/harness/check.mjs --only H03_ORDERED_FLOW
   node .astra/harness/check.mjs --only H08_BEAT_BUDGET
   ```

8. **完成花园与赞许收集者的可玩部分。**

   新增：

   - `src/scenes/garden.js`
   - `src/scenes/collector.js`
   - `src/render/renderer.js`
   - `src/audio/audio.js`
   - `src/assets/manifest.js`

   明确最小玩法：

   - 花园采用固定镜头、自动向前、左右移动和跳跃，包含至少三个实际空间障碍与安全检查点。
   - 掌声终端在抵达时触发，掌声和笑容延迟 500ms。
   - 掉落返回当前检查点，不重播整章。
   - 收集者只有一个；三轮祝福弹幕各有可读预告与安全区。
   - 防御值按完成弹幕阶段下降，而非按攻击或击杀下降。
   - 防御归零后必须完成接近并交互，才触发转化及记忆入口。
   - 受击只影响短暂移动和局部恢复，不封锁故事。
   - 模型缺失时显示事先创建的几何体，不让加载异常成为流程门槛。

   ```bash
   node .astra/harness/check.mjs --only H02_NORMAL_INPUT
   node .astra/harness/check.mjs --only H03_ORDERED_FLOW
   node .astra/harness/check.mjs --only H14_RENDER_BUDGET
   ```

9. **完成 provider、输出校验与全部回退。**

   新增：

   - `src/agent/provider.js`
   - `src/agent/validate-response.js`
   - `src/agent/feedback.js`

   使用 [S4] 的接口与 [S5] 的超时模板。默认固定回退；配置网关时才发请求。所有失败原因都映射到 JSON 内的固定回退。

   ```bash
   node .astra/harness/check.mjs --only H06_EVIDENCE_BOUNDARY
   node .astra/harness/check.mjs --only H09_NO_KEY
   node .astra/harness/check.mjs --only H10_PROVIDER_TIMEOUT
   node .astra/harness/check.mjs --only H11_PROVIDER_INVALID
   node .astra/harness/check.mjs --only H12_OFFLINE
   node .astra/harness/check.mjs --only H16_SECRET_BOUNDARY
   ```

10. **补齐 README、人工走查表与完整自动检查。**

    新建 `game/web/README.md` 和根目录 `DEMO_CHECKLIST.md`。后者按五幕组织，覆盖七个实际节拍，使用 [S5] 的清单模板。

    ```bash
    npm --prefix game/web ci
    bash .astra/harness/check.sh
    bash ./ask_astra.sh check
    git diff --check
    git status --short
    ```

    验证报告必须包含实际测量值、失败原因和相应截图或事件记录。不得通过删除检查、提高阈值、过滤错误或改写基线取得 PASS。

11. **完成人工游玩与最终复验。**

    ```bash
    npm --prefix game/web start
    ```

    使用正常页面、不启用测试钩子，从开始玩到结尾。记录操作系统、浏览器、设备、实际耗时、问题与处理结果。

    人工检查造成代码或数据变化后：

    ```bash
    bash ./ask_astra.sh check
    ```

    未做的人工检查不得预先勾选；“清单存在”与“体验已经检查”必须分别记录。

12. **按截止时间冻结提交内容。**

    建议安排：

    | 时间 | 必须完成的内容 |
    |---|---|
    | 10/1 | 仓库核对、数据契约、网页入口、检查入口 |
    | 10/2 | 花园、收集者及可达的完整流程 |
    | 10/3 | 饭桌揭示、污染、表态、全部回退 |
    | 10/4 | 自动检查、性能调整、人工走查 |
    | 10/5 18:00 前 | 最终构建与完整复验 |
    | 10/5 20:00 前 | 按实际提交渠道交付 |

    发布目录为 `game/web/dist/`，必须能在静态 HTTP 服务及子路径下运行。

    任务书未提供托管平台或提交地址。执行者应检查仓库已有发布配置；没有实际目标时，交付可发布文件并明确记录“线上地址尚未验证”，不得编造链接或声称已经上线。

## [S2] 工具预调清单 Tool Preflight

以下命令从仓库根目录执行。未配置 LLM、Tripo 或托管账号不影响默认 Demo 和本地自动检查。

| 工具或条件 | 精确检查命令 | 合格条件 |
|---|---|---|
| Git Bash / OS | `uname -s`、`uname -m`、`bash --version` | 与实际执行平台一致；脚本不要求 Bash 4 |
| Git | `git --version`、`git rev-parse --show-toplevel`、`git status --short` | 可读取仓库及现有改动 |
| 搜索工具 | `rg --version` | 可用 |
| Node | `node --version`、`node -p "process.platform + ' ' + process.arch"` | Vite 支持的版本；Windows 原生 Node 通常显示 `win32 x64` |
| npm | `npm --version`、`npm ping` | 能解析并安装公开依赖 |
| 依赖引擎 | `npm view vite version engines --json`、`npm view @playwright/test version engines --json`、`npm view three version --json` | Node 满足实际解析版本要求 |
| 本地依赖 | `npm --prefix game/web ls --depth=0` | 无缺失或无效依赖 |
| Playwright | `node game/web/node_modules/@playwright/test/cli.js --version` | 与锁文件一致 |
| Chromium | `node game/web/node_modules/@playwright/test/cli.js install --list` | Chromium 已安装；真正能否启动由 H00 检查 |
| 旧案例 | `node -e "JSON.parse(require('node:fs').readFileSync('game/data/cases/white_corridor.json','utf8').replace(/^\uFEFF/,''))"` | 正常退出 |
| 检查入口 | `bash -n .astra/harness/check.sh`、`bash -n ask_astra.sh` | shell 语法正确 |
| 构建入口 | `npm --prefix game/web run build` | 正常退出 |
| 可选网关配置 | `node -e "console.log(process.env.VITE_GHOST_PROVIDER_URL ? 'gateway configured' : 'fixed fallback')"` | 只输出配置状态，不输出密钥 |
| 最终入口 | `bash ./ask_astra.sh check` | 满足 [S7] 的全部条件 |

补充：

- 安装公开 npm 包不需要 `npm login`。
- 本计划不调用模型规划 CLI，因此不要求额外模型登录。
- Tripo 未就绪时使用几何体，无须为了检查而登录。
- 真实网关的认证仅在服务端检查；不打印环境变量全集。
- Vite 当前官方要求 Node 20.19+ 或 22.12+；执行时仍须核对实际锁定版本的 `engines`。[Vite 环境要求](https://vite.dev/guide/)

## [S3] 知识库检索清单 Knowledge Retrieval

| 必须读取的资料 | 路径或定位方式 | 重点 |
|---|---|---|
| 项目约束 | 用户提供的 AGENTS 指令；仓库及相关子目录中发现的 `AGENTS.md` | 禁止覆盖范围、既有命令、分工要求 |
| 旧案例 | `game/data/cases/white_corridor.json` | 三个核心结构、判定格式、卡片 ID、全部 `forbidden_actions` |
| 数据使用方 | 对 `white_corridor`、`agent_contract`、`fallbacks`、`cards` 的搜索结果 | 是否已有解析器、验证器或共享契约 |
| GDD v1.2 | 用 [S1] 的文件和内容搜索定位，记录真实路径 | 第一章、10/5 裁剪线、人物关系、47 次修改、Ghost 语气 |
| 模型提示词 | `Ghost Inside_Godot Project/TRIPO_ASSET_PROMPTS.md` | 形象、材质、风格、资源优先级；不做 Godot 移植 |
| 现有网页项目 | `game/web/`；若不存在，记录不存在 | 是否已有可复用入口、样式、控制器 |
| 依赖与构建 | 根目录及 `game/web/` 的 `package.json`、锁文件、构建配置 | 避免制造第二套冲突的依赖管理 |
| 检查体系 | `.astra/`、发现的 `ask_astra.sh`、已有 CI 文件 | 检查发现规则、退出码、报告格式 |
| 现有资源 | 搜索发现的模型、音频、贴图及资源说明 | 是否能公开发布，是否需要压缩或降级 |
| 发布方式 | 根 README、已有静态站配置与工作流 | 实际公开 URL、子路径、提交渠道 |
| Vite 文档 | [环境变量](https://vite.dev/guide/env-and-mode) | 前端变量会进入公开产物 |
| Three.js 文档 | [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) | WebGL2、实际渲染统计与资源释放 |
| Playwright 文档 | [页面 API](https://playwright.dev/docs/api/class-page) | 键盘、异常捕获、请求拦截和页面测量 |

GDD 若仅提供二进制文档，必须通过可用的文档读取方式取得正文。只找到文件名不算完成阅读；不得用旧版本或文件名推断 v1.2 的具体内容。

## [S4] 技术细节 Technical Details

**实现选择**

| 选项 | 优点 | 代价 | 决定 |
|---|---|---|---|
| Vite + npm 本地依赖 | 构建和浏览器检查统一；可避免 CDN 依赖 | 需要初次安装依赖 | 推荐 |
| importmap + 本地模块 | 构建步骤少 | 资源路径与离线依赖管理更分散 | 不作为本次默认方案 |
| 固定反馈 + 可选网关 | 无 key 可完整游玩；静态发布简单 | 默认没有在线模型生成 | 推荐 |
| 浏览器直接携带私密 key | 接入表面简单 | key 会公开，无法满足边界 | 不采用 |

Vite 的 `VITE_*` 变量会进入浏览器代码，因此只允许保存公开网关 URL，不能保存 provider 私密 key。[Vite 环境变量说明](https://vite.dev/guide/env-and-mode)

**拟定目录**

```text
game/
  data/cases/
    white_corridor.json                 # 只读
    case_001_optimal_life.json           # 新案例
  web/
    package.json
    package-lock.json
    vite.config.mjs
    index.html
    README.md
    .env.example
    scripts/start.mjs
    src/
      main.js
      styles.css
      data/normalize-case.js
      game/{machine,clock,input,events}.js
      scenes/{garden,collector}.js
      render/renderer.js
      ui/{story,statement}.js
      agent/{provider,validate-response,feedback}.js
      audio/audio.js
      assets/manifest.js
    public/assets/
    dist/
.astra/
  REPO_NOTES.md
  DECISIONS.md
  baselines/ghost-mvp.json
  harness/
    baseline.mjs
    check.sh
    check.mjs
    contract-map.json
    checks/
    fixtures/
  reports/
ask_astra.sh
DEMO_CHECKLIST.md
```

**数据契约**

磁盘 JSON 沿用旧案例实际结构；以下为适配后的网页内部视图，不代表旧文件已有这些字段：

```text
CaseView
  id: string
  schemaVersion: string
  contract.forbiddenActions: 原样保留的值
  cards: Card[]
  beats: Beat[]
  reveal.records: EditRecord[47]
  pollution.events: PollutionEvent[]
  feedbackTemplates: 按模板 ID 索引
  fallbacks.accept: Feedback
  fallbacks.revise: Feedback
  fallbacks.hold: Feedback
  fallbacks.timeout: Feedback

Card
  id: 唯一字符串
  text: 发布文案
  unlockEvent: 本地实际事件

Beat
  id: 固定枚举
  budgetSeconds: 有限正数
  exitConditions: 本地条件列表
  dialogue/events: 数据引用

EditRecord
  id: 唯一记录编号
  editorId: "lin_che"
  editorName: "林澈"
  displayBeforeReveal: "redacted"
```

47 条记录必须是真实数据；揭示前遮住修改人，揭示后展示同一批记录的真实修改人。不得只有一个写着“47”的计数器。

反馈模板与回退不能引用无法保证解锁的卡片。表态前必须至少解锁一个固定证据，例如揭示记录卡；所有回退引用均应在每条合法到达路径上可用。

**节拍预算与结束条件**

| 顺序 | ID | 秒数 | 必要内容与结束条件 |
|---|---|---:|---|
| 1 | `life_slice` | 35 | 林远消息、涂白修改人、状态记录；读完开场 |
| 2 | `garden` | 100 | 实际移动与跳跃、检查点、掌声终端、延迟笑容；抵达出口 |
| 3 | `collector` | 70 | 三轮弹幕、防御下降、交互转化；记忆入口暴露 |
| 4 | `dinner` | 65 | 三次座位渐远、声音渐迟、全桌安静、47 条记录揭示 |
| 5 | `pollution` | 35 | C 模糊、C 删除、B 消失、仅 A、系统代选提示 |
| 6 | `statement` | 25 | 名义阅读输入预算；玩家主动提交或保留判断 |
| 7 | `epilogue` | 25 | Ghost 提问、两句指定对白、结案文 |
|  | 合计 | **355** | 落在 `[300,420]` |

预算与运行时演出读取同一份数据。用户停留、失败重试和自由输入可以使实际体验超过预算；不能把配置合格描述为已实测所有玩家均在七分钟内通关。

**状态与计时**

- 只有本地状态机可以转场、解锁卡片或改变怪物状态。
- 每个场景持有可取消的定时任务与事件监听，离开时统一清理。
- 游戏逻辑使用固定步长；限制单次真实帧间隔，避免切换标签页后瞬移。
- 页面失焦暂停玩法计时，恢复后继续。
- provider 使用真实单调时钟计时，不能随游戏暂停无限等待。
- 重复点击提交只产生一次有效请求；离开页面、重新开始或取消请求后，迟到响应不得改变新一局。
- 清除按键状态，避免失焦后角色持续移动。
- 声音在真实用户点击开始后启用；静音状态同样可完成流程。

**表态与 provider**

玩家输入：

```json
{
  "statement": "我想先看看这些修改是怎么发生的。",
  "evidence_ids": ["F03"]
}
```

- 去掉首尾空白后，按 `Array.from(text).length` 计算，范围为 1–60。
- 中文输入法组合输入期间不提交。
- UI 仅允许选择已解锁证据。
- 请求只含当前输入、已解锁证据与允许的反馈模板。
- 不发送尚未揭示的卡片，不向 provider 提供状态修改工具。

为保证红线，MVP 使用受限输出：**provider 选择数据中的反馈模板及证据编号，不直接展示自由生成正文。**

```json
{
  "verdict": "revise",
  "feedback_key": "revise_compare_records",
  "evidence_ids": ["F03"]
}
```

校验条件：

- 必须是普通 JSON 对象，禁止 Markdown 包裹。
- 键集合恰好为 `verdict / feedback_key / evidence_ids`。
- `verdict` 只能为 `accept / revise / hold`。
- 模板存在且与判定匹配。
- 引用非空、不重复，全部存在且已解锁。
- 拒收任何额外字段，包括状态跳转、解锁、修改数据或行动指令。
- 响应大小上限 16 KiB；读取响应体和解析也包含在超时范围内。
- 请求截止时间 8 秒。
- `revise / hold / timeout` 都显示继续入口，不扣血，不要求玩家改口。
- 表态反馈的对话对象只有林澈心象；Ghost 只呈现数据、证据、建议和连接状态。

未配置 provider、网络失败、HTTP 错误、超时、非法 JSON、非法引用均使用 JSON 内固定文本。超时使用 `fallbacks.timeout`；其他失败默认使用 `fallbacks.hold`，原因仅写入检查记录。

**禁词范围**

对以下内容完整扫描：

- 新案例的全部字符串，包括契约与回退。
- 网页源文件中全部发布文案。
- 自有文本资源、模型中的可显示文字、字幕与说明。
- README、DEMO_CHECKLIST。
- 构建后的 HTML、JS、JSON、CSS 和文本资源。

同时检查简繁体，例如任务指定词及其繁体形式。扫描脚本的禁词表使用 Unicode 转义，避免自我命中。

未发布的历史 GDD 与旧案例保持原样，并验证没有被打包或运行时加载。若验收方要求历史资料也全部零命中，则必须解决其与“旧文件不变”的冲突，不能暗中调整扫描范围。

**渲染与平台边界**

- 使用相对资源路径与 `base: './'`，支持静态站子路径。
- 不依赖运行时 CDN、外部字体或未打包脚本。
- 设置合理像素比上限，例如 `Math.min(devicePixelRatio, 1.5)`。
- 使用简单材质、有限灯光、实例化重复物体；默认关闭昂贵后处理。
- 每帧预算：draw calls ≤100、三角形 ≤150000。
- 几何体和关键角色必须实际渲染，不能用空场景通过预算。
- 场景切换释放不再使用的 geometry、material、texture 与监听器。
- WebGL 不可用时显示明确提示；该环境不能记作 3D 验收通过。
- Three.js 当前 `WebGLRenderer` 使用 WebGL2；渲染统计应读取实际 `renderer.info`。多次 render 的帧必须累计后再清零。[Three.js 渲染器文档](https://threejs.org/docs/pages/WebGLRenderer.html)

## [S5] 模具清单 Templates

**A. 初始 package 文件**

仅用于新项目；已有文件必须合并。

```json
{
  "name": "ghost-inside-web",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node scripts/start.mjs",
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1"
  }
}
```

依赖版本由安装命令解析并精确写入 package 与锁文件；提交后使用 `npm ci`，不在检查中重新解析最新版本。

**B. Vite 配置**

文件：`game/web/vite.config.mjs`

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    host: '127.0.0.1',
    strictPort: true
  },
  preview: {
    host: '127.0.0.1',
    strictPort: true
  }
});
```

新案例通过静态 import 引入：

```js
import rawCase from '../../data/cases/case_001_optimal_life.json';
```

上述路径适用于 `game/web/src/main.js`。若在 `src/data/` 内引入，必须按实际层级计算，不复制错误相对路径。

**C. 一条命令启动**

文件：`game/web/scripts/start.mjs`

```js
import { build, preview } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.GHOST_PORT ?? 4173);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid GHOST_PORT');
}

await build({ root });

const server = await preview({
  root,
  preview: {
    host: '127.0.0.1',
    port,
    strictPort: true
  }
});

let closing = false;
function close() {
  if (closing) return;
  closing = true;
  server.httpServer.close(() => process.exit(0));
  server.httpServer.closeAllConnections?.();
}
process.once('SIGINT', close);
process.once('SIGTERM', close);

console.log(JSON.stringify({
  type: 'ghost-ready',
  url: `http://127.0.0.1:${port}/`,
  runId: process.env.GHOST_HARNESS_RUN_ID ?? ''
}));
```

Harness 直接用 `process.execPath` 启动此文件，参数通过数组传递；不拼接 shell 命令，不通过进程名称杀服务。

**D. 旧案例基线**

文件：`.astra/harness/baseline.mjs`

```js
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const source = 'game/data/cases/white_corridor.json';
const target = '.astra/baselines/ghost-mvp.json';
const bytes = fs.readFileSync(source);
const data = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const forbidden = [];

function escapePointer(value) {
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

function walk(value, pointer = '') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const path = `${pointer}/${escapePointer(key)}`;
    if (key === 'forbidden_actions') {
      forbidden.push({ pointer: path, value: child });
    }
    walk(child, path);
  }
}

for (const key of ['agent_contract', 'fallbacks', 'cards']) {
  assert.ok(Object.hasOwn(data, key), `Missing ${key}`);
}
walk(data);
assert.ok(forbidden.length > 0, 'No forbidden_actions found');

const current = { source, sha256, forbidden };

if (fs.existsSync(target)) {
  const baseline = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.deepEqual(current, baseline, 'Baseline mismatch');
} else {
  fs.mkdirSync('.astra/baselines', { recursive: true });
  fs.writeFileSync(target, JSON.stringify(current, null, 2) + '\n', {
    flag: 'wx'
  });
}
```

这份脚本只用于建立或核对基线。正式数据检查直接读取基线，不能调用该脚本以补建缺失基线。

**E. 有截止时间的 provider 包装**

文件：`game/web/src/agent/provider.js`

```js
export async function requestFeedback({
  provider,
  request,
  validate,
  fallbacks,
  timeoutMs = 8000
}) {
  if (!provider) {
    return {
      source: 'unconfigured',
      feedback: structuredClone(fallbacks.hold)
    };
  }

  const controller = new AbortController();
  const timeoutError = new Error('provider_timeout');
  let timeoutId;

  const deadline = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(timeoutError);
      controller.abort(timeoutError);
    }, timeoutMs);
  });

  try {
    const raw = await Promise.race([
      Promise.resolve().then(() =>
        provider.request(request, { signal: controller.signal })
      ),
      deadline
    ]);

    const feedback = validate(raw, request);

    return {
      source: 'provider',
      feedback
    };
  } catch (error) {
    const timedOut =
      error === timeoutError || controller.signal.reason === timeoutError;

    return {
      source: timedOut ? 'timeout' : 'invalid_or_unavailable',
      feedback: structuredClone(
        timedOut ? fallbacks.timeout : fallbacks.hold
      )
    };
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}
```

`provider.request()` 必须在返回前完成 HTTP 状态检查、有限大小的响应体读取和 JSON 解析。UI 还需用局次编号与请求编号阻止迟到结果写入。

**F. 只允许正式输入的调试接口**

```js
const params = new URLSearchParams(location.search);

if (params.get('test') === '1') {
  Object.defineProperty(window, '__game', {
    configurable: false,
    writable: false,
    value: Object.freeze({
      snapshot: () => structuredClone(game.readSnapshot()),
      input: (action, pressed) => input.setAction(action, pressed),
      stepSimulation: ms => game.advanceTestClock(ms),
      submitJudgment: (text, evidenceIds) =>
        statement.submit(text, evidenceIds)
    })
  });
}
```

要求：

- `stepSimulation` 运行正式更新逻辑，每次最多推进 1000ms，并按固定步长拆分。
- 不提供 `setState / advanceTo / unlockAll / finishLevel / setPlayerPosition`。
- `snapshot()` 返回副本，不能修改内部状态。
- 普通页面仍用真实键盘和按钮测试。
- provider 故障通过网络拦截注入，不通过直接调用回退函数伪造成功。

**G. 人工走查表**

文件：`DEMO_CHECKLIST.md`

```markdown
# Ghost Inside Demo 走查

设备：
系统：
浏览器与版本：
测试人：
测试时间：
实际通关耗时：

## 第一幕：生活切片
- [ ] 林远的消息让关系清楚，随后出现不安感。
- [ ] 修改人被遮住，但信息仍可读。
- [ ] 开场不超过 40 秒。

## 第二幕：完美花园与赞许收集者
- [ ] 操作、障碍和安全区容易理解。
- [ ] 连续移动有节奏，不依赖反复失败。
- [ ] 掌声和笑容的延迟可以察觉。
- [ ] 转化收集者的行为能够表达理解。

## 第三幕：饭桌裂缝
- [ ] 三次循环的距离和声音差异逐次增强。
- [ ] 全桌安静时留有呼吸空间。
- [ ] 47 条记录的揭示清楚且不过度解释。

## 第四幕：污染与表态
- [ ] 选项消失带来的失控感来自实际操作。
- [ ] 玩家仍能表达自己的判断。
- [ ] 不同反馈都允许继续，不迫使玩家改口。
- [ ] 台词自然，人物说话方式一致。

## 第五幕：我不知道
- [ ] 三句核心对白顺序明确。
- [ ] 结尾克制，不制造胜利式收束。
- [ ] 玩家能留下自己的理解，而非被告知答案。

## 整体
- [ ] 心流与共鸣
- [ ] 演出节奏
- [ ] 音画配合
- [ ] 掌声延迟
- [ ] 静音呼吸
- [ ] 台词的人味
- [ ] 全程静音也可完成
- [ ] 未发现需要修复后重测的问题

问题及修复记录：
```

## [S6] 自检 Harness Self-check Harness

正式入口为：

```bash
bash ./ask_astra.sh check
```

检查只能依据本次运行结果。脚本缺失、浏览器无法启动、测试被跳过、读取旧报告、断言数量为零，都必须失败。

**可直接保存的 Bash 包装**

文件：`.astra/harness/check.sh`。从仓库根目录运行，兼容 Git Bash、Linux 和 macOS，不使用 Bash 4 特性。

```bash harness=smoke
#!/usr/bin/env bash
set -u

fail_gate() {
  printf '%s\n' '[FAIL] H00_HARNESS_GATE'
  exit 1
}

command -v node >/dev/null 2>&1 || fail_gate

[ -f game/web/package.json ] || fail_gate
[ -f game/web/package-lock.json ] || fail_gate
[ -f .astra/harness/check.mjs ] || fail_gate
[ -f .astra/baselines/ghost-mvp.json ] || fail_gate

mkdir -p .astra/reports || fail_gate

log='.astra/reports/harness.stdout.log'
errors='.astra/reports/harness.stderr.log'
status=0

node .astra/harness/check.mjs >"$log" 2>"$errors" || status=$?

cat "$log"

if node --input-type=module - "$log" "$status" <<'NODE'
import fs from 'node:fs';

const expected = [
  'H01_BUILD_HTTP',
  'H02_NORMAL_INPUT',
  'H03_ORDERED_FLOW',
  'H04_CLEAN_SMOKE',
  'H05_CASE_CONTRACT',
  'H06_EVIDENCE_BOUNDARY',
  'H07_COPY_LINT',
  'H08_BEAT_BUDGET',
  'H09_NO_KEY',
  'H10_PROVIDER_TIMEOUT',
  'H11_PROVIDER_INVALID',
  'H12_OFFLINE',
  'H13_INTERACTIVE_TIME',
  'H14_RENDER_BUDGET',
  'H15_DELIVERABLES',
  'H16_SECRET_BOUNDARY'
];

const log = fs.readFileSync(process.argv[2], 'utf8');
const exitCode = Number(process.argv[3]);
const lines = log.split(/\r?\n/).filter(line => line.length > 0);

const valid =
  exitCode === 0 &&
  lines.length === expected.length &&
  !log.includes('[FAIL]') &&
  expected.every(id =>
    lines.filter(line => line === `[PASS] ${id}`).length === 1
  );

process.exit(valid ? 0 : 1);
NODE
then
  printf '%s\n' '[PASS] H00_HARNESS_GATE'
  exit 0
else
  printf '%s\n' '[FAIL] H00_HARNESS_GATE'
  exit 1
fi
```

**根入口模板**

仅用于不存在 `ask_astra.sh` 的情况；已有入口则合并 `check` 分支。

```bash
#!/usr/bin/env bash
set -u

case "${1:-}" in
  check)
    script_root="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)" || exit 1
    cd "$script_root" || exit 1
    exec bash .astra/harness/check.sh
    ;;
  *)
    printf '%s\n' 'Usage: bash ask_astra.sh check' >&2
    exit 2
    ;;
esac
```

**Node runner 必须实现的行为**

`.astra/harness/check.mjs` 支持完整执行和 `--only CHECK_ID`：

1. 从 `game/web/package.json` 创建 `createRequire()`，解析项目安装的 Playwright，避免 `.astra/` 找不到依赖。
2. 使用固定检查清单，不通过“扫描当前目录中恰好存在的测试”决定执行数量。
3. 每项检查只向 stdout 输出一行 `[PASS] CHECK_ID` 或 `[FAIL] CHECK_ID`。
4. 详细异常、截图、浏览器事件及测量值写入 `.astra/reports/`。
5. 任何检查失败则最终退出非零；未知 `--only` 参数也退出非零。
6. 构建与服务通过 [S5] 的真实启动文件运行。
7. 服务器使用固定测试端口，例如 `4179`，启用 `strictPort`；端口占用则失败，不连接旧服务，不杀占用者。
8. 给本次子进程注入随机 `GHOST_HARNESS_RUN_ID`；只有收到匹配的 ready 信息且子进程存活，才能测试 HTTP。
9. 全部检查结束后关闭 browser、context、server；只清理自己启动的进程。
10. 处理 `SIGINT / SIGTERM`；启动超时 60 秒，单项检查有明确截止时间，全套上限 15 分钟。
11. 每次运行覆盖自己的报告，不修改案例、基线或锁文件。
12. 对构建输出目录先确认其解析路径位于 `game/web/` 内且不是指向外部目录的链接，才允许构建工具清理它。

**必须实现的检查内容**

| ID | 实现要求 |
|---|---|
| `H01_BUILD_HTTP` | 实际启动文件完成构建；本次服务器首页返回 200；HTML 含 `data-app="ghost-inside"`；全部必需本地资源返回成功。另用严格静态文件服务挂载到 `/ghost/`，验证构建产物子路径可运行，不能用 SPA 回退掩盖 404。 |
| `H02_NORMAL_INPUT` | 普通页面真实点击开始；真实左右键改变角色位置；空格令角色离地并落地；失焦后按键清空。表态时通过真实 DOM 输入、证据选择与点击完成提交。覆盖空白、60 字、61 字及中文组合输入。 |
| `H03_ORDERED_FLOW` | 通过正式输入与测试时间推进到结尾；实际历史等于七个节拍加 `closed`。验证花园目标、三轮弹幕、转化、三次饭桌循环、47 条揭示、五个污染事件和指定结尾对白。目标未完成不能离开花园；未转化不能进入记忆。 |
| `H04_CLEAN_SMOKE` | 正常完整流程期间 `console.error=0`、`pageerror=0`、必需资源失败数为 0；不覆盖或禁用 console。 |
| `H05_CASE_CONTRACT` | 独立解析新旧 JSON；旧文件 SHA-256 等于基线；每个 `forbidden_actions` 的路径和值完全相等；验证实际旧结构映射、ID 唯一、三种判定与 timeout 回退齐全、47 条记录修改人都是林澈。 |
| `H06_EVIDENCE_BOUNDARY` | 正常反馈引用已解锁证据；未知、未解锁、空、重复 ID 均不能接受。三种合法判定分别通向结尾；反馈前后 provider 不改变卡片、场景或案例数据。尝试修改 snapshot 副本不得影响游戏。 |
| `H07_COPY_LINT` | 按 [S4] 完整扫描所有发布文案及数据；简繁体禁词零命中；报告扫描文件数且大于零。注入到临时测试目录的违规样本文案必须能被同一 lint 检出；不能直接修改真实文件做探针。 |
| `H08_BEAT_BUDGET` | 七个 ID、顺序和数值类型正确；单项满足任务范围，总和在 `[300,420]`。验证运行时引用同一配置、关键演出触发时间与配置一致；表态不因预算到时自动提交。 |
| `H09_NO_KEY` | 没有网关配置时，从正式流程抵达表态；不发 provider 请求；显示 JSON 内固定回退及其证据编号，最终进入 `closed`。 |
| `H10_PROVIDER_TIMEOUT` | provider 请求真实发出后保持不返回；真实 8 秒截止时间触发，留出调度容差但不超过 10 秒；显示与 JSON 完全一致的 timeout 回退并到达结尾。另测响应头到达但响应体不结束。 |
| `H11_PROVIDER_INVALID` | 独立页面分别模拟：非 JSON、错误类型、缺少字段、未知模板、`reject`、无证据、未知证据、未解锁证据、重复证据、额外命令字段、超大响应、HTTP 500。每个样例均采用固定回退并到达结尾。 |
| `H12_OFFLINE` | 一轮阻断所有外部域名确认本地资源完整；另一轮加载后切断网络，在表态处回退并到达结尾。故障白名单只允许本轮明确注入的 provider 网络错误。 |
| `H13_INTERACTIVE_TIME` | 三个全新浏览器上下文，用正常时钟，从导航开始到画面完成首次有效渲染、开始按钮可用且真实点击得到响应；三次最大值 `<5000ms`。不得仅相信页面写出的 `ready=true`。 |
| `H14_RENDER_BUDGET` | 在花园与收集者实际最繁忙片段，各采样至少 120 个真实渲染帧；所有帧 calls ≤100、triangles ≤150000，且均大于 0。验证关键对象存在、DPR 上限和资源数量；采样期间不加速时钟。 |
| `H15_DELIVERABLES` | 网页源码、新案例、锁文件、README、DEMO_CHECKLIST、harness、入口均存在；README 含精确安装/启动/检查命令和环境变量作用域；清单包含五幕及六类人工体验项。 |
| `H16_SECRET_BOUNDARY` | 使用专用假 key 构建；扫描 dist 与浏览器请求确认假 key 未出现；前端没有 `VITE_*KEY` 配置或向 provider 官方端点直连；无私密 key 时仍完整运行。 |

**防止检查空转**

- 浏览器路线辅助函数只能组合移动、跳跃、交互、等待与提交；不能直接写内部状态。
- 每个故障样例新建 context，从真实前置条件到达表态点。
- 反馈文本与 JSON 对应值做精确比较，不只检查“有文字”。
- 数据检查不能只调用应用自己的 `validate()` 后相信结果；使用原始 JSON、基线及明确字段映射独立断言。
- 代码中的性能上限常量不能充当测量值。
- 截图用于辅助定位问题，不代替状态、资源或输入断言。
- 构建失败之后的依赖检查必须标记失败，不读取上一次成功构建取得 PASS。
- H10 使用真实计时；H13、H14 不使用 Playwright 时钟模拟。
- 本轮未实际运行这些检查，不能预写 PASS 报告。

## [S7] 成功标准 Success Criteria

每条标准与一个 harness 检查一一对应。

| 检查 | 机器判定成功条件 |
|---|---|
| `H00_HARNESS_GATE` | 根目录、依赖及 Chromium 可用；完整 runner 退出 0；H01–H16 各有且只有一条 PASS；无 FAIL、遗漏或重复项 |
| `H01_BUILD_HTTP` | 本次构建成功；本次服务首页 200；必需资源成功；子路径运行成功 |
| `H02_NORMAL_INPUT` | 真实开始、移动、跳跃、落地和表态提交有效；字数与组合输入边界符合要求 |
| `H03_ORDERED_FLOW` | 正式条件下完整按序到达 `closed`；全部内容事件存在；提前转场被阻止 |
| `H04_CLEAN_SMOKE` | 正常完整运行的 console error、page error、必需资源失败数全部为 0 |
| `H05_CASE_CONTRACT` | JSON、旧结构继承、旧文件哈希、禁止动作、四种回退与 47 条记录检查全部通过 |
| `H06_EVIDENCE_BOUNDARY` | 只接受有效已解锁引用；三个合法判定均可结束；provider 与快照不能修改世界数据 |
| `H07_COPY_LINT` | 发布范围内禁词零命中，扫描数大于零，违规探针能检出 |
| `H08_BEAT_BUDGET` | 七个有效预算满足单项范围，总和 `[300,420]`，运行时使用同一配置且不强制表态 |
| `H09_NO_KEY` | 无配置、无请求、固定回退精确匹配并进入 `closed` |
| `H10_PROVIDER_TIMEOUT` | 两种超时均在规定时间内结束等待，固定 timeout 文本匹配并进入 `closed` |
| `H11_PROVIDER_INVALID` | 指定的每种非法响应均回退并进入 `closed`，无遗漏样例 |
| `H12_OFFLINE` | 无外部资源依赖；断网后的表态仍可完成至 `closed` |
| `H13_INTERACTIVE_TIME` | 三次冷启动的最大可交互时间 `<5000ms` |
| `H14_RENDER_BUDGET` | 两个实际 3D 阶段各 ≥120 帧，逐帧满足非空与 draw call/面数预算 |
| `H15_DELIVERABLES` | 所有交付文件与必需说明、人工检查项目齐全 |
| `H16_SECRET_BOUNDARY` | 假 key 未进入产物或浏览器请求；默认运行不依赖私密 key |

自动验收总结果必须同时满足：

```text
退出码 = 0
PASS 行数 = 17
FAIL 行数 = 0
```

人工体验不能用自动 PASS 代替。最终交付还必须有填写完整的 `DEMO_CHECKLIST.md`、实际游玩记录以及未解决问题为零的记录。

H14 是任务允许的性能替代验收；没有中档设备实测时，只能报告“渲染预算通过”，不能报告“已验证 30fps”。

## [S8] 风险与回滚 Risks & Rollback

| 风险 | 处理方式 | 具体回滚 |
|---|---|---|
| 仓库结构与计划假设不同 | 开工前读取并记录实际字段和入口 | 不修改旧契约；先修正适配映射与本计划中的对应路径 |
| 禁词与必须保留的原文冲突 | 数据阶段直接失败并列出路径 | 不删改原文，不重建基线；这是需要明确裁定的需求冲突 |
| 远程模型不可用或越权输出 | 固定 JSON 回退，8 秒截止时间，受限模板输出 | 清空公开网关配置并重建静态包 |
| 模型未完成、加载失败或超预算 | 已有几何体承担相同交互与碰撞 | 将资源 manifest 的模式切回 `placeholder`，重跑 H03、H14 |
| 子路径发布后资源 404 | 相对路径，并测试 `/ghost/` 挂载 | 恢复上一个已通过检查的静态构建 |
| 演出任务泄漏导致重复转场 | 场景退出统一取消任务；请求绑定局次 | 回退有问题的演出改动，保留状态机前置条件 |
| 只测钩子造成真实操作不可用 | 正常页面真实输入检查 | 不删除 H02；修复正式输入入口后复测 |
| 失焦、重复提交或迟到响应卡住流程 | 暂停规则、单次提交和请求失效处理 | 取消当前请求，使用现有固定回退；不重置玩家证据 |
| 用户已有改动被覆盖 | 开始时记录工作区，不使用整体恢复 | 仅逐块撤回本任务改动 |
| 托管目标缺失 | 查找已有发布配置并记录缺失 | 保留构建与报告，不声称上线成功 |

关闭远程 provider 的可执行回滚：

```bash
VITE_GHOST_PROVIDER_URL= npm --prefix game/web run build
bash ./ask_astra.sh check
```

查看改动范围：

```bash
git status --short
git diff --stat
git diff -- game/web game/data/cases/case_001_optimal_life.json .astra/harness DEMO_CHECKLIST.md ask_astra.sh
git diff -- game/data/cases/white_corridor.json
```

需要撤回尚未提交的修改时，只使用逐块选择，避免丢失用户原有工作：

```bash
git restore -p -- game/web
git restore -p -- game/data/cases/case_001_optimal_life.json
git restore -p -- .astra/harness
git restore -p -- DEMO_CHECKLIST.md ask_astra.sh
```

以上命令仅适用于已跟踪文件；未跟踪文件先审阅清单，不执行批量删除。禁止使用 `git reset --hard`、`git clean -fd` 或按进程名称批量终止服务。

任何回滚后，重新执行：

```bash
bash ./ask_astra.sh check
```

最终交付依据回滚后的当前结果，不沿用旧版本的 PASS。