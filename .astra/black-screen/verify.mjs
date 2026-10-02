import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../..');
const expected = ['H01_BUILD_HTTP','H02_NORMAL_INPUT','H03_ORDERED_FLOW','H04_CLEAN_SMOKE','H05_CASE_CONTRACT','H06_EVIDENCE_BOUNDARY','H07_COPY_LINT','H08_BEAT_BUDGET','H09_NO_KEY','H10_PROVIDER_TIMEOUT','H11_PROVIDER_INVALID','H12_OFFLINE','H13_INTERACTIVE_TIME','H14_RENDER_BUDGET','H15_DELIVERABLES','H16_SECRET_BOUNDARY'];
let passed = 0, total = 0, success = true;
const exits = [];
function run(file, logName, count) {
  const r = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8', timeout: 900000 });
  fs.writeFileSync(path.join(import.meta.dirname, logName), (r.stdout || '') + (r.stderr || '') + (r.error ? `\nRunner error: ${r.error}\n` : ''));
  process.stdout.write(r.stdout || '');
  const lines = (r.stdout || '').split(/\r?\n/).filter(Boolean);
  const n = lines.filter(s => /^\[PASS\]/.test(s)).length;
  passed += n; total += count;
  const valid = r.status === 0 && !r.error && n === count && !lines.some(s => s.includes('[FAIL]'));
  exits.push(`${logName}_exit_code=${r.status ?? 'error'}`);
  success &&= valid;
  return { valid, lines };
}
const original = run('.astra/harness/check.mjs', 'original.log', 16);
const gate = original.valid && original.lines.length === 16 && expected.every(id => original.lines.filter(l => l === `[PASS] ${id}`).length === 1);
console.log(`[${gate ? 'PASS' : 'FAIL'}] H00_HARNESS_GATE`);
total++; passed += Number(gate); success &&= gate;
run('.astra/harness/check-variation.mjs', 'variation.log', 3);
run('.astra/harness/check-render.mjs', 'render.log', 5);
const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(import.meta.dirname, 'PLAN.md'))).digest('hex');
fs.writeFileSync(path.join(import.meta.dirname, 'run.status'), `status=${success ? 'PASS' : 'FAIL'}\ntimestamp=${new Date().toISOString()}\nharness_passed=${passed}\nharness_total=${total}\nplan_sha256=${hash}\nplanner_backend=local-collaboration-fallback\ncli_status=incomplete\ngate_backend=node-equivalent-of-check.sh\n${exits.join('\n')}\nreports=.astra/black-screen/*.log,.astra/reports/render/result.json,.astra/reports/harness.json\n`);
process.exitCode = success ? 0 : 1;
