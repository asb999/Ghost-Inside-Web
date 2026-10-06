# Ghost Inside · Web Demo

《Ghost Inside · 心灵调理师》第一章 **《留一个位置》** 的可玩 Web Demo（V0.6，2026-10-06）。

在一个越来越「正确」的时代，很多人活成了别人最可靠的人，却弄丢了自己的位置。你是心灵调理师，接入来访者林澈的记忆现场，重新经历那个晚上。

林澈替父亲拿起手机、替母亲拿起药盒、替弟弟拿起申请表——每拿起一件，身体就更沉一分。背着一家人，他跳不过那道断层。走进三段记忆，把每件事放回真正该负责的人手里；重量消失后，他第二次起跳——依然失败。因为压住他的从来不是物品，而是那张被压在最底下的、只属于他自己的调动通知。

这一次，不删除任何过去：把责任放回原处，也把自己的选择留下。然后，再跳一次。核心体验循环：**调查记忆 → 破解信念 → 重构记忆**。

没有答题，没有评分，失败不会死亡——只有一个可以被重新理解的晚上。

| 开始 | 负重 | 记忆解谜 | 最终跳跃 | 通关 |
|---|---|---|---|---|
| ![开始](game/web/docs/screenshots/00-game-start.png) | ![负重](game/web/docs/screenshots/02-full-load.png) | ![记忆](game/web/docs/screenshots/04-memory-puzzle.png) | ![跳跃](game/web/docs/screenshots/06-final-landing.png) | ![通关](game/web/docs/screenshots/08-level-complete.png) |

## 快速开始

```bash
cd game/web
npm install
npm start        # 打开 http://127.0.0.1:4173/
```

开发与构建：

```bash
npm run dev      # Vite 开发服务器
npm run build    # 产出 game/web/dist/
```

无需后端服务、无需数据库、无外部 AI 依赖，本地即可完整通关。

## 操作

- **WASD / 方向键**：移动
- **Space**：跳跃
- **E / Enter**：拿起、放下、互动

## 玩法与设计原则

- 核心机制：**负重** —— 每替家人拿起一件事，角色移动与跳跃能力都会下降；放下后恢复。
- 三段记忆场景（提醒板 / 手机归还 / 申请表）中把每件事还给真正该负责的人。
- **记忆与真实的矛盾**：物品都还回去之后，第二次跳跃依然失败——压住他的不是重量，而是被压在最底下的调动通知（「这个家离不开我」 vs 「三次获批，均由本人撤回」）。
- 结局会记录你的一念犹豫：是否曾想把通知放下，最后又把它放回了自己的位置。
- **没有答题、没有证据面板、没有心理评分**；失败不会死亡，物品不会丢失，同一处断层的三次结果构成完整叙事。

## 技术栈

- [Three.js](https://threejs.org/) 0.186 + [Vite](https://vitejs.dev/) 8，纯前端单页应用
- 角色与幽灵使用 glTF 2.0 模型（绑定骨骼的林澈、Ghost）
- WebAudio 合成音效，无音频文件依赖

## 项目结构

```
game/web/
├── public/assets/        # 3D 模型（lin-che-rigged.glb、ghost.glb）、UI 主视觉
├── src/
│   ├── scenes/           # 场景：花园（教学+断层）、收集者、责任记忆
│   ├── game/             # 状态机、游戏时钟、输入、角色视觉
│   ├── ui/               # 叙事文本、结局陈述
│   ├── render/           # Three.js 渲染器
│   └── audio/            # WebAudio 音景
├── docs/screenshots/     # 完整流程截图
└── index.html
```

## 相关仓库

- 早期 Godot 4.7 原型（案例001·白色走廊）：[Ghost-Inside](https://github.com/asb999/Ghost-Inside)
