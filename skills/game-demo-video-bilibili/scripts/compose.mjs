// compose.mjs — 解说对轴 + 中英字幕 + 合成 MP4
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'E:/About Work since 20251010/Hackathon/EvoMap_Game/_tripathon_submission';
const RAW = join(DIR, 'walkthrough_raw.webm');
const tl = JSON.parse(readFileSync(join(DIR, 'timeline.json'), 'utf8'));
const cfg = JSON.parse(readFileSync(join(DIR, 'narration.json'), 'utf8'));
if (!existsSync(RAW)) throw new Error('walkthrough_raw.webm not found');

const tOf = (name) => tl.events.find((e) => e[0] === name)?.[1] ?? null;
const END = tl.total;
// 掐头 + 变速：去掉加载死镜头，整体 2 倍速（实时录制约 4 分钟 → 成片约 2 分钟）
const TRIM = Math.max(0, (tOf('scene_ready') ?? tOf('game_started') ?? 0) - 1.2);
const FACTOR = Number(process.env.SPEED ?? 2);
const shift = (t) => Math.max(0, (t - TRIM) / FACTOR);
console.log(`trim ${TRIM.toFixed(1)}s, speed x${FACTOR}, video ${END.toFixed(1)}s → ${((END - TRIM) / FACTOR).toFixed(1)}s`);
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());

// ── 对轴：每句放进自己的事件窗口，避免互相重叠 ──
let nextFree = TRIM;
const placed = [];
for (const line of cfg.lines) {
  const [a, b] = line.win;
  const wsRaw = tOf(a) ?? 0;
  const weRaw = (b === '__end' ? END + 2 : (tOf(b) ?? END)) ?? END;
  const ws = shift(wsRaw), we = shift(weRaw);
  const file = join(DIR, `tts_${line.id}.mp3`);
  const d = dur(file);
  let start = Math.max(nextFree, ws + 0.15);
  let end = start + d;
  if (end > we + 1.5) { start = Math.max(nextFree, we - d); end = start + d; }
  nextFree = end + 0.35;
  placed.push({ ...line, start, end, d, file });
  console.log(`${line.id}  ${start.toFixed(1).padStart(6)} → ${end.toFixed(1).padStart(6)}  (${d.toFixed(1)}s)  win [${ws.toFixed(1)}-${we.toFixed(1)}]`);
}

// ── ASS 字幕：中文主行 + 英文副行 ┹ 雅黑 ──
const at = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
};
const esc = (t) => t.replace(/\n/g, '\\N');
let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: CN,Microsoft YaHei,38,&H00FFFFFF,&H00FFFFFF,&H00101420,&H96000000,0,0,0,0,100,100,0,0,1,2.2,1,2,60,60,112,1
Style: EN,Microsoft YaHei,23,&H0088C8F0,&H00FFFFFF,&H00101420,&H96000000,0,0,0,0,100,100,0,0,1,1.6,1,2,60,60,8,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
for (const p of placed) {
  ass += `Dialogue: 0,${at(p.start)},${at(p.end + 0.25)},CN,,0,0,0,,${esc(p.cn)}\n`;
  ass += `Dialogue: 0,${at(p.start)},${at(p.end + 0.25)},EN,,0,0,0,,${esc(p.en)}\n`;
}
writeFileSync(join(DIR, 'subs.ass'), ass);
console.log('subs.ass written');

// ── ffmpeg 合成 ──
const args = ['-y', '-ss', String(TRIM), '-i', RAW];
// 变速（视频流）：setpts 在字幕之前，字幕时间已按 FACTOR 换算
const hasAudio = (() => {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', RAW], 'utf8').trim();
    return out.length > 0;
  } catch { return false; }
})();
placed.forEach((p, i) => args.push('-i', p.file));

const fl = [];
placed.forEach((p, i) => fl.push(`[${i + 1}:a]adelay=${Math.round(p.start * 1000)}:all=1[d${i}]`));
const mixIn = placed.map((_, i) => `[d${i}]`).join('');
fl.push(`${mixIn}amix=inputs=${placed.length}:duration=longest:normalize=0[nar]`);
let audioMap = '[nar]';
if (hasAudio) { fl.push(`[0:a]volume=0.35[game]`, `[nar][game]amix=inputs=2:duration=longest:normalize=0[aud]`); audioMap = '[aud]'; }
fl.push(`[0:v]setpts=PTS/${FACTOR},subtitles=subs.ass,tpad=stop_mode=clone:stop_duration=4[v]`);

args.push('-filter_complex', fl.join(';'), '-map', '[v]', '-map', audioMap,
  '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
  'walkthrough_解说版.mp4');
console.log('encoding...');
execFileSync('ffmpeg', args, { cwd: DIR, stdio: ['ignore', 'ignore', 'pipe'] });

const outDur = dur(join(DIR, 'walkthrough_解说版.mp4'));
console.log(`DONE: walkthrough_解说版.mp4  ${outDur.toFixed(1)}s`);
