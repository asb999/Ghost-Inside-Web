# PLAN

## [S1] 傻瓜级步骤 Fool-proof Steps

**交付范围：对标分析、优化清单、排期和验收契约。本次不实施游戏功能，不覆盖 MVP 施工契约。**

**证据状态：受阻。** 本次本地只读命令被环境策略拒绝，未能读取源码、16 条决策、GDD 正文及现有检查脚本。因此，下文区分“任务书声明的现状”和“待源码核实的增强候选”，不宣称已经确认功能缺口或通过现有 17 项检查。公开资料已核实；七个小红书链接均未取得正文。

完成标准：必读文件都有可定位证据；每条建议都有具体来源、实际增量、工作量和验收方式；原文件保持不变；S6 全部通过。证据不足时保持 `blocked`，不得进入功能实施。

1. **确认仓库、系统与工具。**

   在 Git Bash 执行：

   ```bash
   cd '/e/About Work since 20251010/Hackathon/EvoMap_Game'
   pwd
   uname -s
   git rev-parse --show-toplevel
   git status --short
   bash --version
   git --version
   rg --version
   node --version
   npm --version
   ```

   验证：仓库根目录正确；Windows 环境输出应与任务提供的 `MINGW64_NT-10.0-19043` 相符。允许已有未提交改动；不得清理、覆盖或将其认作本次改动。

   如果仍出现策略拒绝，停止依赖本地证据的步骤。不得通过更换权限、远程副本或猜测补齐工作区事实。

2. **完整读取规则、源码、案例与检查脚本。**

   ```bash
   rg --files --hidden -g 'AGENTS.md' -g '!node_modules' -g '!.git' .
   rg -n '^' --hidden -g 'AGENTS.md' -g '!node_modules' -g '!.git' .
   rg --files --hidden game/web/src .astra/harness
   rg -n '^' --hidden game/web/src .astra/harness
   rg -n '^' .astra/PLAN.md .astra/DECISIONS.md _gdd_import.md .workbuddy/memory/MEMORY.md
   rg -n '^' game/data/cases/case_001_optimal_life.json game/web/package.json
   rg --files --hidden game/web -g '*lock*' -g '*config*' -g '.nvmrc' -g '.node-version' -g '!node_modules' -g '!dist'
   npm --prefix game/web run
   ```

   搜索结果不能替代通读。输出过长时按文件分批读取，不使用截断结果判定缺口。对每个源码文件记录：负责什么、读取哪些状态、改变哪些状态、与哪个节拍有关。

   验证：明确七节拍的真实进入／退出条件、四档表态的原始值、转化胜利条件、污染写入位置、Ghost 暖化条件、记忆人物交互限制。未找到的内容记录为问题，不自行补定义。

3. **建立规划专用目录与原文件快照。**

   ```bash
   mkdir -p .astra/optimization
   ```

   将 S5 的快照脚本保存为 `.astra/optimization/capture-baseline.cjs`，执行：

   ```bash
   node .astra/optimization/capture-baseline.cjs
   node -e "const b=require('./.astra/optimization/baseline.json'); console.log(b.head); console.log(Object.keys(b.files).length)"
   ```

   验证：快照包含全部 `game/web/src/`、全部原有 `.astra/harness/` 和指定必读文档。快照记录当前工作区内容，包含用户原有未提交修改，不以 `HEAD` 内容替代。

4. **填写证据清单，先决定“已有、增强、延后”。**

   将 S5 的 JSON 模板保存为 `.astra/optimization/contract.json`，据实际阅读填写：

   - `readEvidence`：每个受保护文件的摘要、内容指纹和原文定位。
   - `locks`、`redlines`：16 条决策与三条红线的准确原文，不重述为自己设计的规则。
   - `legacyChecks`：原有 17 个检查标识、所在脚本、完整命令与执行目录。检查项数不等于脚本文件数。
   - `items`：S4 每个候选逐项核实。已经存在的标为 `retain`，不得包装成新增功能。
   - `gdd`：四条张力线、五幕、未来场景与赛道的真实原文位置。

   ```bash
   node -e "JSON.parse(require('fs').readFileSync('.astra/optimization/contract.json','utf8')); console.log('JSON parsed')"
   ```

   验证：如果真实决策或检查数量与任务书不同，记录差异并保持 `blocked`；不得删减记录凑数。

5. **形成独立优化文档。**

   保存为 `.astra/optimization/plan.md`，采用本计划的八段标题。以已核实的证据修订 S4，保留：

   - 四个对标维度及借鉴边界。
   - P0／P1／P2 清单及明确取舍。
   - 每条建议的来源、转译、已有系统证据、实际增量、工时和验收。
   - 10/5 提交版保护方式、10/14 内容冻结、10/15—16 修正与排练安排。
   - 未取得资料及其影响。

   验证：不得出现未经源码确认的函数名、状态字段、已实现功能判断或“现有检查已通过”。

6. **完成内容审阅后运行规划自检。**

   将 S6 完整脚本保存为 `.astra/harness/check-optimization-plan.sh`。人工核对原文引用、重复建设风险和红线兼容性后，填写 `review`，将 `status` 改为 `ready`。

   ```bash
   bash .astra/harness/check-optimization-plan.sh
   git status --short
   git diff -- .astra/PLAN.md .astra/DECISIONS.md game/web/src game/data/cases/case_001_optimal_life.json _gdd_import.md .workbuddy/memory/MEMORY.md
   ```

   验证：自检退出码为 `0`，至少一行 `[PASS]`，没有 `[FAIL]`。原文件是否改变由快照比较判定；已有用户改动导致的 `git diff` 不能直接算作本次破坏。

   本次自检只验收规划交付。未来实施 P0 时，必须实际执行登记的全部旧检查，再增加行为检查，不能将规划自检当作游戏测试通过。

## [S2] 工具预调清单 Tool Preflight

| 工具／条件 | 精确检查命令 | 判定与用途 |
|---|---|---|
| Git Bash／系统 | `command -v bash`；`bash --version`；`uname -s` | Windows 使用 Git Bash；S6 不要求 Bash 4 |
| 仓库定位 | `git rev-parse --show-toplevel`；`git status --short` | 确认目录及已有改动 |
| Git | `command -v git`；`git --version` | 记录基准提交；读取工作区状态 |
| ripgrep | `command -v rg`；`rg --version` | 枚举与完整读取文本文件 |
| Node.js | `command -v node`；`node --version` | 运行仅依赖内置模块的快照及自检 |
| 项目版本约束 | `node -e "const p=require('./game/web/package.json'); console.log(JSON.stringify({engines:p.engines,packageManager:p.packageManager,scripts:p.scripts},null,2))"` | 以仓库规定为准，不擅自升级 |
| npm | `command -v npm`；`npm --version`；`npm --prefix game/web run` | 只列出现有命令，不假定存在 `test` |
| Node 内置能力 | `node -e "for(const x of ['fs','path','crypto','child_process','assert']) require(x)"` | 自检不需要新增包 |
| 基础目录命令 | `command -v mkdir` | 创建独立规划目录 |
| 必读文件可读性 | `node -e "const f=require('fs'); for(const p of ['game/web/src','.astra/harness','.astra/PLAN.md','.astra/DECISIONS.md','_gdd_import.md','.workbuddy/memory/MEMORY.md','game/data/cases/case_001_optimal_life.json']) f.accessSync(p,f.constants.R_OK)"` | 任一失败即不能标记证据齐全 |
| 公共参考资料 | 使用浏览工具打开 S3 的具体页面 | HTTP 成功不等于正文可读；记录实际读取状态 |

本次不需要账号登录、发布权限、模型 API 密钥或云服务。不要执行 `npm login`，也不要为阅读公开资料要求用户登录。

原有检查若依赖浏览器、Python 或其他工具，必须从脚本中提取其真实版本要求与检查命令，登记后再用于后续实施。当前无法核实，不能预设 Playwright、pytest 或某个测试入口已经存在。

## [S3] 知识库检索清单 Knowledge Retrieval

| 必读路径 | 必须查清的内容 |
|---|---|
| 仓库及相关子目录的 `AGENTS.md` | 局部约束、验证要求、文件修改边界 |
| `game/web/src/` 全部源码 | 七节拍执行顺序；输入、状态、场景与 Ghost 的关系；已经存在的变奏、重试和协作 |
| `game/data/cases/case_001_optimal_life.json` | 内容数据结构、角色、文本、选项、结果；数据与源码的对应关系 |
| `.astra/PLAN.md` | MVP 范围、原始施工与验收约定 |
| `.astra/DECISIONS.md` | 16 条决策、三条红线；四档表态、转化、污染、Ghost、记忆人物的准确限制 |
| `.astra/harness/` 全部脚本及其引用文件 | 17 项真实断言、启动条件、命令、产物、副作用；可追加检查的位置 |
| `_gdd_import.md` | 四条张力线、五幕关系；“未来场景与赛道规划”的真实条目 |
| `.workbuddy/memory/MEMORY.md` | 长期决策及已否决方向；识别与当前文档是否有冲突 |
| `game/web/package.json`、实际锁文件、实际配置文件 | Node／包管理器要求、Vite／Three.js 版本、启动和构建命令 |

不为查阅这些本地文件调用外部知识库服务。本任务没有授权同步修改飞书主文档。

公开资料按以下编号引用：

| 来源 | 已核实内容 | 使用边界 |
|---|---|---|
| R1：[EA《It Takes Two》玩法介绍](https://www.ea.com/en/games/it-takes-two/it-takes-two/news/it-takes-two-official-gameplay-trailer) | 雪景球中的磁铁能力对应重新找回吸引力 | 支持“机制表达关系”；不证明本项目花园应采用磁铁 |
| R2：[TheSixthAxis 主创采访](https://www.thesixthaxis.com/2021/03/02/interview-josef-fares-on-it-takes-two-relationship-advice-co-operation-favourite-swear-words/) | 基础移动复用，情境机制变化；树液／火柴对应专门设计的敌人 | 借鉴结构，不照搬武器与敌人 |
| R3：[EA《Split Fiction》玩法介绍](https://www.ea.com/games/split-fiction/split-fiction/features) | 双方协调行动；飞猪与弹簧猪等不同能力形态 | 支持互补能力设计，不证明 AI 协作有效 |
| R4：[EA《Split Fiction》官方发布稿](https://news.ea.com/press-releases/press-releases-details/2025/Leap-Between-Sci-Fi-and-Fantasy-Worlds-in-Split-Fiction-an-All-New-Co-op-Adventure-From-Hazelight-and-EA-Originals/default.aspx) | Side Stories 是由未完成故事草稿解释的简短可选玩法变化 | 支持可选变奏与叙事理由绑定 |
| R5：[EA《Split Fiction》辅助功能说明](https://www.ea.com/able/resources/split-fiction/split-fiction) | 可确认后跳至下一检查点、降低敌伤、随时暂停 | 不据此推断检查点间距或全部存档规则 |
| R6：[GamesBeat 主创采访](https://gamesbeat.com/how-josef-fares-stayed-focused-on-the-co-op-action-adventure-with-split-fiction-interview/) | 避免玩家长时间卡住；AI 第二玩家会增加复杂度并改变真人交流体验 | 玩家 × Ghost 必须作为本项目实验验证 |

七个小红书链接 `9TDVyK2JGmy`、`DpsnqRN9bo`、`9QJIRS0u2xK`、`7dMDmabcj5d`、`7HOPhvthlIK`、`Ap5nKkogoHR`、`2BjnG9fthbJ` 均返回读取错误。不能断言原因是登录限制，也不能引用其未读正文。“不要沉迷速通人生”只能作为用户提供的分析方向，不能归为已核实的原作主张。

“安全引入→变奏→组合考试”在本计划中是**设计归纳**，不是已经核实的 Hazelight 官方统一方法。

## [S4] 技术细节 Technical Details

**现状与判断边界**

任务书声明已有七节拍：

`生活切片 → 完美花园 → 赞许收集者 → 饭桌裂缝 → 正确答案污染 → 表态点 → 我不知道结尾`

这不是本次源码核实结果。花园是否已有多阶段、收集者是否已有第二阶段、Ghost 是否已有必要协作能力，都必须由 S1 的阅读证据决定。

**四个对标维度**

| 维度 | 可借鉴的具体设计 | 单人转译 | 必须保留的边界 |
|---|---|---|---|
| 设计哲学 | R1 磁铁表达吸引力；R2 基础动作稳定、情境规则变化 | 每个增强先写一句心理命题，再设计可观察的动作结果；同一动作经历引入、变奏和组合 | 不为了新鲜度不断增加操作；表态、转化、污染继续跨节拍发挥作用 |
| 场景与重试 | R4 草稿解释 Side Stories；R5 检查点辅助 | 奇观改变玩家理解或行动条件；操作失败只重置局部挑战 | 不把装饰换色算新机制；不把叙事后果当失败惩罚撤销 |
| 合作转译 | R2 树液／火柴；R3 不同角色能力配合 | 玩家负责意图与行动，Ghost 提供一项可预测的支援能力 | Ghost 不替玩家表态，不给“正确答案”，不与记忆人物对话 |
| 叙事与玩法 | R1 明确强调玩法与叙事结合 | 用操作让玩家体验心理矛盾，再让原有表态承接后果 | 不将原作简化成“剧情只服务机制”；不因切换机制清空污染或转化意义 |

R6 明确说明真人合作与 AI 第二玩家并不等价。因此，Ghost 协作只能借鉴互补结构，不能声称其关系效果已被两款原作验证。

**P0：10/17 前的增强候选**

估算单位为一名熟悉当前项目的开发者的有效工时，包含功能对应检查；不含新增大型美术、语音或外部服务。所有条目均须先通过去重核实。

| 编号／候选 | 来源 → 转译 → 对应系统 | 工作量 | 未来验收契约 |
|---|---|---:|---|
| P0-01 花园机制变奏，推荐 | R1 磁铁隐喻、R2 基础动作复用 → 保留花园已有主动作，只改变一个约束或反馈 → 完美花园 | 6—10 小时 | **GARDEN_VARIATION**：三个阶段均能独立重现；第一阶段无操作失败惩罚；第二阶段仅引入一个新条件；第三阶段组合前两阶段条件；完成后仍进入原有下一节拍 |
| P0-02 一个 Ghost 必要协作点，推荐 | R2 树液／火柴、R3 互补形态 → Ghost 暂时固定一处漂移线索，玩家完成已有观察或操作 → 优先嵌入花园现有可交互对象 | 8—12 小时 | **GHOST_AND_GATE**：缺玩家动作不能完成；缺 Ghost 支援不能完成；两者满足只完成一次；取消、离开、重试均解除保持状态；表态状态不被代写 |
| P0-03 新增挑战的局部重试，推荐 | R5 检查点辅助、R6 避免久卡 → 仅重试当前操作挑战 → P0-01／02 所在节拍 | 4—6 小时 | **LOCAL_RETRY**：连续失败 10 次仍可完成；每次重试不重复奖励、不重复追加污染、不倒退已确认表态；Ghost 支援状态清理；恢复操作目标不超过 3 秒 |
| P0-04 收集者第二阶段，候补 | R2 能力与敌人反馈共同设计 → 同一应对动作遭遇互相矛盾的赞许反馈 → 赞许收集者及原转化流程 | 8—12 小时 | **COLLECTOR_VARIATION**：变奏阶段只进入一次；重入无残留；原转化条件仍可获胜；不得新增击杀胜利或增加必须服从赞许的条件 |

说明：

- 三阶段时长、3 秒恢复、10 次重试是本项目提出的目标，不是原作数据。
- P0-02 只有在源码确认存在可复用对象和合适行动时才采用。如果需要新增寻路、通用 AI 调度或大段新场景，移出 P0。
- P0-04 的第二阶段不能成为新的心理“答题门槛”。如果原收集者已表达这一矛盾，标记 `retain`，不再开发。
- 如 P0-01 或 P0-02 已有同等行为，仅补确有必要的反馈或可理解性差异，不再造一个系统。

**排期与取舍**

按环境日期采用 2026 年排期；若项目里程碑另有年份，以仓库记录修正。

| 时间 | 范围 |
|---|---|
| 10/2—10/5 | 阅读、基准记录、对标规划；10/5 提交物保持原状 |
| 10/6—10/14 | 假设可投入 7 个工作日 × 6 小时，共 42 小时 |
| 10/14 | 冻结演示内容 |
| 10/15—10/16 | 修正、整段走查、演示排练；不再引入新机制 |
| 10/17 | Demo Day |

推荐包为 P0-01＋P0-02＋P0-03：上限 28 小时，另留 8 小时整体检查、6 小时修正余量，共 42 小时。

| 选择 | 优点 | 代价／风险 | 建议 |
|---|---|---|---|
| 花园＋Ghost＋重试 | 一段连续体验即可说明机制隐喻、伙伴协作和低阻力重试 | 新增内容数量有限 | **推荐，主题清楚且工期可控** |
| 再加入收集者第二阶段 | 战斗段变化更明显 | 总量超出上述保守预算，挤压修正时间 | 仅在实际节省至少 12 小时后纳入 |
| 优先新建岔路回廊 | 展示内容更丰富 | 场景、节奏与回归主线成本较高 | 放入 P1，不作为 P0 前置条件 |

**P1：Demo Day 差异化**

| 编号 | 来源 → 转译 → 对应系统 | 工作量 | 验收 |
|---|---|---:|---|
| P1-01 Ghost 协作演示编排 | R3 协调行动、R6 真人与 AI 的区别 → 展示“玩家请求—Ghost 支援—玩家完成—后段语气变化” → P0-02 与现有 Ghost 暖化弧线 | 4—6 小时 | 人工 **DEMO_RECALL**：三名未参与开发者观看不超过 90 秒，至少两人能分别说出玩家和 Ghost 做了什么；无人误以为 Ghost 替玩家选择立场 |
| P1-02 岔路回廊的一次可选变奏 | R4 Side Stories → 一个有记忆叙事理由、完成后回归的短变奏 → GDD 中核实存在的岔路回廊或等价场景 | 12—20 小时 | **OPTIONAL_RETURN**：进入、完成、退出、放弃均能回原主线；跳过不改变主线必需条件；进入和返回不重复写入表态或污染 |

P1-01 是**单人操作下的玩家 × Ghost 演示**，不引入第二位真人控制、联网多人或账号。叙事暖化只使用现有许可，不因演示提前变暖。若演示段采用预写响应，应如实说明，不能展示成实时生成的 AI 能力。

P1-02 的场景名和入口尚未核实。如果 GDD 没有对应条目，不能称其已与现有路线衔接。

**P2：赛季路线**

| 编号 | 来源 → 转译 → 对应系统 | 工作量估算 | 验收 |
|---|---|---:|---|
| P2-01 下一场景的主题机制切片 | R1 机制表达关系、R4 故事空间解释变化 → 从 GDD 未来场景中选一个真实条目，给出唯一核心心理命题与完整短流程 → 既有案例数据和节拍系统 | 40—80 小时／首个切片，读取后重估 | **SEASON_SLICE**：每个候选均引用 GDD 原文；具有进入、教学、变化、结束与回归规则；逐项说明如何保留表态／转化／污染 |
| P2-02 四条张力线 × 五幕的机制覆盖表 | R2 稳定基础动作与变化情境、R3 能力互补 → 规划每一格中的玩家动作、Ghost 能力、叙事意义 → GDD 关系架构 | 16—24 小时，规划工作 | **SEASON_MATRIX**：恰有 20 个唯一组合；每格引用真实张力线和幕名，标明已有覆盖、缺口或明确不适用原因 |

P2 不先编造新赛道名称再寻找 GDD 对应关系。当前实现保持 Three.js；后续 Godot 工作仅沿已锁定路线，本次对标规划不额外发起引擎迁移。

**状态与接口约束**

以下是需要记录的语义，不是声称仓库已有这些字段：

| 状态类别 | 重试规则 |
|---|---|
| 本次操作中的位置、暂态物体、Ghost 保持状态 | 恢复至当前挑战起点 |
| 已确认表态、已发生污染、已完成转化 | 遵循原规则，不因操作失败额外增加或撤销 |
| 一次性触发、奖励、场景退出 | 重试与重复输入不得重复提交 |
| Ghost 暖化进度 | 沿原弧线推进，协作次数不自动越级 |
| 记忆人物 | 不新增对话能力、追问入口或 Ghost 代聊 |

功能实施前必须从源码提取真实状态名、枚举值和接口。四档表态不能重新编号；JSON 扩展必须向后兼容；旧案例应继续通过原入口运行。

Windows 路径含空格，命令中始终加引号。脚本保存为 UTF-8、LF，通过 `bash 文件名` 执行。S6 使用 Node 处理内容指纹，避免依赖不同系统上的 `sha256sum` 差异。

## [S5] 模具清单 Templates

**模板 A：基准快照**

保存为 `.astra/optimization/capture-baseline.cjs`。首次写入，重跑只核对，不覆盖旧快照。

```javascript
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const assert = require('assert');

const output = '.astra/optimization/baseline.json';
const addedHarness = '.astra/harness/check-optimization-plan.sh';
const roots = ['game/web/src', '.astra/harness'];
const fixed = [
  '.astra/PLAN.md',
  '.astra/DECISIONS.md',
  '_gdd_import.md',
  '.workbuddy/memory/MEMORY.md',
  'game/data/cases/case_001_optimal_life.json',
  'game/web/package.json'
];

function walk(dir) {
  return fs.readdirSync(dir).sort().reduce((out, name) => {
    const file = path.posix.join(dir, name);
    if (file === addedHarness) return out;
    const stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink(), 'Review symlink before capture: ' + file);
    return out.concat(stat.isDirectory() ? walk(file) : [file]);
  }, []);
}

const paths = Array.from(new Set(fixed.concat(...roots.map(walk)))).sort();
const files = {};
for (const file of paths) {
  files[file] = crypto.createHash('sha256')
    .update(fs.readFileSync(file)).digest('hex');
}

fs.mkdirSync('.astra/optimization', { recursive: true });

if (fs.existsSync(output)) {
  const prior = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.deepStrictEqual(prior.files, files, 'Baseline changed; do not overwrite');
} else {
  const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8'
  }).trim();
  fs.writeFileSync(output, JSON.stringify({
    schemaVersion: 1,
    head,
    files
  }, null, 2) + '\n', { flag: 'wx' });
}
```

**模板 B：证据与建议清单**

保存为 `.astra/optimization/contract.json`。空清单和 `blocked` 是有意保留的失败状态；不能将模板直接标为完成。

```json
{
  "schemaVersion": 1,
  "status": "blocked",
  "readEvidence": [],
  "locks": [],
  "redlines": [],
  "legacyChecks": [],
  "sources": [],
  "items": [],
  "budget": {
    "availableHours": 42,
    "verificationHours": 8,
    "reserveHours": 6
  },
  "gdd": {
    "tensions": [],
    "acts": [],
    "matrix": []
  },
  "review": {
    "reviewer": "",
    "confirmed": false
  }
}
```

各数组使用以下记录结构：

| 字段 | 每条记录结构 |
|---|---|
| `readEvidence` | `{ "path": "...", "sha256": "...", "summary": "...", "quote": "文件中的准确片段" }`；二进制资源使用 `kind: "asset"` 并写资源说明 |
| `locks`、`redlines` | `{ "id": "真实或稳定标识", "path": "...", "quote": "准确原文" }` |
| `legacyChecks` | `{ "id": "...", "anchor": {"path": "...", "quote": "实际断言片段"}, "cwd": ".", "command": ["bash", "实际脚本路径"] }` |
| `sources` | `{ "id": "R1", "game": "It Takes Two", "url": "https://...", "status": "verified", "note": "该页面支持的事实及范围" }`；不可读来源使用 `unavailable` |
| `gdd.tensions`、`gdd.acts` | `{ "id": "...", "path": "_gdd_import.md", "quote": "准确原文" }` |
| `gdd.matrix` | `{ "tensionId": "...", "actId": "...", "coverage": "已有覆盖、候选编号或不适用原因" }` |

**模板 C：单条建议**

复制到 `items`。空白项必须据源码填写，不是可省略字段。

```json
{
  "id": "P0-02",
  "priority": "P0",
  "classification": "enhance",
  "selected": true,
  "sourceIds": ["R2", "R3"],
  "design": "树液与火柴的互补结构；不同形态协调行动",
  "translation": "玩家完成原有动作，Ghost 暂时保持一处线索",
  "beat": "完美花园",
  "current": {
    "path": "",
    "quote": ""
  },
  "delta": "",
  "hours": [8, 12],
  "dependsOn": [],
  "compatibility": [],
  "acceptance": [
    {
      "id": "GHOST_AND_GATE",
      "kind": "machine",
      "setup": "进入经源码确认的协作点，清除当前挑战暂态",
      "action": "分别执行仅玩家、仅Ghost、双方配合、取消后重试",
      "expected": "只有双方配合完成一次；取消清理暂态；不改变表态",
      "command": ""
    }
  ],
  "gddAnchors": []
}
```

补齐规则：

- `classification` 只用 `retain`、`enhance`、`defer`。
- `compatibility` 为每条决策和红线各写一项：`{"id":"...","result":"preserved","reason":"具体原因"}`。
- `machine` 的 `command` 填入计划采用的完整执行命令，明确其属于后续新增检查，不能伪称已经存在。
- `manual` 不要求命令，但必须给出条件、步骤、可观察结果与通过门槛。
- P2 的 `gddAnchors` 必须含 `_gdd_import.md` 的准确引用。
- 已有功能使用 `retain`、`selected:false`，在 `delta` 中说明不新增及保留原因。

## [S6] 自检 Harness Self-check Harness

以下脚本自包含，不安装依赖、不启动游戏、不修改文件；可从仓库根目录在 Git Bash、Linux、macOS 重复运行。当前未取得本地证据，也未执行本脚本，不能报告通过。

它验证规划结构、证据覆盖和原文件完整性。内容指纹及原文定位不能替代对机制语义的人工理解；`review` 仅记录该审阅已发生。

保存为 `.astra/harness/check-optimization-plan.sh`：

```bash harness=optimization-plan
#!/usr/bin/env bash
set -u

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '[FAIL] C00 inputs'
  exit 1
fi

node --input-type=commonjs <<'NODE'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

let failed = false;
let baseline = {};
let contract = {};
let document = '';

function check(name, fn) {
  try {
    fn();
    console.log('[PASS] ' + name);
  } catch (_) {
    failed = true;
    console.log('[FAIL] ' + name);
  }
}
function text(value) {
  return typeof value === 'string' && value.trim().length >= 8;
}
function unique(values) {
  return new Set(values).size === values.length;
}
function hash(file) {
  return crypto.createHash('sha256')
    .update(fs.readFileSync(file)).digest('hex');
}
function walk(dir) {
  return fs.readdirSync(dir).sort().reduce((out, name) => {
    const file = path.posix.join(dir, name);
    const stat = fs.lstatSync(file);
    assert(!stat.isSymbolicLink());
    return out.concat(stat.isDirectory() ? walk(file) : [file]);
  }, []);
}
function anchor(value) {
  assert(value && Object.prototype.hasOwnProperty.call(
    baseline.files, value.path
  ));
  assert(text(value.quote));
  assert(fs.readFileSync(value.path, 'utf8').includes(value.quote));
}
function sameSet(a, b) {
  assert(unique(a));
  assert(unique(b));
  assert.deepStrictEqual(a.slice().sort(), b.slice().sort());
}

const headers = [
  '## [S1] 傻瓜级步骤 Fool-proof Steps',
  '## [S2] 工具预调清单 Tool Preflight',
  '## [S3] 知识库检索清单 Knowledge Retrieval',
  '## [S4] 技术细节 Technical Details',
  '## [S5] 模具清单 Templates',
  '## [S6] 自检 Harness Self-check Harness',
  '## [S7] 成功标准 Success Criteria',
  '## [S8] 风险与回滚 Risks & Rollback'
];
const checkIds = [
  'C00', 'C01', 'C02', 'C03', 'C04',
  'C05', 'C06', 'C07', 'C08', 'C09'
];

check('C00 inputs', () => {
  assert(fs.statSync('game/web/src').isDirectory());
  baseline = JSON.parse(fs.readFileSync(
    '.astra/optimization/baseline.json', 'utf8'
  ));
  contract = JSON.parse(fs.readFileSync(
    '.astra/optimization/contract.json', 'utf8'
  ));
  document = fs.readFileSync('.astra/optimization/plan.md', 'utf8');
  assert.strictEqual(baseline.schemaVersion, 1);
  assert.strictEqual(contract.schemaVersion, 1);
  assert(baseline.files && /^[a-f0-9]{40,64}$/.test(baseline.head));
});

check('C01 layout', () => {
  assert(/^# PLAN\r?\n/.test(document));
  const found = document.split(/\r?\n/).filter(line => /^## /.test(line));
  assert.deepStrictEqual(found, headers);
  const section = document.split(headers[6])[1].split(headers[7])[0];
  const ids = [];
  const pattern = /^\| `(C\d\d)` \|/gm;
  let match;
  while ((match = pattern.exec(section))) ids.push(match[1]);
  assert.deepStrictEqual(ids, checkIds);
});

check('C02 baseline', () => {
  const required = [
    '.astra/PLAN.md', '.astra/DECISIONS.md', '_gdd_import.md',
    '.workbuddy/memory/MEMORY.md',
    'game/data/cases/case_001_optimal_life.json',
    'game/web/package.json'
  ];
  for (const file of required) assert(baseline.files[file]);
  for (const file of Object.keys(baseline.files)) {
    assert.strictEqual(hash(file), baseline.files[file]);
  }
  const actual = walk('game/web/src').concat(walk('.astra/harness'))
    .filter(file => file !== '.astra/harness/check-optimization-plan.sh');
  const recorded = Object.keys(baseline.files).filter(file =>
    file.startsWith('game/web/src/') || file.startsWith('.astra/harness/')
  );
  assert(actual.some(file => file.startsWith('game/web/src/')));
  assert(actual.some(file => file.startsWith('.astra/harness/')));
  sameSet(actual, recorded);
});

check('C03 evidence', () => {
  assert.strictEqual(contract.status, 'ready');
  sameSet(contract.readEvidence.map(row => row.path),
    Object.keys(baseline.files));
  for (const row of contract.readEvidence) {
    assert.strictEqual(row.sha256, baseline.files[row.path]);
    assert(text(row.summary));
    if (row.kind !== 'asset') anchor(row);
  }
});

check('C04 locks_inventory', () => {
  assert.strictEqual(contract.locks.length, 16);
  assert.strictEqual(contract.redlines.length, 3);
  assert.strictEqual(contract.legacyChecks.length, 17);
  const rules = contract.locks.concat(contract.redlines);
  assert(unique(rules.map(row => row.id)));
  rules.forEach(anchor);
  assert(unique(contract.legacyChecks.map(row => row.id)));
  assert(unique(contract.legacyChecks.map(row =>
    row.anchor.path + '\n' + row.anchor.quote
  )));
  for (const row of contract.legacyChecks) {
    anchor(row.anchor);
    assert(row.anchor.path.startsWith('.astra/harness/'));
    assert(Array.isArray(row.command) && row.command.length > 0);
    assert(row.command.every(value =>
      typeof value === 'string' && value.length > 0));
    assert(typeof row.cwd === 'string' && row.cwd.length > 0);
  }
});

check('C05 sources', () => {
  assert(unique(contract.sources.map(row => row.id)));
  for (const row of contract.sources) {
    assert(/^https:\/\//.test(row.url));
    assert(['verified', 'unavailable'].includes(row.status));
    assert(text(row.note));
  }
  for (const game of ['It Takes Two', 'Split Fiction']) {
    assert(contract.sources.some(row =>
      row.game === game && row.status === 'verified'));
  }
  for (const code of [
    '9TDVyK2JGmy', 'DpsnqRN9bo', '9QJIRS0u2xK',
    '7dMDmabcj5d', '7HOPhvthlIK', 'Ap5nKkogoHR', '2BjnG9fthbJ'
  ]) {
    assert(contract.sources.some(row =>
      row.url === 'https://xhslink.cn/o/' + code));
  }
});

check('C06 traceability', () => {
  assert(contract.items.length > 0);
  assert(unique(contract.items.map(row => row.id)));
  const ruleIds = contract.locks.concat(contract.redlines).map(row => row.id);
  for (const row of contract.items) {
    assert(['retain', 'enhance', 'defer'].includes(row.classification));
    for (const key of ['design', 'translation', 'delta']) assert(text(row[key]));
    assert(typeof row.beat === 'string' && row.beat.trim().length > 0);
    anchor(row.current);
    assert(row.sourceIds.length > 0);
    for (const id of row.sourceIds) {
      assert(contract.sources.some(source =>
        source.id === id && source.status === 'verified'));
    }
    sameSet(row.compatibility.map(rule => rule.id), ruleIds);
    for (const rule of row.compatibility) {
      assert.strictEqual(rule.result, 'preserved');
      assert(text(rule.reason));
    }
  }
});

check('C07 feasibility', () => {
  const rank = { P0: 0, P1: 1, P2: 2 };
  const items = new Map(contract.items.map(row => [row.id, row]));
  for (const priority of Object.keys(rank)) {
    assert(contract.items.some(row => row.priority === priority));
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    assert(items.has(id) && !visiting.has(id));
    if (visited.has(id)) return;
    visiting.add(id);
    const row = items.get(id);
    assert(Object.prototype.hasOwnProperty.call(rank, row.priority));
    assert(Array.isArray(row.hours) && row.hours.length === 2);
    assert(row.hours.every(Number.isFinite));
    assert(row.hours[0] >= 0 && row.hours[1] >= row.hours[0]);
    if (row.classification === 'enhance') assert(row.hours[1] > 0);
    assert(typeof row.selected === 'boolean');
    if (row.selected) {
      assert.strictEqual(row.classification, 'enhance');
      assert(row.priority !== 'P2');
    }
    assert(Array.isArray(row.dependsOn));
    for (const dependency of row.dependsOn) {
      assert(items.has(dependency));
      const prior = items.get(dependency);
      assert(rank[prior.priority] <= rank[row.priority]);
      if (row.selected) assert(prior.selected || prior.classification === 'retain');
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of items.keys()) visit(id);
  const budget = contract.budget;
  assert([budget.availableHours, budget.verificationHours, budget.reserveHours]
    .every(Number.isFinite));
  assert(budget.availableHours > 0);
  assert(budget.verificationHours > 0 && budget.reserveHours > 0);
  const upper = contract.items.filter(row => row.selected)
    .reduce((sum, row) => sum + row.hours[1], 0);
  assert(upper + budget.verificationHours + budget.reserveHours
    <= budget.availableHours);
});

check('C08 acceptance', () => {
  const ids = [];
  for (const row of contract.items) {
    assert(row.acceptance.length > 0);
    for (const criterion of row.acceptance) {
      ids.push(criterion.id);
      assert(typeof criterion.id === 'string' && criterion.id.length > 0);
      assert(['machine', 'manual'].includes(criterion.kind));
      for (const key of ['setup', 'action', 'expected']) assert(text(criterion[key]));
      if (criterion.kind === 'machine') assert(text(criterion.command));
    }
  }
  assert(unique(ids));
  assert.strictEqual(contract.review.confirmed, true);
  assert(typeof contract.review.reviewer === 'string');
  assert(contract.review.reviewer.trim().length >= 2);
});

check('C09 gdd', () => {
  const gdd = contract.gdd;
  assert.strictEqual(gdd.tensions.length, 4);
  assert.strictEqual(gdd.acts.length, 5);
  const tensions = gdd.tensions.map(row => row.id);
  const acts = gdd.acts.map(row => row.id);
  assert(unique(tensions) && unique(acts));
  for (const row of gdd.tensions.concat(gdd.acts)) {
    assert.strictEqual(row.path, '_gdd_import.md');
    anchor(row);
  }
  assert.strictEqual(gdd.matrix.length, 20);
  assert(unique(gdd.matrix.map(row => row.tensionId + ':' + row.actId)));
  for (const row of gdd.matrix) {
    assert(tensions.includes(row.tensionId));
    assert(acts.includes(row.actId));
    assert(text(row.coverage));
  }
  for (const row of contract.items.filter(item => item.priority === 'P2')) {
    assert(row.gddAnchors.length > 0);
    for (const reference of row.gddAnchors) {
      assert.strictEqual(reference.path, '_gdd_import.md');
      anchor(reference);
    }
  }
});

process.exitCode = failed ? 1 : 0;
NODE
```

## [S7] 成功标准 Success Criteria

下列标准与 S6 的十项检查一一对应。全部满足才算规划交付通过；不代表后续游戏功能已实施。

| 检查编号 | 机器可判定标准 |
|---|---|
| `C00` | 从仓库根目录运行；基准、契约和文档可读取；JSON 版本及基准提交格式有效 |
| `C01` | 文档以 `# PLAN` 开始；八个二级标题准确且顺序一致；本表检查编号与脚本一致 |
| `C02` | 全部原文件内容指纹不变；源码及旧检查文件清单一致；只允许增加规划自检脚本 |
| `C03` | 状态为 `ready`；每个基准文件均有唯一阅读记录、对应指纹、摘要及有效原文定位或资源说明 |
| `C04` | 16 条决策、三条红线、17 项旧检查全部登记；原文位置有效；检查有完整命令与目录 |
| `C05` | 两款游戏均有已读取来源；每个来源有状态与说明；七个小红书链接均登记 |
| `C06` | 每条建议具备具体设计、转译、已有行为证据、实际增量及有效来源；逐项说明全部决策与红线保持方式 |
| `C07` | P0／P1／P2 齐全；工时有效；依赖无循环、不倒置；选中范围的工时上限加检查与余量不超预算 |
| `C08` | 每条建议有唯一验收编号、起始条件、动作和预期；机器检查有执行命令；人工内容审阅已登记 |
| `C09` | 四条张力线、五幕均有 GDD 引用；20 个组合唯一且完整；每个 P2 条目引用 GDD 原文 |

机器只能检查证据记录及其一致性，不能通过字符串判断“隐喻是否成立”或“玩家是否感到温暖”。这些判断必须通过建议中明确的人工走查完成。

## [S8] 风险与回滚 Risks & Rollback

| 风险 | 处理与回滚 |
|---|---|
| 无法读取工作区，却把候选写成确定缺口 | 保持 `blocked`；保留来源分析；不得填造路径、原文、接口或通过记录 |
| 重复规划已经实现的机制 | 逐项核对源码；已有行为改为 `retain`，释放预算，不重新实现 |
| 优化覆盖 MVP 契约或用户改动 | 只新增规划文件；用工作区快照比较，不用 `HEAD` 强制恢复用户文件 |
| “无惩罚”消除了表态或污染后果 | 只恢复操作暂态；叙事状态沿原规则处理；失败即撤回该重试扩展 |
| Ghost 变成正确答案提供者 | 将能力限定为保持、显现等操作支援；不代选、不劝选、不评价四档表态高低 |
| 机制变化过多，挤压 10/17 稳定性 | 先删 P1-02，再删 P0-04；保留推荐核心包和修正余量 |
| 新协作点依赖复杂 AI、寻路或外部服务 | 移出 P0；保持原流程可完成，不把新增能力接入主线必经条件 |
| 视觉奇观稀释主题 | 每个变化必须改变行动条件或理解；无法说明作用则删除 |
| 三条红线、16 条决策或 17 项检查与实际不符 | 记录差异，停止标记 `ready`；不得修改原清单凑数 |
| P2 与 GDD 只有名称上的对应 | 要求原文引用和四乘五覆盖表；无对应条目则标为新提案，不宣称已衔接 |

本次仅新增规划材料，正常情况下不需要回滚游戏文件。不要使用 `git reset --hard`、`git clean -fd` 或批量恢复命令。

若后续将规划材料单独提交，需要撤回时：

```bash
git status --short
git log --oneline -- .astra/optimization .astra/harness/check-optimization-plan.sh
```

从上面的记录中选择仅包含本次规划材料的提交，输入其实际编号并审查：

```bash
IFS= read -r planning_commit
git show --stat "$planning_commit"
git show --name-only --format= "$planning_commit"
```

确认该提交不包含用户原有修改或游戏功能后，且工作区适合执行回退时：

```bash
git revert --no-edit "$planning_commit"
git status --short
```

未来功能增强也应单独提交，按实际增强提交逐项撤回，保留 10/5 提交版及原检查。当前读取障碍来自环境执行策略；本次未修改仓库，也未取得任何本地测试通过结果。
