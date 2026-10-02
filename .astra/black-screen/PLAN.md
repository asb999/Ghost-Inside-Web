# 黑屏修复计划

[S1] 执行顺序与边界
记录修复前失败证据，修复三处已确认原因，执行新增画面检查及全部既有检查，保存截图与本轮结果。主代理已取得 R01_LAYOUT、R02_GARDEN_PIXELS 失败，花园 player=0、floor=0。本次不扩展剧情、机制或素材；旧 .astra/PLAN.md 与原基线保持不变。

[S2] 工具与规划来源
Codex CLI 已尝试普通启动、提权启动及连接重试，最终未能读取本地文件并产出完整可执行计划。本文件由协作规划器通过可用文件工具读取源码后编制，是本地核实的替代方案，不声称 CLI 成功。执行前确认 Node、项目依赖、Playwright Chromium、Bash 可用；新增画面检查需要正在运行的游戏服务。

[S3] 已核实文件与事实
main.js 启动时添加两盏灯，但 clearScene 删除全部 scene.children，且未导入 styles.css。garden.js 的相机跟随只有 position，没有 lookAt。renderer.js 的相机默认看向负 Z，花园向正 Z 前进。clock.js 已有 rAF、Worker、interval 回退。已读取原 check.mjs、check.sh、check-variation.mjs 及新增 check-render.mjs；原 runner 为 16 项，包装加 H00 后为 17 项，变奏为 3 项。

[S4] 最小修复
main.js 导入 './styles.css'，clearScene 清理时保留 c.isLight 的全局灯光，继续释放其他内容，不能每次切换重复加灯。garden.js 每帧设置相机位置后调用 lookAt(p.x * 0.4, 1.4, p.z + 4)，保证玩家和前路入镜。保留现有计时回退；只有实际回退检查失败才作必要修正。不得凭 draw calls 或对象存在宣称可见。

[S5] 新增画面检查
入口为 .astra/harness/check-render.mjs，复用既有正式输入与通关流程，不添加状态直写。
- R01_LAYOUT：样式已加载；960×640 视口中画布从 (0,0) 填满视口，UI 位于画布上层，无白边、滚动条或 UI 被挤到画布下方。
- R02_GARDEN_PIXELS：实际 WebGL 像素中玩家和受光地面可见，排除 DOM、背景和发光装饰误判；保存截图与计数。当前 player>100、floor>1000 阈值须结合截图验证，修复前零像素是负例。
- R03_COLLECTOR_PIXELS：正式输入进入 collector 后，实际像素中玩家、地面和敌人可见，保存截图与计数；验证切换没有丢灯。当前同时要求 red>100。
- R04_NO_RAF_LIVE：加载前使 rAF 不调用回调，真实等待后仍移动并持续出画面；本检查不得调用 stepSimulation 代替游戏推进。记录真实间隔、移动距离与截图，排除停摆和重复计时。
- R05_NO_PAGE_ERRORS：普通页面及回退页面的 pageerror 全部为空，初始化或切换异常都必须失败。

[S6] 验收命令与证据
从仓库根目录顺序执行，保存真实退出码和各自输出，不并行争用服务端口：
```powershell
node .astra/harness/check-render.mjs
bash .astra/harness/check.sh
node .astra/harness/check-variation.mjs
```
新增入口默认访问 http://127.0.0.1:4173/，其它地址通过 GHOST_RENDER_URL 设置。原包装已完整执行 check.mjs，不能只运行 --only 子集。保留 .astra/reports/render/ 截图与结果、原 runner 报告、本轮 variation 报告。构建结果应包含并加载样式；最终在用户使用的内置浏览器确认布局和花园实际可见。

[S7] 成功标准与真实状态
原包装恰好 17 项 PASS（H01–H16 各一次，H00 一次），三变奏恰好 3 项 PASS，R01–R05 恰好 5 项 PASS；三个进程全部退出 0，没有 FAIL、缺项或重复项，共 25/25 才通过。主代理完成后写 .astra/black-screen/run.status，记录 status、harness_passed、harness_total=25、plan_sha256（本文件真实 SHA-256）、timestamp、三项命令退出码和报告路径。失败则记录实际通过数量与 FAIL。planner_backend 如实注明 local-collaboration-fallback，cli_status=incomplete；不得用旧状态或计划本身代替本轮验收。

[S8] 失败处理与回滚
失败时修复对应原因，不降低断言；重跑相关检查及受影响的完整检查。不得以提高亮度代替灯光保留和相机朝向修复，不得把 DOM 或发光物体当成玩家像素。最多三轮仍失败时记录真实障碍。回滚仅涉及本轮源代码改动和新增检查，保留用户已有改动及历史计划、报告。本次协作规划器仅修改本文件，具体实施与验收由主代理负责。
