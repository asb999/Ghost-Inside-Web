# Ghost Inside · GPT 生图提示词清单（v1）

> 用法：把「英文提示词」整段复制给 GPT/DALL·E（英文出图更稳），中文是给你看的说明。
> 生成后把图片发给我或放进 `game/web/public/assets/`，我来接入（场景背景直接做贴图，立绘做 UI 叠加）。
> **统一风格后缀**（每条已含）：low-poly, muted cold palette, cinematic dim lighting, sci-fi psychological atmosphere, clean minimal composition, no text, no watermark.

## 优先级说明（时间不够先做 ★）

| 优先级 | 资产 | 用在哪 |
|---|---|---|
| ★★★ | 3 张场景背景（花园/竞技场/饭桌） | Three.js 场景背景板，观感提升最大 |
| ★★ | 2 张立绘（Ghost/林澈心象） | 对话 HUD 侧栏 |
| ★ | 饭桌/污染/尾声背景 | 后半程氛围 |

---

## 1. 场景背景（16:9 横图，用作 3D 场景远景/背景板）

### 1a. 完美花园 ★★★（一幕：明亮得过分、恐怖的完美）

```
A vast surreal memory garden at night, rows of identical glowing blue flower pillars
stretching to the horizon on a dark reflective floor, perfectly symmetrical,
unnaturally clean and orderly, faint floating applause light particles in the air,
a single small silhouette of a person standing far away on the path,
low-poly 3D render style, muted cold blue palette, cinematic dim lighting,
eerie perfection, sci-fi psychological atmosphere, no text, no watermark
```

### 1b. 赞许收集者竞技场 ★★★（战斗：圆形暗场）

```
A dark circular arena inside a broken mind, a huge shadowy creature silhouette
made of stacked smiling masks and hearts sitting at the center, surrounded by
floating warm golden light orbs like rising applause, cracked dark ground with
faint red glowing seams, low-poly 3D render style, muted cold palette with warm
orange accents, cinematic dim lighting, oppressive but not gory,
sci-fi psychological atmosphere, no text, no watermark
```

### 1c. 家庭饭桌 ★★★（二幕：温馨但疏离）

```
A warm family dinner table scene seen from a fixed diner's seat, steaming dishes
and smiling blurred faces of parents raising glasses, but the empty seat of the
viewer is slightly pulled back from the table, wallpaper peeling into glitching
white pixels at the edges, low-poly 3D render style, warm yellow tones slowly
dissolving into cold blue, cinematic dim lighting, uncanny warmth,
sci-fi psychological atmosphere, no text, no watermark
```

### 1d. 污染走廊 ★（污染段：选项被吞掉）

```
A white minimalist corridor being erased, floating UI dialog boxes and menu
options dissolving into white static and red warning stamps, one grey doorway
remaining at the end, harsh clean light from above, low-poly 3D render style,
almost monochrome white and grey with a single red accent, cinematic dim lighting,
digital erasure atmosphere, sci-fi psychological style, no text, no watermark
```

### 1e. 落雪尾声 ★（尾声：第一条岔路重新长出来）

```
A quiet snowy crossroad on an empty road at dusk, gently falling snow,
one small young tree sapling growing from the middle of the main road,
footprints leading toward the fork, soft pale blue and grey palette,
low-poly 3D render style, cinematic dim lighting, melancholic but hopeful,
sci-fi psychological atmosphere, no text, no watermark
```

## 2. 角色立绘（透明背景 PNG，用作 HUD 侧栏头像/大立绘）

### 2a. Ghost ★★（AI 伙伴：工具感、微冷幽默）

```
A small floating octahedron-shaped AI companion drone, cyan glowing core inside
translucent geometric shell, thin light trails, hovering posture slightly tilted
like a curious assistant, on pure transparent background, low-poly 3D render,
muted cold palette with cyan glow, cinematic rim light, clean minimal design,
sci-fi psychological style, no text, no watermark
```

### 2b. 林澈心象 ★★（来访者：22 岁、疲惫、口袋里藏着草图）

```
A soft glowing silhouette of a 22-year-old asian male university graduate in a
slightly oversized hoodie, head slightly lowered, one hand holding a crumpled
sketch paper against his chest, half of his body dissolving into pixel blocks,
on pure transparent background, low-poly 3D render, muted cold palette with faint
warm glow on the sketch paper, cinematic rim light, emotional but restrained,
sci-fi psychological style, no text, no watermark
```

## 3. UI 素材（小图，可选）

### 3a. 开始界面主视觉 ★

```
Game title screen art: a single glowing brain made of circuit lines floating in
dark space, one small cyan octahedron drone orbiting it, thin white strands of
memories being cut and falling like snow, low-poly 3D render style, muted cold
blue palette, cinematic dim lighting, sci-fi psychological game atmosphere,
no text, no watermark
```

### 3b. 表态点图标（三档判定用）

```
Three small minimalist hexagonal UI icons in a row: a warm amber shield (accept),
a drifting grey compass (revise), a sealed deep-blue hourglass (hold),
on pure transparent background, flat low-poly style, muted palette with one
accent color each, clean minimal sci-fi game UI, no text, no watermark
```

---

## 接入方式说明（给未来的我）

- 场景背景：`scene.background` 换纹理 / 远景平面板，30 分钟/张
- 立绘：表态点与 Ghost HUD 侧栏 `<img>`，20 分钟/张
- 主视觉：开始卡片背景
- 尺寸要求：背景 1920×1080（16:9）、立绘 1024×1024 透明底、UI 512×512
