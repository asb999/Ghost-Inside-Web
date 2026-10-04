You are the PLANNER for a coding task. Compile a fool-proof execution plan.
Explore the repository READ-ONLY. Do not modify files and do not implement the task.

Output raw Markdown only, starting with `# PLAN`. Include exactly these eight section headers verbatim:

## [S1] 傻瓜级步骤 Fool-proof Steps
## [S2] 工具预调清单 Tool Preflight
## [S3] 知识库检索清单 Knowledge Retrieval
## [S4] 技术细节 Technical Details
## [S5] 模具清单 Templates
## [S6] 自检 Harness Self-check Harness
## [S7] 成功标准 Success Criteria
## [S8] 风险与回滚 Risks & Rollback

Requirements:
- S1 must be numbered and give copy-paste-level steps and exact commands, with verification after each meaningful step.
- S2 must list exact preflight commands.
- S3 must list the exact repository files that must be read before editing and what to inspect.
- S4 must specify APIs, state, event schemas, timing, edge cases, and Windows constraints grounded in this repository.
- S5 must provide ready-to-reuse templates instead of vague prose.
- S6 must include at least one runnable bash code block using an info string such as `bash harness=gameplay`. It must be idempotent, run from the repository root, and print exactly `[PASS] <check>` or `[FAIL] <check>` for each check. PASS requires exit code 0, at least one PASS line, and no FAIL line.
- S7 must map machine-judgeable criteria 1:1 to harness checks.
- S8 must provide concrete risks and scoped rollback commands, without destructive Git operations.

Working directory: E:\About Work since 20251010\Hackathon\EvoMap_Game
OS: Windows PowerShell. The existing product is Vite + Three.js under game/web and the existing Playwright harness is under .astra/harness.

Task specification follows:

# Ghost Inside 3D 切片 Demo：可玩性与视觉打磨

在现有 `game/web` Three.js 3D Demo 上完成一轮有限工时、高收益优化，把当前约 6 分钟流程压缩成 4–5 分钟的展示型垂直切片。重点让玩家操作真实影响进程，并接入 `New Assets_20261004_01.png` 中可用的场景视觉。

范围与约束：
- 保留生活切片、完美花园、赞许收集者、饭桌裂缝、正确答案污染、表态点、尾声、结案。
- 不新增岔路回廊、清理幕、BOSS、第二章；不做复杂模型、存档、账号、移动端、真实 LLM 网关。
- 展示型 Demo 优先，连续失败应有 Ghost 辅助；只用 left/right/jump/interact 完整通关。
- 花园加速 9.6 降到约 8.6，放宽弹幕墙窗口。
- 收集者三轮压两轮，修正空间中心；零输入不能自动通关；每轮靠真实躲避或安全区行动降防；受击有可观察后果；防御归零后靠近按 E 转化。
- 污染五事件顺序保留，但加入 E 抵抗窗口和最后主动撕开表态入口；至少一次正式抵抗后才能进表态；总长 12–18 秒。
- 裁切合成图中 1a/1b/1c/1d/1e/3a 六个场景，作为远景或过场。不得从棋盘格角色区域抠图。新图至少在竞技场、污染、尾声实际出现。
- 视觉节奏：冷蓝→暗红→暖黄→褪色→落雪白。素材失败仍有纯色回退。
- 保留 47 条揭示、证据边界、离线/超时/非法响应回退与秘密边界；`white_corridor.json` 不修改。
- 更新现有检查以适配两轮战斗和污染输入，最终机器自检退出码 0、至少一条 PASS、无 FAIL。
