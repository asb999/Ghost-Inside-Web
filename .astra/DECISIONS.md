# DECISIONS（S1-3 固定决策，2026-10-01）

1. **技术栈**：Vite + Three.js + 原生 DOM；不引入 React/Vue 等框架；不使用运行时 CDN。
2. **数据策略**：新案例 `game/data/cases/case_001_optimal_life.json` 保留旧案例 `agent_contract / fallbacks / cards` 的实际结构；经 `src/data/normalize-case.js` 适配层供网页使用；旧文件只读、不复制进发布资源。
3. **开场文案**：使用「状态记录」替代「诊断数据」（「诊断」「治疗」在禁词表内）。
4. **判定档位**：面板判定只有 `accept / revise / hold`；第四档为 `timeout` 固定回退，其判定语义归入 `hold`（数据文件中 `fallbacks.timeout` 独立存在）。
5. **Provider**：默认不配置远程 provider（固定回退完整可玩）；可选接入走公开网关 URL（`VITE_GHOST_PROVIDER_URL`），私密 key 只存在于网关服务端，绝不进前端；前端禁止出现 `VITE_*KEY` 类变量。
6. **安全边界**：provider 受限输出 `{verdict, feedback_key, evidence_ids}`，从数据内反馈模板选择，不展示自由生成正文；响应 ≤16KiB；截止 8 秒；`reject`/未知模板/额外字段一律判非法走回退。
7. **禁词扫描范围裁定**：H07 扫描发布范围内全部文案与新案例全部字符串，**唯一例外**为 `agent_contract.forbidden_actions`（AI 规则字段，永不渲染给玩家，且被 H05 基线锁死逐字保留）；H07 须断言该例外指针存在于基线且值未变；旧案例整体不进发布包。
8. **节拍时长**：名义总时长 355s（35/100/70/65/35/25/25，区间 [300,420]）；表态输入不设倒计时、不强制提交。
9. **47 条修改记录**：必须是真实逐条数据（id/时间线/摘要），`editorId:"lin_che"`；揭示前显示 `redacted`，揭示后显示真实修改人；不得只有一个计数器。
10. **占位资源**：模型未就绪时用几何体占位（manifest `placeholder` 模式），不阻塞流程与检查；Tripo 生成后替换并重跑 H03/H14。
11. **范围裁剪**：不实现最优解 BOSS、岔路回廊全量、Ghost 格式化演出、存档、移动端、账号。
12. **旧文件命名差异映射**：新案例沿用旧键名（snake_case：`agent_contract` / `fallbacks` / `cards`）；新增节拍字段亦用 snake_case（`beats` / `reveal` / `pollution` / `ghost_lines` / `epilogue`），normalize 层转 camelCase 内部视图。
13. **服务端口**：开发/预览固定 `127.0.0.1`；harness 测试端口 `4179`（strictPort，占用即失败）；正式 start 默认 `4173`（`GHOST_PORT` 可覆盖）。
14. **检查不可空转**：browser 辅助函数只允许组合正式输入；禁词扫描脚本内置 Unicode 转义禁词表防自我命中；性能上限常量不充当测量值。
15. **对标基准（10-01 用户追加）**：设计参照《双人成行》《双影奇境》的「一节拍一机制即隐喻、玩完即弃」原则。MVP 落地为：花园中掌声/赞美弹幕使玩家短暂加速、更难控制（被夸=被推着走，机制即隐喻）；掌声终端延迟演出不变。双人合作不在 MVP（叙事为单人调理师）；10/17 阶段评估 Ghost 作为 P2 的不对称合作模式与岔路回廊 spectacle 扩充，另立 GDD「对标分析」章节。
16. **Provider 地址解析顺序**：URL 查询参数 `?provider=` > 构建期 `VITE_GHOST_PROVIDER_URL` > 未配置（固定回退）。查询参数仅供 harness 故障注入使用，文档标注；私密 key 永不出现于前端。
