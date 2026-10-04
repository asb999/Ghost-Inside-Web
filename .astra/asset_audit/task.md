# Task: Web 3D demo visual background integration

## Goal
Integrate the prepared scene images into the existing web demo so major beats have distinct distant backgrounds/transitions, while preserving UI readability and all gameplay behavior.

## Allowed edits
- game/web/index.html
- game/web/src/main.js
- game/web/src/styles.css

Read-only elsewhere. Do not change game logic, state transitions, scoring, timing, controls, or content progression.

## Assets
Use existing images in `game/web/src/assets/scenes/`:
- start.png
- garden.png
- collector.png
- dinner.png
- pollution.png
- epilogue.png

At minimum, collector, pollution, and epilogue must visibly appear in relevant beats.

## Required behavior
- Scene art appears as a background/distant layer, not as an opaque cover over the game.
- WebGL canvas is transparent enough for the art to remain visible.
- Existing gradient remains as fallback when an image cannot load.
- Text, controls, status panels, and interaction targets remain readable.
- Background switching follows existing game states without changing state logic.
- Respect reduced-motion preference for any new transition.

## Verification
- `npm --prefix game/web run build` exits successfully.
- Machine checks confirm all six files exist, CSS includes gradient fallback plus image layer/readability overlay, renderer alpha is enabled, and collector/pollution/epilogue mappings are present.
