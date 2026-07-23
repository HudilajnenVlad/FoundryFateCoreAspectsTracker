# Fate Core Aspects Tracker

A Foundry VTT module (v12–v13) for running **Fate Core** games: track scene aspects with their invokes and compels, and place them on the canvas as clean text labels or as tokens with roll20-style count badges.

Grew out of a macro; the module preserves everything the macro did and adds scene binding, tokens, badges, hotkeys and HUD controls.

## Features

- **Tracker window** — opened from a button in the token controls toolbar or with a hotkey (default `Alt+A`, rebindable in *Configure Controls*). Add, rename, delete aspects; adjust invokes (green) and compels (red).
- **Per-scene aspects** — aspects are stored in the scene's flags. Switch scenes and the tracker shows that scene's aspects.
- **Two placement modes** — drag the <kbd>A</kbd> (text) or <kbd>♟</kbd> (token) handle from the window onto the canvas:
  - *Text label*: a borderless, fill-less text drawing — `Name ++ -` (pluses are invokes, minuses are compels), like the original macro but with no outline.
  - *Token*: an actorless token with the aspect's name and an image (configurable in settings). Invokes and compels are shown as **green/red numbered circles** in the token's corner, like roll20 status markers.
- **Two-way sync** — editing an aspect in the window updates its labels/tokens on the canvas; editing a label's text or a token's name on the canvas updates the tracker.
- **Quick invoke/compel controls**:
  - Right-click an aspect token or label — the HUD shows green/red `− n +` controls.
  - Hover (or select) an aspect token/label and press a hotkey: `I` / `Shift+I` for invokes, `O` / `Shift+O` for compels (GM only, rebindable).
- **Migration** — the *Import from macro storage* button in the window copies aspects saved by the old macro (`world.fate-aspects` setting) into the current scene.

## Installation (manual, until a release is published)

Copy this repository into your Foundry data folder as:

```
FoundryVTT/Data/modules/fate-core-aspects-tracker/
```

The folder name **must** be `fate-core-aspects-tracker` (the module id). Then enable *Fate Core Aspects Tracker* in your world's module management.

## Settings

- Aspect token image (default: the bundled purple orb)
- Text label font size, font family and color
- Show/hide the scene-controls button

## API

```js
const api = game.modules.get("fate-core-aspects-tracker").api;
api.open();        // open the tracker window
api.toggle();      // toggle it
api.getAspects();  // aspects of the current scene
api.importLegacyMacroAspects(); // migrate macro data into the current scene
```

---

## Кратко по-русски

Модуль для Foundry VTT (v12–v13) для игр по **Fate Core**: трекер аспектов сцены с призывами (зелёные) и навязываниями (красные).

- Окно открывается кнопкой в панели токенов слева или горячей клавишей (по умолчанию `Alt+A`, меняется в «Настройке управления»).
- Аспекты привязаны к сцене: при переключении сцены открываются её аспекты.
- Аспект можно вытащить на стол перетаскиванием: как **текст** (без рамки) или как **токен** — у токена призывы/навязывания отображаются зелёным/красным кружком с числом, как в roll20.
- Управление призывами: ПКМ по токену/надписи аспекта (кнопки в HUD) или навести курсор и нажать `I`/`Shift+I` (призывы), `O`/`Shift+O` (навязывания).
- Изменения в окне синхронизируются с объектами на столе и обратно.
- Кнопка «Импорт из хранилища макроса» переносит аспекты, сохранённые старым макросом, в текущую сцену.

Установка: скопируйте репозиторий в `FoundryVTT/Data/modules/fate-core-aspects-tracker/` (имя папки должно совпадать с id модуля) и включите модуль в мире.
