# REPO_NOTES（S1-2 执行记录，2026-10-01）

## 环境
- Windows Git Bash（MINGW64_NT-10.0-19043 x86_64）；Node v24.19.0；npm 11.17.0；ripgrep 15.1.0
- 原非 git 仓库 → 已 `git init -b main`，白名单 .gitignore（只跟踪 md/游戏数据/.astra/.workbuddy，排除 2.2G Godot 工程、zip、node_modules、dist、reports），基线提交 e34591c

## GDD v1.2 实际路径与章节
- 飞书主文档：`MVADdlbHZo1Hz7xqmwMcx9Ohnyf`（rev 16）；本地导入源：`_gdd_import.md`；阅读版：`GHOST_INSIDE_优化版GDD_3D方向_v1.md`
- 章节锚点：模块一执行摘要（红线在末尾）→ 模块二叙事结构（痛点组合 / 四条张力线 / 关系架构 / 五幕节拍表 / 反转清单 / 台词锚点）→ 模块三角色（3.1 人物表 / 3.2 怪物三层+转化+三重压力源）→ 模块四内容拆解（6 区 / 潜行 / UI 叙事 / Tripo 策略 / 美术方向）→ 模块五整合指南（5.1–5.6，含 5.3 真话算错 / 5.4 表态点四档+可控性）→ 模块六目标拆解（10/5 裁剪线 8 项 / 阶段二）

## 旧案例 `game/data/cases/white_corridor.json`（UTF-8 无 BOM，JSON 对象）
- `agent_contract`：object；`allowed_results: string[3]`（accept/revise/hold）、`max_submissions: number 2`、`max_free_text_chars: number 60`、`required_card_types: string[3]`、`must_cite_unlocked_evidence: boolean true`、`forbidden_actions: string[5]`
- `fallbacks`：object；`accept / revise / hold` 三键，各含 `evidence_ids: string[]`、`response: string`、`world_state: string`、`memory_write: string`
- `cards`：object；`facts / feelings / boundaries` 三数组，各 3 项（F01–F03 / E01–E03 / B01–B03），每项 `{id, title, text}`
- 其余字段：`client`（name/age/identity/request/core_belief）、`map_objects`（O01–O03）、`memory`（M01 三段，含 evidence_id 引用）、`ending`
- 卡片引用方式：`memory.segments[].evidence_id` 与 `fallbacks.*.evidence_ids` 直接写卡 ID 字符串
- **`forbidden_actions` JSON Pointer**：`/agent_contract/forbidden_actions`（数组本身），元素 `/0`–`/4`；第 `/4` 项「输出诊断或治疗承诺」含禁词「诊断」「治疗」→ 见 DECISIONS 第 7 条的范围裁定
- 旧文件 SHA-256 由 `.astra/harness/baseline.mjs` 记录（S1-4），基线落 `.astra/baselines/ghost-mvp.json`

## 现有网页项目
- **不存在** `game/web/`（S1-5 全新建）；根目录无 package.json / 构建配置；无 CI 文件
- 旧 `game/` 下仅 `data/cases/white_corridor.json`

## 现有资源
- `Ghost Inside_Godot Project/TRIPO_ASSET_PROMPTS.md`：统一风格尾句可复用；七件道具 + 六间房概念图为旧 2.5D 六场景版，**与新五幕（完美花园/饭桌/岔路回廊）不匹配**，仅风格基座复用；角色提示词有 case001_map_actors / therapist_walk_4dir / white_corridor_map
- 无音频资源；无已生成模型文件；`Visuals/`（13M）为 2D 视觉参考；`Assets/`（189M）未纳入本任务
- Tripo 未登录、无 API key → MVP 用几何体占位（DECISIONS 第 10 条）

## AGENTS 约定
- 仅 `godot-mcp-pro/instructions/AGENTS.md`（工具自带说明，非项目级用户约束）；用户协作规则在 `.workbuddy/memory/MEMORY.md`（教练式对话、表格驱动、Tripo 命名等）

## 旧契约 vs 禁词
- 旧文件「原样保留」（H05 基线锁死）与「新数据禁词零命中」（H07）在 `forbidden_actions/4` 上冲突 → 裁定：H07 扫描排除该单一 JSON Pointer（AI 规则字段，永不渲染），并在 H07 内断言该指针在基线中存在且值未变；旧文件整体不进发布包、不运行时加载（H12 验证无外部依赖时一并覆盖）
