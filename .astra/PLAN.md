# PLAN

## [S1] 傻瓜级步骤 Fool-proof Steps

1. 保存当前 `git status --short`，确认没有用户未提交改动；读取任务、当前状态机、花园、收集者、污染 UI、素材与现有检查。
2. 从 `New Assets_20261004_01.png` 精确裁出 1a/1b/1c/1d/1e/3a 六张无标签场景图，写入 `game/web/src/assets/scenes/`，用图片尺寸检查确认输出非空。
3. 在页面底层增加随节拍切换的视觉背景，WebGL 画布使用透明背景；每个节拍有纯色/渐变回退，文字层维持暗色遮罩。
4. 花园将掌声速度降为 8.6，赞许墙开启比例降到约 42%，不改变路线和关卡条件。
5. 重写收集者为两轮横向战斗：统一 z=0 场地中心；移除前后移动；每轮生成明确目标安全区和预告；玩家在结算时位于安全区且未受击才降防。受击产生短暂锁定、闪烁、震屏并重开短轮；连续失败两次扩大安全区。防御归零后走近按 E 转化。
6. 污染 UI 加入五个 2.5–3 秒抵抗窗口：E 在活动窗口内记录 `pollution_resist` 并短暂延缓；错过仍继续。第五次事件后显示“按 E 撕开出口”，仅在至少抵抗一次后接受交互并进入表态。若前四次均错过，第五次延长窗口，保证可完成。
7. 将饭桌按钮文案和密度压缩，但保留三循环与 47 条揭示。同步开始页控制说明与两轮战斗目标。
8. 更新 Playwright 驱动：收集者只发送 left/right/jump/interact，主动进入安全区；污染对活动窗口发送 interact；新增零输入不自动通关、受击后果、竞技场边界、抵抗门禁、素材加载检查。
9. 运行构建与完整检查；失败最多修复三轮。最后检查 `git diff` 只包含本任务文件。

## [S2] 工具预调清单 Tool Preflight

- `node --version`：需满足 Vite 8。
- `npm --prefix game/web --version`：确认 npm 可用。
- `node -e "require.resolve('three',{paths:['game/web']}); require.resolve('@playwright/test',{paths:['game/web']}); console.log('ok')"`：确认依赖。
- `Get-Command magick -ErrorAction SilentlyContinue`；若没有，使用已安装的 Python Pillow 或 PowerShell System.Drawing 做一次性裁切。
- `git status --short`：记录工作区。
- `npm --prefix game/web run build`：确认基线可构建。
- `node .astra/harness/check.mjs --only H01_BUILD_HTTP`：确认浏览器检查能启动。

## [S3] 知识库检索清单 Knowledge Retrieval

- `.astra/task.md`：本轮范围、不可破坏约束与验收意图。
- `_gdd_demo_v13.md`：压缩版主流程与叙事边界。
- `game/web/src/main.js`：节拍装配、控制说明、测试钩子。
- `game/web/src/game/machine.js`：唯一转场与事件状态。
- `game/web/src/scenes/garden.js`：速度、墙窗口与局部重试。
- `game/web/src/scenes/collector.js`：战斗轮次、坐标、弹幕与转化。
- `game/web/src/ui/story.js`：饭桌、污染、尾声 UI。
- `game/data/cases/case_001_optimal_life.json`：不可改顺序的五个污染事件与文案。
- `.astra/harness/check.mjs`：既有正式输入驱动和 H01–H16 回归。
- `New Assets_20261004_01.png`：只裁场景区，不处理棋盘格角色区。

## [S4] 技术细节 Technical Details

- 收集者公开测试状态增加 `round`、`roundSuccesses`、`roundHits`、`safeZoneX`、`safeZoneWidth`、`assistLevel`、`staggerRemaining`；不开放状态写入。
- 两轮防御下降沿用案例数值前两项并归一为 50/50，事件仍叫 `collector_defense_drop`，附 `{round, defense, success:true}`。
- 零输入时玩家不在第一轮目标安全区，结算失败且防御不降；失败两次后目标区扩大，但仍需至少一次左右输入进入。
- 战斗坐标统一以怪物 `(0,1.6,0)`、地板 `(0,-0.25,0)` 为中心；玩家只在 x 轴移动，z 固定为 4.5；弹幕由怪物向玩家横向/竖向扫过。
- 污染状态新增 `pollutionResists`、`pollutionWindow`、`pollutionReadyToExit`；`recordPollutionResist(step)` 仅在 UI 活动窗口调用并去重。
- 污染每事件目标间隔约 2.8 秒，总自动事件时间约 14 秒；第五事件后不自动转场，显示 E 门禁。至少一次抵抗后可进入表态。
- 背景素材用 CSS `background-image`，构建由 Vite 处理哈希；`#app[data-beat]` 决定图层。图片加载失败时仍保留渐变色。
- 测试只通过正式 `Input` 动作和 DOM 按钮；不增加 `setState`、传送或直接解锁接口。

## [S5] 模具清单 Templates

事件模板：

```js
this.machine.events.push('pollution_resist', { step: this.machine.pollutionStep + 1 });
```

节拍视觉模板：

```js
document.getElementById('app').dataset.beat = m.beat;
```

正式输入测试模板：

```js
await page.evaluate(() => {
  window.__game.input('interact', true);
  window.__game.stepSimulation(120);
  window.__game.input('interact', false);
  window.__game.stepSimulation(80);
});
```

失败辅助模板：

```js
this.failures += 1;
this.assistLevel = this.failures >= 2 ? 1 : 0;
this.safeZoneWidth = this.assistLevel ? 3.2 : 2.2;
```

## [S6] 自检 Harness Self-check Harness

```bash harness=gameplay
#!/usr/bin/env bash
set -u
status=0
node .astra/harness/check.mjs || status=$?
if [ "$status" -eq 0 ]; then
  printf '%s\n' '[PASS] GAMEPLAY_AND_REGRESSION'
  exit 0
fi
printf '%s\n' '[FAIL] GAMEPLAY_AND_REGRESSION'
exit 1
```

## [S7] 成功标准 Success Criteria

- `GAMEPLAY_AND_REGRESSION`：现有 H01–H16 与新增玩法断言全部通过，进程退出 0。
- `CONTROL_PROMISE`：测试完整流程未发送 forward/back，仍到 `closed`。
- `COLLECTOR_AGENCY`：零输入至少一次结算后防御不变；正确进入安全区两轮后防御为 0；受击事件带来可读状态；失败辅助不自动完成。
- `ARENA_BOUNDS`：任意正式输入下玩家 x 坐标始终在地板范围，z 保持固定；弹幕源点与怪物中心一致。
- `POLLUTION_INPUT`：进入 statement 前 history 至少含一个 `pollution_resist`；第五事件后未按 E 时仍停留 pollution；按 E 后进入 statement。
- `ASSET_LOAD`：六张裁切图存在、尺寸大于 400×200、构建产物请求成功；collector/pollution/epilogue 对应节拍使用新图。
- `FLOW_DURATION`：正常模拟节拍顺序不变，污染自动事件时间在 12–18 秒，收集者只有两次成功降防。

## [S8] 风险与回滚 Risks & Rollback

- 合成图低分辨率：只作模糊远景并叠暗色渐变；若影响可读性，保留 CSS 色彩回退并降低背景不透明度。
- 战斗过难：两次失败后扩大安全区、缩短弹幕持续时间；不跳过轮次。
- 测试依赖旧三轮假设：只修改相关驱动与断言，保留安全、证据、provider、离线、性能检查。
- 旧 JSON 被误改：用 `git diff -- game/data/cases/white_corridor.json` 必须为空。
- 回滚只允许逐文件或逐块：`git restore -p -- game/web/src/scenes/collector.js game/web/src/ui/story.js game/web/src/scenes/garden.js game/web/src/main.js game/web/src/styles.css .astra/harness/check.mjs`；不得使用 hard reset 或 clean。
