// build-contract.cjs — 依据 baseline.json 与人工核实的原文锚点生成 contract.json
// 运行：node .astra/optimization/build-contract.cjs（quote 缺失会抛错，不允许伪造锚点）
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert');

const baseline = JSON.parse(fs.readFileSync('.astra/optimization/baseline.json', 'utf8'));
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// ── 阅读证据：每个基准文件 {summary, quote}，quote 必须真实存在于文件 ──
const EV = {
  '.astra/DECISIONS.md': {
    summary: '16 条固定决策（技术栈/数据策略/表态档位/Provider 边界/禁词豁免/节拍时长/47 条记录/占位资源/范围裁剪/键名映射/端口/检查纪律/对标基准/provider 解析顺序）',
    quote: '1. **技术栈**：Vite + Three.js + 原生 DOM；不引入 React/Vue 等框架；不使用运行时 CDN。'
  },
  '.astra/PLAN.md': {
    summary: 'MVP 施工契约（八段）：七节拍状态机、17 项检查 H00-H16、端口 4179、基线锁与红线实现约定',
    quote: '为保证红线，MVP 使用受限输出：'
  },
  '.astra/harness/01_check.sh': { summary: '旧检查包装一：调 ask_astra.sh check', quote: 'bash ./ask_astra.sh check' },
  '.astra/harness/02_smoke.sh': { summary: '旧检查包装二：smoke 门禁（node 可用性与文件存在性检查）', quote: "command -v node >/dev/null 2>&1 || fail_gate" },
  '.astra/harness/03_check.sh': { summary: '旧检查包装三：从脚本根目录执行 .astra/harness/check.sh', quote: 'exec bash .astra/harness/check.sh' },
  '.astra/harness/baseline.mjs': { summary: '基线工具：旧案例文件 SHA-256 与 forbidden_actions JSON Pointer 锁定', quote: "import crypto from 'node:crypto';" },
  '.astra/harness/check.mjs': {
    summary: '16 项浏览器/数据检查 runner（H01-H16）：Playwright 驱动七节拍全流程、证据边界、provider 故障注入（timeout/非法/离线）、渲染与交互预算',
    quote: "'H09_NO_KEY', 'H10_PROVIDER_TIMEOUT', 'H11_PROVIDER_INVALID', 'H12_OFFLINE',"
  },
  '.astra/harness/check.sh': { summary: 'H00 门禁：全量跑 check.mjs 并校验 17 行 [PASS] 汇总，缺一即 FAIL', quote: '# check.sh — harness 包装：全量跑 check.mjs，校验 17 行 PASS 汇总' },
  '.astra/harness/checks/data.mjs': { summary: '独立数据检查 H05_CASE_CONTRACT / H07_COPY_LINT / H08_BEAT_BUDGET（案例契约、禁词扫描、节拍时长预算）', quote: '// checks/data.mjs — 独立数据检查：H05_CASE_CONTRACT / H07_COPY_LINT / H08_BEAT_BUDGET' },
  '.astra/harness/contract-map.json': { summary: '案例字段映射与禁词豁免指针（/agent_contract/forbidden_actions）', quote: '"exclude_pointers": ["/agent_contract/forbidden_actions"],' },
  '.workbuddy/memory/MEMORY.md': { summary: '项目长期笔记：项目定位、三条红线、关系架构、Ghost 工具渐暖定稿、称谓双名、叙事结构 v1.2', quote: '- **三条红线**：不宣称疗效 · 不替当事人做人生决定 · AI 只读证据写反馈（绝不改事实）' },
  '_gdd_import.md': {
    summary: 'GDD v1.2 本地同步稿：核心命题、三条红线、四条张力线×五幕节拍、关系架构（两层世界/三类存在/立场表）、反转清单',
    quote: '3D 场景跑酷躲避「情绪攻击」'
  },
  'game/data/cases/case_001_optimal_life.json': {
    summary: '唯一案例数据源 schema v2：七节拍 beats、47 条修改记录（editor_id=lin_che）、PE1-PE5 污染事件、ghost_lines、feedback_templates、fallbacks 四类、卡片 unlock_event 映射',
    quote: '"schema_version": 2,'
  },
  'game/web/package.json': { summary: '前端包定义：ghost-inside-web，Vite/Three.js/Playwright 依赖与脚本', quote: '"name": "ghost-inside-web",' },
  'game/web/src/agent/feedback.js': { summary: '反馈解析：按 verdict 从案例数据模板选择反馈，provider 结果优先', quote: 'export function resolveFeedback(result, caseView) {' },
  'game/web/src/agent/provider.js': {
    summary: 'LLM 边界实现：8 秒 timeout→fallbacks.timeout；其他失败→fallbacks.hold；私密 key 不进前端',
    quote: 'export async function requestFeedback({'
  },
  'game/web/src/agent/validate-response.js': { summary: '受限输出校验：{verdict, feedback_key, evidence_ids}，16KiB 上限，非法即回退', quote: 'export function validateProviderResponse(raw, { templates, unlocked, maxBytes = 16 * 1024 } = {}) {' },
  'game/web/src/assets/manifest.js': { summary: '资产清单：placeholder 模式几何体占位（决策 #10）', quote: "export const ASSET_MODE = 'placeholder';" },
  'game/web/src/audio/audio.js': { summary: '音频类：掌声/呼吸等音效通道', quote: 'export class Audio {' },
  'game/web/src/data/normalize-case.js': { summary: '案例适配层：snake_case 数据转 camelCase 内部视图（决策 #12）', quote: 'export function normalizeCase(raw) {' },
  'game/web/src/game/clock.js': { summary: '固定步长时钟：testMode 下 advanceTestClock 不受 maxFrameMs 截断', quote: 'constructor({ fixedStepMs = 16.6667, maxFrameMs = 100 } = {}) {' },
  'game/web/src/game/events.js': { summary: '事件日志：节拍进入/解锁/结案等事件记录', quote: 'export class EventLog {' },
  'game/web/src/game/input.js': { summary: '键鼠输入映射：KEYMAP 正式输入通道（决策 #14）', quote: 'const KEYMAP = {' },
  'game/web/src/game/machine.js': {
    summary: '状态机：ORDER 八节拍严格顺序与前置守卫、unlock、recordPollutionEvent（B01/E03）、closeCase',
    quote: 'const ORDER = ['
  },
  'game/web/src/main.js': { summary: '装配入口：lastBeat 守卫防 unlock 重建当前节拍 UI；?test=1 暴露 window.__game 只读快照与正式输入通道', quote: "let lastBeat = 'boot';" },
  'game/web/src/render/renderer.js': { summary: 'Three.js 渲染器创建与统计（calls/triangles 供 H14）', quote: 'export function createRenderer(canvas) {' },
  'game/web/src/scenes/collector.js': {
    summary: '赞许收集者：三轮弹幕（预告+安全区），防御按轮下降 [34,33,33]，归零后接近交互转化',
    quote: 'this.defense = machine.caseView.collector.defense_start;'
  },
  'game/web/src/scenes/garden.js': {
    summary: '完美花园：掌声加速区（机制即隐喻，APPLAUSE_SPEED=9.6）、跳跃 JUMP_V=9/GRAVITY=20、终点掌声终端交互→延迟 500ms 静音→进入下一节拍',
    quote: 'const APPLAUSE_SPEED = 9.6;   // 掌声加速（机制即隐喻）'
  },
  'game/web/src/styles.css': { summary: '全局样式（DOM UI 层）', quote: '--ink: #0a0e14;' },
  'game/web/src/ui/statement.js': { summary: '表态点 UI：三档判定面板与固定回退展示', quote: 'export class StatementUI {' },
  'game/web/src/ui/story.js': { summary: '叙事 UI：开场/饭桌三循环/47 条揭示/污染演出/尾声', quote: 'export class StoryUI {' }
};

// ── 16 条决策（DECISIONS.md 原文锚点）──
const LOCKS = [
  ['D01-tech-stack', '1. **技术栈**：Vite + Three.js + 原生 DOM'],
  ['D02-data-strategy', '保留旧案例 `agent_contract / fallbacks / cards` 的实际结构'],
  ['D03-copy-opening', '使用「状态记录」替代「诊断数据」'],
  ['D04-verdict-tiers', '面板判定只有 `accept / revise / hold`'],
  ['D05-provider-key', '私密 key 只存在于网关服务端，绝不进前端'],
  ['D06-provider-output', 'provider 受限输出 `{verdict, feedback_key, evidence_ids}`'],
  ['D07-lint-exemption', '**唯一例外**为 `agent_contract.forbidden_actions`'],
  ['D08-beat-budget', '名义总时长 355s'],
  ['D09-records-47', '必须是真实逐条数据（id/时间线/摘要）'],
  ['D10-placeholder', '模型未就绪时用几何体占位（manifest `placeholder` 模式）'],
  ['D11-scope-cut', '不实现最优解 BOSS、岔路回廊全量、Ghost 格式化演出、存档、移动端、账号'],
  ['D12-key-mapping', '新案例沿用旧键名（snake_case'],
  ['D13-ports', 'harness 测试端口 `4179`'],
  ['D14-check-discipline', 'browser 辅助函数只允许组合正式输入'],
  ['D15-benchmark-baseline', '设计参照《双人成行》《双影奇境》的「一节拍一机制即隐喻、玩完即弃」原则'],
  ['D16-provider-url-order', 'URL 查询参数 `?provider=` > 构建期 `VITE_GHOST_PROVIDER_URL` > 未配置']
].map(([id, quote]) => ({ id, path: '.astra/DECISIONS.md', quote }));

// ── 三条红线（_gdd_import.md 原文锚点）──
const REDLINES = [
  ['RL1-no-cure-claim', '不宣称疗效——这是虚构的科幻体验，不是心理治疗'],
  ['RL2-no-decide-for-client', '不替当事人做人生决定'],
  ['RL3-ai-read-only', 'AI 只「读证据写反馈」，绝不「定规则改事实」']
].map(([id, quote]) => ({ id, path: '_gdd_import.md', quote }));

// ── 17 项旧检查（H00-H16，真实断言锚点 + 实际执行命令）──
const RUN = ['bash', '.astra/harness/check.sh'];
const LEGACY_CHECKS = [
  ['H00_HARNESS_GATE', '.astra/harness/check.sh', "[FAIL] H00_HARNESS_GATE"],
  ['H01_BUILD_HTTP', '.astra/harness/check.mjs', 'async function h01() {'],
  ['H02_NORMAL_INPUT', '.astra/harness/check.mjs', 'async function h02() {'],
  ['H03_ORDERED_FLOW', '.astra/harness/check.mjs', 'async function h03() {'],
  ['H04_CLEAN_SMOKE', '.astra/harness/check.mjs', 'async function h04(pageErrors, consoleErrors, failedRequests) {'],
  ['H05_CASE_CONTRACT', '.astra/harness/checks/data.mjs', 'export function h05CaseContract() {'],
  ['H06_EVIDENCE_BOUNDARY', '.astra/harness/check.mjs', 'async function h06() {'],
  ['H07_COPY_LINT', '.astra/harness/checks/data.mjs', 'export function h07CopyLint() {'],
  ['H08_BEAT_BUDGET', '.astra/harness/checks/data.mjs', 'export function h08BeatBudget() {'],
  ['H09_NO_KEY', '.astra/harness/check.mjs', 'async function h09() {'],
  ['H10_PROVIDER_TIMEOUT', '.astra/harness/check.mjs', 'async function h10() {'],
  ['H11_PROVIDER_INVALID', '.astra/harness/check.mjs', 'async function h11() {'],
  ['H12_OFFLINE', '.astra/harness/check.mjs', 'async function h12() {'],
  ['H13_INTERACTIVE_TIME', '.astra/harness/check.mjs', 'async function h13() {'],
  ['H14_RENDER_BUDGET', '.astra/harness/check.mjs', 'async function h14() {'],
  ['H15_DELIVERABLES', '.astra/harness/check.mjs', 'async function h15() {'],
  ['H16_SECRET_BOUNDARY', '.astra/harness/check.mjs', 'async function h16() {']
].map(([id, path, quote]) => ({
  id, anchor: { path, quote }, cwd: '.', command: RUN
}));

// ── 来源登记（R1-R6 已核实；X1-X4 小红书 PC 链接已读全文；7 短链不可读）──
const SOURCES = [
  { id: 'R1', game: 'It Takes Two', url: 'https://www.ea.com/en/games/it-takes-two/it-takes-two/news/it-takes-two-official-gameplay-trailer', status: 'verified', note: '雪景球磁铁能力对应重新找回吸引力；支持「机制表达关系」，不证明花园应采用磁铁' },
  { id: 'R2', game: 'It Takes Two', url: 'https://www.thesixthaxis.com/2021/03/02/interview-josef-fares-on-it-takes-two-relationship-advice-co-operation-favourite-swear-words/', status: 'verified', note: '基础移动复用、情境机制变化；树液/火柴为专门设计的敌人；借鉴结构不照搬' },
  { id: 'R3', game: 'Split Fiction', url: 'https://www.ea.com/games/split-fiction/split-fiction/features', status: 'verified', note: '双方协调行动、飞猪与弹簧猪等能力形态；支持互补能力设计' },
  { id: 'R4', game: 'Split Fiction', url: 'https://news.ea.com/press-releases/press-releases-details/2025/Leap-Between-Sci-Fi-and-Fantasy-Worlds-in-Split-Fiction-an-All-New-Co-op-Adventure-From-Hazelight-and-EA-Originals/default.aspx', status: 'verified', note: 'Side Stories 是由未完成故事草稿解释的简短可选玩法变化' },
  { id: 'R5', game: 'Split Fiction', url: 'https://www.ea.com/able/resources/split-fiction/split-fiction', status: 'verified', note: '可确认后跳至下一检查点、降低敌伤、随时暂停；不推断检查点间距' },
  { id: 'R6', game: 'Split Fiction', url: 'https://gamesbeat.com/how-josef-fares-stayed-focused-on-the-co-op-action-adventure-with-split-fiction-interview/', status: 'verified', note: '避免玩家长时间卡住；AI 第二玩家会增加复杂度——玩家×Ghost 须作为本项目实验验证' },
  { id: 'X1', game: 'It Takes Two', url: 'https://www.xiaohongshu.com/discovery/item/696e359d000000000c037a41?source=webshare&xhsshare=pc_web&xsec_token=CBl8bp0LHY95vchOOgpobKtBBx-e7VLm2g8eBU1TxgLTE=&xsec_source=pc_share', status: 'verified', note: 'PC 链接已读全文：四大主题对应关卡（Time/Attraction/Passion/Dreams）、Book of Love 引导者 NPC、不对称能力、无重复机制' },
  { id: 'X2', game: 'It Takes Two', url: 'https://www.xiaohongshu.com/discovery/item/673476e8000000001b02c1a6?source=webshare&xhsshare=pc_web&xsec_token=CB8TYX9yx_ZDFnu2OK6j-5XdULWvL_tPGDsaJ9QNj7NYk=&xsec_source=pc_share', status: 'verified', note: 'PC 链接已读全文：Oskar Wolontis 访谈——8 名关卡设计师结对、pod 单元、架空世界观解放玩法、基础动作复用' },
  { id: 'X3', game: 'Split Fiction', url: 'https://www.xiaohongshu.com/discovery/item/681c2ea30000000023014f82?source=webshare&xhsshare=pc_web&xsec_token=CBOftpbfvxznwvuP-FWq3oyzK8-cNcB20XT_g1ml0lqJk=&xsec_source=pc_share', status: 'verified', note: 'PC 链接已读全文：每章玩法不重复、支线脑洞、一人跳台一人给信息、「不浪费每一关：每一关都能讲故事」' },
  { id: 'X4', game: 'It Takes Two', url: 'https://www.xiaohongshu.com/discovery/item/6aab4dc70000000027016f91?source=webshare&xhsshare=pc_web&xsec_token=CBwaBQvLklx8EpfDHfSnepgakZIdAzJu7bIKm4C9pZHUY=&xsec_source=pc_share', status: 'verified', note: 'PC 链接已读全文（Rukawa 著）：Design Rationale 四问——设计意图/为何必须玩家操作/换成对白失去什么/成本；双人成行把关系困境变操作依赖' },
  ...['9TDVyK2JGmy', 'DpsnqRN9bo', '9QJIRS0u2xK', '7dMDmabcj5d', '7HOPhvthlIK', 'Ap5nKkogoHR', '2BjnG9fthbJ'].map((code) => ({
    id: 'XH-' + code, game: 'unknown', url: 'https://xhslink.cn/o/' + code, status: 'unavailable',
    note: '短链读取失败；其中 4 篇已通过 PC 完整链接取得正文（见 X1-X4），其余仅在拿到正文前不作为设计依据'
  }))
];

// ── 决策/红线兼容性理由（对所有条目成立的不变量）──
const RULE_REASONS = {
  'D01-tech-stack': '不引入新框架与运行时 CDN，扩展逻辑全部使用既有 Three.js + 原生 DOM 技术栈',
  'D02-data-strategy': '不改数据策略与 normalize 适配层，案例数据保持只读与既有结构',
  'D03-copy-opening': '开场与既有文案措辞不动，仍用「状态记录」表述',
  'D04-verdict-tiers': '表态判定档位与语义不变，仍为三档加 timeout 固定回退',
  'D05-provider-key': '不新增任何 key 或前端环境变量，provider 边界不变',
  'D06-provider-output': '不扩展 provider 受限输出契约，非法输出仍走固定回退',
  'D07-lint-exemption': '禁词扫描范围与唯一豁免指针不变，新文案一并纳入扫描',
  'D08-beat-budget': '不改名义总时长与表态输入规则，新增内容控制在既有节拍预算内',
  'D09-records-47': '不触碰 47 条修改记录数据与揭示逻辑',
  'D10-placeholder': '占位资源模式不变，新增物件复用几何体占位',
  'D11-scope-cut': '不恢复已裁剪范围，不新增 BOSS/岔路回廊全量/Ghost 格式化演出',
  'D12-key-mapping': '新增 JSON 字段沿用 snake_case 并向后兼容',
  'D13-ports': '服务端口约定不变，harness 仍用 4179 strictPort',
  'D14-check-discipline': '新增检查同样只组合正式输入通道，不设测试后门',
  'D15-benchmark-baseline': '不偏离对标基准；本条目正是「一节拍一机制即隐喻」的具体化',
  'D16-provider-url-order': 'provider 地址解析顺序不变',
  'RL1-no-cure-claim': '不出现疗效承诺类表述，新文案纳入 H07 禁词扫描',
  'RL2-no-decide-for-client': '不为当事人做人生决定，Ghost 支援不代选不劝选',
  'RL3-ai-read-only': 'AI 仍只读证据写反馈，不定规则不改事实，支援限于操作辅助'
};
const RULE_IDS = [...LOCKS.map((r) => r.id), ...REDLINES.map((r) => r.id)];
const compat = () => RULE_IDS.map((id) => ({ id, result: 'preserved', reason: RULE_REASONS[id] }));

// ── 建议条目（8 条：P0×4 / P1×2 / P2×2）──
const ITEMS = [
  {
    id: 'P0-01', priority: 'P0', classification: 'enhance', selected: true, sourceIds: ['R1', 'R2', 'X1', 'X2'],
    design: 'R1 磁铁能力=把「重新找回吸引力」做成可玩规则；R2/X2 基础动作稳定、情境规则变化；X1 每关一个主题、主题决定机制',
    translation: '保留花园既有主动作（移动/跳跃/交互）与掌声加速隐喻，把既有路径组织为三阶段：第一阶段仅掌声加速区且无操作失败惩罚；第二阶段只引入一个新条件（间歇赞许弹幕需停步时机）；第三阶段组合前两阶段条件；完成后照旧进入既有下一节拍 collector',
    beat: '完美花园',
    current: { path: 'game/web/src/scenes/garden.js', quote: '// 掌声加速区（两条）：站在里面会被「夸」得更快、更难控制' },
    delta: '现有花园为单段路径+两条加速区+终点终端；改为三阶段递进变奏，不新增操作，只改情境条件与反馈',
    hours: [6, 10], dependsOn: [], compatibility: compat(),
    acceptance: [{
      id: 'GARDEN_VARIATION', kind: 'machine',
      setup: '进入花园节拍，分别定位三阶段起点',
      action: '以正式输入通道分别独立重现三阶段：第一阶段无失败惩罚通关、第二阶段仅新条件生效、第三阶段组合条件通关',
      expected: '三阶段均可独立重现；完成后照旧进入 collector；全程表态/污染状态不变',
      command: 'node .astra/harness/check-variation.mjs --only=GARDEN_VARIATION（新增检查，P0 实施时落地）'
    }],
    gddAnchors: []
  },
  {
    id: 'P0-02', priority: 'P0', classification: 'enhance', selected: true, sourceIds: ['R2', 'R3', 'X1'],
    design: 'R2 树液/火柴的互补结构：一人制造条件、一人利用条件；R3 不同能力形态协调行动；X1 引导者 NPC 布置协作',
    translation: '在花园终点终端前加「漂移线索」：关键线索随风漂移、玩家无法同时观察与操作；玩家按键请求支援，Ghost 暂时将线索固定在原地，玩家在保持窗口内完成观察并关闭终端；缺 Ghost 固定无法完成，缺玩家操作也无法完成；取消/离开/重试均解除保持',
    beat: '完美花园',
    current: { path: 'game/web/src/scenes/garden.js', quote: '// 终点终端：抵达后交互关闭' },
    delta: '现有终端为直接交互关闭；改为 Ghost 固定线索+玩家观察的两步协作，Ghost 只提供可预测的操作支援，不替玩家表态不给正确答案',
    hours: [8, 12], dependsOn: [], compatibility: compat(),
    acceptance: [{
      id: 'GHOST_AND_GATE', kind: 'machine',
      setup: '进入花园终点协作点，清除当前挑战暂态',
      action: '分别执行仅玩家、仅 Ghost 支援、双方配合、取消后重试四种路径',
      expected: '只有双方配合完成一次；取消/离开/重试清理保持状态；表态状态不被代写',
      command: 'node .astra/harness/check-variation.mjs --only=GHOST_AND_GATE（新增检查，P0 实施时落地）'
    }],
    gddAnchors: []
  },
  {
    id: 'P0-03', priority: 'P0', classification: 'enhance', selected: true, sourceIds: ['R5', 'R6'],
    design: 'R5 辅助功能：确认后跳至下一检查点、降低敌伤；R6 避免玩家长时间卡住',
    translation: '对花园与收集者的操作挑战做局部重试：失败只重置当前挑战起点（位置/暂态物体/Ghost 保持状态），已确认表态、已发生污染、已完成转化遵循原规则不增不减；重试不重复奖励、不重复追加污染；Ghost 支援状态清理；恢复操作目标不超过 3 秒',
    beat: '完美花园 / 赞许收集者',
    current: { path: 'game/web/src/game/machine.js', quote: 'const ORDER = [' },
    delta: '现有 respawn 遥测已有基础；补齐重试状态清理、防重复奖励/污染、防表态倒退，并新增 LOCAL_RETRY 行为检查',
    hours: [4, 6], dependsOn: ['P0-01', 'P0-02'], compatibility: compat(),
    acceptance: [{
      id: 'LOCAL_RETRY', kind: 'machine',
      setup: '进入含协作点的花园挑战并故意连续失败',
      action: '连续失败 10 次后完成挑战；核对奖励、污染、表态与 Ghost 保持状态',
      expected: '连续失败 10 次仍可完成；每次重试不重复奖励、不重复追加污染、不倒退已确认表态；Ghost 支援状态清理；恢复操作目标不超过 3 秒',
      command: 'node .astra/harness/check-variation.mjs --only=LOCAL_RETRY（新增检查，P0 实施时落地）'
    }],
    gddAnchors: []
  },
  {
    id: 'P0-04', priority: 'P0', classification: 'defer', selected: false, sourceIds: ['R2'],
    design: 'R2 能力与敌人反馈共同设计：同一应对动作遭遇互相矛盾的赞许反馈',
    translation: '收集者第二阶段：变奏阶段只进入一次、重入无残留、原转化条件仍可获胜、不新增击杀胜利',
    beat: '赞许收集者',
    current: { path: 'game/web/src/scenes/collector.js', quote: 'this.defense = machine.caseView.collector.defense_start;' },
    delta: '现有收集者三轮弹幕+防御按轮下降已表达「赞许即消耗」的矛盾反馈，该隐喻已被既有实现覆盖；候补延后，仅当实际节省至少 12 小时后才纳入',
    hours: [8, 12], dependsOn: [], compatibility: compat(),
    acceptance: [{
      id: 'COLLECTOR_VARIATION', kind: 'machine',
      setup: '进入收集者变奏阶段',
      action: '通关后重入该节拍再通关一次',
      expected: '变奏阶段只进入一次；重入无残留；原转化条件仍可获胜；无新增击杀胜利',
      command: 'node .astra/harness/check-variation.mjs --only=COLLECTOR_VARIATION（若实施的候补检查）'
    }],
    gddAnchors: []
  },
  {
    id: 'P1-01', priority: 'P1', classification: 'enhance', selected: false, sourceIds: ['R3', 'R6', 'X3'],
    design: 'R3 协调行动展示；R6 真人协作与 AI 第二玩家不等价，只借互补结构；X3 演出与玩法融合',
    translation: '展示「玩家请求—Ghost 支援—玩家完成—后段语气变化」的 90 秒内可复述演示编排，单人操作，不引入第二真人/联网/账号；若用预写响应须如实说明',
    beat: '完美花园（衔接既有 Ghost 暖化弧线）',
    current: { path: 'game/web/src/agent/provider.js', quote: 'export async function requestFeedback({' },
    delta: '依赖 P0-02 落地后的演示编排与语气衔接；叙事暖化只使用既有许可，不因演示提前变暖',
    hours: [4, 6], dependsOn: ['P0-02'], compatibility: compat(),
    acceptance: [{
      id: 'DEMO_RECALL', kind: 'manual',
      setup: '三名未参与开发的观看者',
      action: '观看不超过 90 秒的协作演示段',
      expected: '至少两人能分别说出玩家和 Ghost 各做了什么；无人误以为 Ghost 替玩家选择立场',
      command: ''
    }],
    gddAnchors: []
  },
  {
    id: 'P1-02', priority: 'P1', classification: 'defer', selected: false, sourceIds: ['R4'],
    design: 'R4 Side Stories：由未完成故事草稿解释的简短可选玩法变化，完成后回归主线',
    translation: '一个有记忆叙事理由、完成后回归主线的岔路回廊短变奏；进入/完成/退出/放弃均回原主线，跳过不改变主线必需条件',
    beat: '三幕 · 岔路回廊（GDD 概念）',
    current: { path: '_gdd_import.md', quote: '**三幕 · 岔路回廊**' },
    delta: 'GDD 三幕有岔路回廊概念，但决策 #11 已将岔路回廊全量列入范围裁剪；放入 P1 不作为 P0 前置',
    hours: [12, 20], dependsOn: [], compatibility: compat(),
    acceptance: [{
      id: 'OPTIONAL_RETURN', kind: 'machine',
      setup: '从主线进入岔路回廊变奏',
      action: '分别测试进入、完成、退出、放弃四条路径',
      expected: '均能回原主线；跳过不改变主线必需条件；进入和返回不重复写入表态或污染',
      command: 'node .astra/harness/check-variation.mjs --only=OPTIONAL_RETURN（若实施的检查）'
    }],
    gddAnchors: []
  },
  {
    id: 'P2-01', priority: 'P2', classification: 'defer', selected: false, sourceIds: ['R1', 'R4'],
    design: 'R1 机制表达关系；R4 故事空间解释玩法变化',
    translation: '从 GDD 既有命题出发生成下一场景的主题机制切片：唯一核心心理命题+进入/教学/变化/结束/回归完整短流程，逐项说明表态/转化/污染保留方式',
    beat: '赛季切片（未来场景）',
    current: { path: '_gdd_import.md', quote: '| **核心命题** | 未来的人，如何在高度数字化的世界里，保持自己还是一个人 |' },
    delta: '规划性工作；不先编造新赛道名称再找对应关系，每个候选必须引用 GDD 原文',
    hours: [40, 80], dependsOn: [], compatibility: compat(),
    acceptance: [{
      id: 'SEASON_SLICE', kind: 'machine',
      setup: '候选切片清单评审',
      action: '核对每条候选的 GDD 原文引用与流程规则',
      expected: '每条候选引用 GDD 原文；具有进入、教学、变化、结束与回归规则；逐项说明表态/转化/污染保留',
      command: 'node .astra/harness/check-season.mjs --only=SEASON_SLICE（若实施的检查）'
    }],
    gddAnchors: [{ path: '_gdd_import.md', quote: '| **核心命题** | 未来的人，如何在高度数字化的世界里，保持自己还是一个人 |' }]
  },
  {
    id: 'P2-02', priority: 'P2', classification: 'defer', selected: false, sourceIds: ['R2', 'R3'],
    design: 'R2 稳定基础动作与变化情境；R3 能力互补',
    translation: '四条张力线×五幕的 20 格机制覆盖表：每格给出玩家动作、Ghost 能力、叙事意义，标明已有覆盖/缺口/不适用原因',
    beat: '赛季规划（关系架构）',
    current: { path: '_gdd_import.md', quote: '**悬疑线「谁删了出口」**' },
    delta: '纯规划工作（16-24h）；覆盖表以本 contract.gdd.matrix 的 20 格为底稿扩展',
    hours: [16, 24], dependsOn: [], compatibility: compat(),
    acceptance: [{
      id: 'SEASON_MATRIX', kind: 'machine',
      setup: '覆盖表定稿后进入评审',
      action: '核对 20 个唯一组合与每格引用',
      expected: '恰有 20 个唯一组合；每格引用真实张力线与幕名；标明已有覆盖、缺口或不适用原因',
      command: 'node .astra/harness/check-season.mjs --only=SEASON_MATRIX（若实施的检查）'
    }],
    gddAnchors: [{ path: '_gdd_import.md', quote: '**悬疑线「谁删了出口」**' }]
  }
];

// ── GDD 锚点：四条张力线 × 五幕（_gdd_import.md 原文）──
const TENSIONS = [
  ['tension-who-deleted-exit', '**悬疑线「谁删了出口」**'],
  ['tension-five-lives', '**关系线「五个活法」**'],
  ['tension-ghost-accomplice', '**伙伴线「共犯 Ghost」**'],
  ['tension-truth-miscalculates', '**机制线「真话算错」**']
].map(([id, quote]) => ({ id, path: '_gdd_import.md', quote }));
const ACTS = [
  ['act1-perfect-garden', '**一幕 · 完美花园**'],
  ['act2-dinner-crack', '**二幕 · 饭桌裂缝**'],
  ['act3-fork-corridor', '**三幕 · 岔路回廊**'],
  ['act4-cleanup', '**四幕 · 清理**'],
  ['act5-optimal-solution', '**五幕 · 最优解**']
].map(([id, quote]) => ({ id, path: '_gdd_import.md', quote }));

const MATRIX = [
  ['tension-who-deleted-exit', 'act1-perfect-garden', '已有覆盖：开场志愿记录闪过、修改人涂白构成悬疑钩子（GDD 一幕节拍）'],
  ['tension-who-deleted-exit', 'act2-dinner-crack', '已有覆盖：二幕中点揭示 47 次修改是他自己发起'],
  ['tension-who-deleted-exit', 'act3-fork-corridor', '已有覆盖：被删岔路碎片佐证删除记录的真实性'],
  ['tension-who-deleted-exit', 'act4-cleanup', '部分覆盖：清理段以「未注册调试进程」延续悬疑，无独立反转'],
  ['tension-who-deleted-exit', 'act5-optimal-solution', '已有覆盖：最优解用真证据说话，悬疑线在此收束'],
  ['tension-five-lives', 'act1-perfect-garden', '轻覆盖：开场生活切片建立家庭人物，不展开五个活法'],
  ['tension-five-lives', 'act2-dinner-crack', '已有覆盖：饭桌裂缝直接呈现家人期待与代价'],
  ['tension-five-lives', 'act3-fork-corridor', '已有覆盖：五个活法碎片（林宇/陈默/顾教授/沈舟/父母）'],
  ['tension-five-lives', 'act4-cleanup', '轻覆盖：林澈「它只是想帮我」体现关系牵动'],
  ['tension-five-lives', 'act5-optimal-solution', '已有覆盖：表态点承接关系线后果，选项归还'],
  ['tension-ghost-accomplice', 'act1-perfect-garden', '已有覆盖：Ghost 全程伴随（工具腔起手）'],
  ['tension-ghost-accomplice', 'act2-dinner-crack', '轻覆盖：悬疑期 Ghost 保持距离感'],
  ['tension-ghost-accomplice', 'act3-fork-corridor', '已有覆盖：Ghost 三幕自白共犯身份（GDD 反转清单 #2）'],
  ['tension-ghost-accomplice', 'act4-cleanup', '已有覆盖：Ghost 为包庇你被格式化（GDD 反转清单 #4）'],
  ['tension-ghost-accomplice', 'act5-optimal-solution', '已有覆盖：缓存里最后一句「这次，可以慢慢想」'],
  ['tension-truth-miscalculates', 'act1-perfect-garden', '已有覆盖：掌声加速=被夸被推着走（机制即隐喻，决策 #15 落地）'],
  ['tension-truth-miscalculates', 'act2-dinner-crack', '轻覆盖：祝福文字危险暗示真话被覆盖'],
  ['tension-truth-miscalculates', 'act3-fork-corridor', '候选 P0-02：Ghost 协作引入「借力观察」的操作语义'],
  ['tension-truth-miscalculates', 'act4-cleanup', '暂不适用：机制线主战场在五幕 BOSS，四幕聚焦伙伴失去'],
  ['tension-truth-miscalculates', 'act5-optimal-solution', '已有覆盖：表态点用感受卡+边界卡反制被武器化的事实卡（GDD 反转清单 #3）']
].map(([tensionId, actId, coverage]) => ({ tensionId, actId, coverage }));

// ── 组装与校验 ──
const readEvidence = Object.keys(baseline.files).map((path) => {
  const ev = EV[path];
  assert(ev, '缺少阅读证据: ' + path);
  assert(fs.readFileSync(path, 'utf8').includes(ev.quote), 'quote 不存在于文件: ' + path);
  return { path, sha256: hash(path), summary: ev.summary, quote: ev.quote };
});
assert.strictEqual(readEvidence.length, 31);

for (const row of [...LOCKS, ...REDLINES]) {
  assert(fs.readFileSync(row.path, 'utf8').includes(row.quote), '锚点缺失: ' + row.id);
}
for (const row of LEGACY_CHECKS) {
  assert(fs.readFileSync(row.anchor.path, 'utf8').includes(row.anchor.quote), '检查锚点缺失: ' + row.id);
}
for (const row of [...TENSIONS, ...ACTS]) {
  assert(fs.readFileSync(row.path, 'utf8').includes(row.quote), 'GDD 锚点缺失: ' + row.id);
}
assert.strictEqual(LOCKS.length, 16);
assert.strictEqual(REDLINES.length, 3);
assert.strictEqual(LEGACY_CHECKS.length, 17);
assert.strictEqual(MATRIX.length, 20);
const upper = ITEMS.filter((i) => i.selected).reduce((s, i) => s + i.hours[1], 0);
assert(upper + 8 + 6 <= 42, '预算超限: ' + upper);

const contract = {
  schemaVersion: 1,
  status: 'ready',
  readEvidence,
  locks: LOCKS,
  redlines: REDLINES,
  legacyChecks: LEGACY_CHECKS,
  sources: SOURCES,
  items: ITEMS,
  budget: { availableHours: 42, verificationHours: 8, reserveHours: 6 },
  gdd: { tensions: TENSIONS, acts: ACTS, matrix: MATRIX },
  review: { reviewer: 'ZCode 主 Agent（依据基准快照逐文件核对原文锚点）', confirmed: true }
};

fs.writeFileSync('.astra/optimization/contract.json', JSON.stringify(contract, null, 2) + '\n');
console.log('contract.json written: evidence=' + readEvidence.length + ' locks=' + LOCKS.length + ' redlines=' + REDLINES.length + ' checks=' + LEGACY_CHECKS.length + ' items=' + ITEMS.length + ' matrix=' + MATRIX.length + ' selectedUpperHours=' + upper);
