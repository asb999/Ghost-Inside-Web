import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
let failed = false;

function run(label, command, args) {
  process.stdout.write(`\n[check] ${label}\n`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) {
    failed = true;
    if (result.error) console.error(result.error.message);
  }
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const scripts = [...walk(join(root, 'src')), ...walk(join(root, 'server'))]
  .filter((path) => ['.js', '.mjs'].includes(extname(path)));

for (const path of scripts) run(`语法：${path.slice(root.length + 1)}`, process.execPath, ['--check', path]);

const htmlPath = join(root, 'index.html');
if (!existsSync(htmlPath)) {
  console.error('[check] 缺少 index.html');
  failed = true;
} else {
  const html = readFileSync(htmlPath, 'utf8');
  const rules = [
    ['页面语言为中文', /<html[^>]+lang=["']zh-CN["']/i],
    ['声明窄屏 viewport', /name=["']viewport["']/i],
    ['加载模块脚本', /<script[^>]+type=["']module["']/i],
    ['没有把常见密钥写进页面', /(?:sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,})/, true],
  ];
  for (const [name, pattern, inverse = false] of rules) {
    const pass = inverse ? !pattern.test(html) : pattern.test(html);
    console.log(`[check] ${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) failed = true;
  }
}

const cssPath = join(root, 'src', 'styles.css');
if (existsSync(cssPath)) {
  const css = readFileSync(cssPath, 'utf8');
  for (const [name, pattern] of [
    ['支持窄屏重排', /@media[^\{]*(?:max-width|max-inline-size)/i],
    ['尊重 reduced-motion', /prefers-reduced-motion\s*:\s*reduce/i],
    ['主要点击目标具有 44px 下限', /min-(?:height|block-size)\s*:\s*(?:44px|2\.75rem)/i],
  ]) {
    const pass = pattern.test(css);
    console.log(`[check] ${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) failed = true;
  }
} else {
  console.error('[check] 缺少 src/styles.css');
  failed = true;
}

const unitTests = walk(join(root, 'tests'))
  .filter((path) => path.endsWith('.test.mjs'));
run('Node 规则测试', process.execPath, ['--test', '--test-isolation=none', ...unitTests]);
run('浏览器流程与静态 DOM 检查', process.execPath, ['tests/e2e.mjs']);

if (failed) {
  console.error('\n[check] FAIL：至少一项检查失败。');
  process.exit(1);
}

console.log('\n[check] PASS：自动规则和浏览器检查通过。');
console.log('[check] 此结果不代表真实玩家试玩已完成，也不代表实时 AI 已验证。');

