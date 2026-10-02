# PLAN

## [S1] 傻瓜级步骤 Fool-proof Steps

本计划是对标优化规划的**已核实版本**：S1 六步已全部在本机执行完毕，与 benchmark 规划（`.astra/benchmark/PLAN.md`）的差异在于——所有证据均已实际读取源码与文档后登记，状态从 `blocked` 升级为 `ready`。

1. 确认仓库、系统与工具：仓库根 `E:\About Work since 20251010\Hackathon\EvoMap_Game`，MINGW64（Git Bash），基准提交 `590d8bd`，工作区在快照时点干净。
2. 完整读取规则、源码、案例与检查脚本：31 个基准文件全部通读并登记阅读证据（`contract.json.readEvidence`，含 SHA-256 指纹与原文定位）。已确认七节拍真实顺序（`machine.js` `ORDER`）、表态三档+timeout 回退（`provider.js`/`feedback.js`）、收集者三轮弹幕与防御递减、掌声加速隐喻（`garden.js`）、47 条记录揭示（`story.js`）、Ghost 暖化走数据模板（`ghost_lines`/`feedback_templates`）。
3. 建立规划专用目录与快照：`node .astra/optimization/capture-baseline.cjs` 生成 `baseline.json`（31 文件 SHA-256，head=590d8bd），重跑只核对不覆盖。
4. 填写证据清单：`contract.json` 状态 `ready`，登记 31 条阅读证据、16 条决策、3 条红线、17 项旧检查（H00-H16 真实断言锚点+执行命令 `bash .astra/harness/check.sh`）、12 个来源、8 条建议、4×5 覆盖矩阵。
5. 形成独立优化文档：即本文件。
6. 运行规划自检：`bash .astra/harness/check-optimization-plan.sh`，C00-C09 全 PASS 后本规划视为交付通过。**注意：该自检只验收规划交付；P0 实施后源码变更会使 C02 按设计失败，属预期——届时以 17 项旧检查+新增行为检查为准。**

## [S2] 工具预调清单 Tool Preflight

已验证可用：Git Bash（MINGW64_NT-10.0-19043）、git、ripgrep、Node.js（内置 fs/path/crypto/child_process/assert，未新增依赖）、mkdir。项目约束以 `game/web/package.json` 为准（Vite + Three.js + Playwright），未擅自升级。不需要账号、发布权限、模型 API 密钥或云服务。原有 17 项检查依赖 Playwright（`check.mjs` 经 `npx playwright` 驱动 Chromium），已从脚本登记，无需另装。

## [S3] 知识库检索清单 Knowledge Retrieval

本地必读路径全部读取完毕（见 `readEvidence`）。`AGENTS.md` 不存在（rg 全仓扫描无结果），局部约束以 `.astra/DECISIONS.md` 16 条与 MEMORY.md 为准。

公开资料登记于 `contract.json.sources`：

| 来源 | 状态 | 要点 |
|---|---|---|
| R1-R6（EA/TheSixthAxis/GamesBeat） | verified | 磁铁隐喻、基础动作复用、协调行动、Side Stories、辅助检查点、避免久卡与 AI 第二玩家风险 |
| X1 小红书·双人成行核心 | verified（PC 链接已读全文） | 四大主题对应关卡；Book of Love 引导者 NPC；不对称能力、无重复机制 |
| X2 小红书·主创访谈 | verified（PC 链接已读全文） | 8 名关卡设计师结对、pod 单元、架空世界观解放玩法 |
| X3 小红书·双影奇境关卡教科书 | verified（PC 链接已读全文） | 每章玩法不重复；一人跳台一人给信息；「不浪费每一关：每一关都能讲故事」 |
| X4 小红书·Design Rationale（Rukawa 著） | verified（PC 链接已读全文） | 设计四问：意图/为何必须玩家操作/换成对白失去什么/成本 |
| 7 条 xhslink 短链 | unavailable | 短链不可读；其中 4 篇已经 PC 链接取得正文（X1-X4），其余不作为设计依据 |

「安全引入→变奏→组合考试」仍是设计归纳，不是 Hazelight 官方统一方法；P0-01 的三阶段结构采用该归纳并已注明。

## [S4] 技术细节 Technical Details

**四个对标维度与借鉴边界**（同 benchmark 规划，全部经源码核实后修订）：

| 维度 | 可借鉴 | 单人转译 | 必须保留的边界 |
|---|---|---|---|
| 设计哲学 | R1 磁铁表达关系；R2/X2 基础动作稳定、情境规则变化 | 每个增强先写心理命题，再设计可观察动作结果 | 不为新鲜度增加操作；表态/转化/污染跨节拍有效 |
| 场景与重试 | R4 Side Stories；R5 检查点辅助 | 奇观改变理解或行动条件；操作失败只重置局部挑战 | 不把换色算新机制；不撤销叙事后果 |
| 合作转译 | R2 树液/火柴；R3 互补形态；X3 信息分工 | 玩家负责意图与行动，Ghost 提供一项可预测支援 | Ghost 不代表态、不给正确答案、不与记忆人物对话 |
| 叙事与玩法 | R1 玩法与叙事结合；X4 设计四问 | 用操作体验心理矛盾，既有表态承接后果 | 不简化成「剧情服务机制」；不清空污染意义 |

**源码核实结论（修订 benchmark 规划的关键差异）**：

- 花园**已是机制即隐喻**（掌声加速区 `APPLAUSE_SPEED=9.6`），P0-01 的实际增量是**三阶段变奏结构**而非引入隐喻本身。
- 收集者**已有矛盾反馈**（三轮弹幕、防御 [34,33,33] 递减），P0-04 判为 `defer`：该隐喻已被既有实现覆盖，避免重复建设。
- respawn 遥测已有（`hitZ/hitY/jumpDown`），P0-03 的增量是**状态清理与防重复**保证，不是从零做重试。
- Ghost 暖化走数据模板（`ghost_lines`/`feedback_templates`），P0-02 的支援能力限定为操作辅助（固定线索），不触碰表态判定与暖化弧线。

**P0（10/17 前推荐包 = P0-01+P0-02+P0-03，工时上限 28h）**、**P1（演示编排/岔路回廊）**、**P2（赛季切片/覆盖表）**：完整条目、工时、依赖、兼容性与验收契约见 `contract.json.items`（8 条，含 GARDEN_VARIATION / GHOST_AND_GATE / LOCAL_RETRY 三个新增行为检查的验收定义）。

**排期**：10/5 提交版保持现状（本次只新增规划文件）；10/6-10/14 实施窗口 42h（28h 实施+8h 整体检查+6h 修正）；10/14 内容冻结；10/15-16 走查排练；10/17 Demo Day。

**状态与接口约束**：功能实施前从源码提取真实状态名（`ORDER`/`unlock_event`/`defense_start` 等）；四档表态不重新编号；JSON 扩展向后兼容（snake_case，决策 #12）；旧案例继续通过原入口运行（H05 基线锁）。

## [S5] 模具清单 Templates

- 模板 A（基准快照）→ `.astra/optimization/capture-baseline.cjs`，已执行，产物 `baseline.json`（首次写入 `wx` 模式，重跑仅核对）。
- 模板 B（证据与建议清单）→ `.astra/optimization/contract.json`，由 `.astra/optimization/build-contract.cjs` 生成（quote 逐一与文件内容比对，缺失即抛错，不允许伪造锚点）。
- 模板 C（单条建议）→ 已并入 `contract.json.items`，8 条齐全（design/translation/beat/current/delta/hours/dependsOn/compatibility/acceptance/gddAnchors）。

## [S6] 自检 Harness Self-check Harness

自检脚本保存为 `.astra/harness/check-optimization-plan.sh`（内容与 benchmark 规划 S6 一致），验证规划结构（C01 八段标题）、证据覆盖（C03 指纹+锚点）、规则登记（C04 16+3+17）、来源（C05 含 7 条短链）、溯源（C06 兼容性逐条 preserved）、可行性（C07 依赖与预算 28+8+6≤42）、验收（C08 唯一编号+reviewer）、GDD 矩阵（C09 4×5=20 格）。执行 `bash .astra/harness/check-optimization-plan.sh`，退出码 0、十行 [PASS]、无 [FAIL] 为通过。

## [S7] 成功标准 Success Criteria

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

机器只能检查证据记录及其一致性，不能判断「隐喻是否成立」或「玩家是否感到温暖」；这些通过 P0 实施后的人工走查（DEMO_RECALL）完成。

## [S8] 风险与回滚 Risks & Rollback

| 风险 | 处理与回滚 |
|---|---|
| 优化覆盖 MVP 契约或用户改动 | P0 实施单独提交、逐项可撤回；不使用 `git reset --hard`/`git clean -fd` |
| 「无惩罚」消除表态或污染后果 | 只恢复操作暂态；叙事状态沿原规则；失败即撤回该重试扩展 |
| Ghost 变成正确答案提供者 | 支援限于固定线索等操作辅助；不代选、不劝选、不评价表态高低 |
| 机制过多挤压 10/17 稳定性 | 先删 P1-02，再删 P0-04；保留推荐核心包与修正余量 |
| 规划自检在 P0 实施后 C02 失败 | 属设计预期：规划自检只验收规划交付，实施后以 17 项旧检查+新增行为检查为准 |
| 10/5 提交版被破坏 | 本次仅新增 `.astra/optimization/*` 与 `.astra/harness/check-optimization-plan.sh`，`baseline.json` 快照可证明原文件指纹未变 |
