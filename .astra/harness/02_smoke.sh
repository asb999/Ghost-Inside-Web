#!/usr/bin/env bash
#!/usr/bin/env bash
set -u

fail_gate() {
  printf '%s\n' '[FAIL] H00_HARNESS_GATE'
  exit 1
}

command -v node >/dev/null 2>&1 || fail_gate

[ -f game/web/package.json ] || fail_gate
[ -f game/web/package-lock.json ] || fail_gate
[ -f .astra/harness/check.mjs ] || fail_gate
[ -f .astra/baselines/ghost-mvp.json ] || fail_gate

mkdir -p .astra/reports || fail_gate

log='.astra/reports/harness.stdout.log'
errors='.astra/reports/harness.stderr.log'
status=0

node .astra/harness/check.mjs >"$log" 2>"$errors" || status=$?

cat "$log"

if node --input-type=module - "$log" "$status" <<'NODE'
import fs from 'node:fs';

const expected = [
  'H01_BUILD_HTTP',
  'H02_NORMAL_INPUT',
  'H03_ORDERED_FLOW',
  'H04_CLEAN_SMOKE',
  'H05_CASE_CONTRACT',
  'H06_EVIDENCE_BOUNDARY',
  'H07_COPY_LINT',
  'H08_BEAT_BUDGET',
  'H09_NO_KEY',
  'H10_PROVIDER_TIMEOUT',
  'H11_PROVIDER_INVALID',
  'H12_OFFLINE',
  'H13_INTERACTIVE_TIME',
  'H14_RENDER_BUDGET',
  'H15_DELIVERABLES',
  'H16_SECRET_BOUNDARY'
];

const log = fs.readFileSync(process.argv[2], 'utf8');
const exitCode = Number(process.argv[3]);
const lines = log.split(/\r?\n/).filter(line => line.length > 0);

const valid =
  exitCode === 0 &&
  lines.length === expected.length &&
  !log.includes('[FAIL]') &&
  expected.every(id =>
    lines.filter(line => line === `[PASS] ${id}`).length === 1
  );

process.exit(valid ? 0 : 1);
NODE
then
  printf '%s\n' '[PASS] H00_HARNESS_GATE'
  exit 0
else
  printf '%s\n' '[FAIL] H00_HARNESS_GATE'
  exit 1
fi
