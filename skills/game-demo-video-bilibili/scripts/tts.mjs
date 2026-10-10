// tts.mjs — 用 edge-tts 为每句解说生成中文语音
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission';
const cfg = JSON.parse(readFileSync(join(DIR, 'narration.json'), 'utf8'));

const { statSync } = require('node:fs');
for (const line of cfg.lines) {
  const out = join(DIR, `tts_${line.id}.mp3`);
  const ok = () => { try { return statSync(out).size > 2000; } catch { return false; } };
  if (ok()) { console.log(line.id, 'exists, skip'); continue; }
  const text = line.cn.replace(/"/g, '');
  let done = false;
  for (let i = 1; i <= 4 && !done; i++) {
    try {
      execSync(`edge-tts --voice ${cfg.voice} --rate=${cfg.rate} --text "${text}" --write-media "${out}"`, { stdio: 'pipe', timeout: 60000 });
      done = ok();
    } catch (e) { console.log(line.id, `attempt ${i} failed`); }
    if (!done) require('node:fs').rmSync(out, { force: true });
    if (!done && i < 4) execSync('sleep 3');
  }
  if (!done) { console.error(line.id, 'FAILED after retries'); process.exitCode = 1; }
  else console.log(line.id, 'ok');
}
console.log('ALL TTS DONE');
