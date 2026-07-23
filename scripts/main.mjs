/**
 * Fate Core Aspects Tracker — module entry point.
 * https://github.com/HudilajnenVlad/FoundryFateCoreAspectsTracker
 */

import { MODULE_ID, getAspects, adjustAspect, importLegacyMacroAspects } from "./data.mjs";
import { openTracker, toggleTracker, refreshTracker } from "./app.mjs";
import {
  handleCanvasDrop, drawTokenBadges, refreshBadges, syncPlacements,
  onUpdateDrawing, onUpdateToken, targetAspectId
} from "./placement.mjs";
import { onRenderHUD } from "./hud.mjs";

/* -------------------------------------------- */
/*  Init: settings and keybindings              */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "tokenImage", {
    name: "FATEASPECTS.Settings.TokenImage.Name",
    hint: "FATEASPECTS.Settings.TokenImage.Hint",
    scope: "world",
    config: true,
    type: String,
    default: `modules/${MODULE_ID}/assets/aspect-token.svg`,
    filePicker: "image"
  });

  game.settings.register(MODULE_ID, "fontSize", {
    name: "FATEASPECTS.Settings.FontSize.Name",
    scope: "world",
    config: true,
    type: Number,
    default: 20
  });

  game.settings.register(MODULE_ID, "fontFamily", {
    name: "FATEASPECTS.Settings.FontFamily.Name",
    scope: "world",
    config: true,
    type: String,
    default: "Arial"
  });

  game.settings.register(MODULE_ID, "textColor", {
    name: "FATEASPECTS.Settings.TextColor.Name",
    scope: "world",
    config: true,
    type: String,
    default: "#000000"
  });

  game.settings.register(MODULE_ID, "showSceneControl", {
    name: "FATEASPECTS.Settings.SceneControl.Name",
    hint: "FATEASPECTS.Settings.SceneControl.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  // All hotkeys are rebindable in Configure Controls
  game.keybindings.register(MODULE_ID, "toggleTracker", {
    name: "FATEASPECTS.Keys.Toggle",
    editable: [{ key: "KeyA", modifiers: ["Alt"] }],
    onDown: () => { toggleTracker(); return true; },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  const adjustBinding = (action, type, delta, defaultKey, shift) => {
    game.keybindings.register(MODULE_ID, action, {
      name: `FATEASPECTS.Keys.${action}`,
      hint: "FATEASPECTS.Keys.TargetHint",
      editable: [{ key: defaultKey, modifiers: shift ? ["Shift"] : [] }],
      restricted: true,
      onDown: () => {
        const id = targetAspectId();
        if (!id) return false;
        adjustAspect(id, type, delta);
        return true;
      },
      precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
  };
  adjustBinding("InvokeInc", "invoke", 1, "KeyI", false);
  adjustBinding("InvokeDec", "invoke", -1, "KeyI", true);
  adjustBinding("CompelInc", "compel", 1, "KeyO", false);
  adjustBinding("CompelDec", "compel", -1, "KeyO", true);
});

/* -------------------------------------------- */
/*  Ready: public API                           */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = {
    open: openTracker,
    toggle: toggleTracker,
    getAspects,
    importLegacyMacroAspects
  };
});

/* -------------------------------------------- */
/*  Scene controls button (v12 and v13 shapes)  */
/* -------------------------------------------- */

Hooks.on("getSceneControlButtons", controls => {
  if (!game.settings.get(MODULE_ID, "showSceneControl")) return;
  const tool = {
    name: "fate-aspects",
    title: "FATEASPECTS.Control",
    icon: "fas fa-feather-pointed",
    button: true,
    visible: true,
    onClick: () => openTracker(),
    onChange: () => openTracker()
  };
  if (Array.isArray(controls)) {
    // v12: array of controls with tool arrays
    controls.find(c => c.name === "token")?.tools.push(tool);
  } else {
    // v13: record of controls with tool records
    const tokenControl = controls.tokens ?? controls.token;
    if (tokenControl) {
      tool.order = Object.keys(tokenControl.tools).length;
      tokenControl.tools[tool.name] = tool;
    }
  }
});

/* -------------------------------------------- */
/*  Canvas & document hooks                     */
/* -------------------------------------------- */

// Aspects follow the active scene: refresh the window on scene switch
Hooks.on("canvasReady", () => {
  refreshTracker();
  refreshBadges();
});

// Any change to this scene's aspect flags: refresh UI everywhere,
// and let the active GM push derived changes to placed objects.
Hooks.on("updateScene", (scene, changes) => {
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)) return;
  if (scene.id === canvas?.scene?.id) {
    refreshTracker();
    refreshBadges();
  }
  const activeGM = game.users.activeGM ?? game.users.find(u => u.isGM && u.active);
  if (activeGM?.id === game.user.id) syncPlacements(scene);
});

// Canvas objects -> data (edits made directly on the table)
Hooks.on("updateDrawing", onUpdateDrawing);
Hooks.on("updateToken", onUpdateToken);

// Keep the tracker's placement state honest when linked objects change
for (const hook of ["createDrawing", "deleteDrawing", "createToken", "deleteToken"]) {
  Hooks.on(hook, doc => {
    if (doc.getFlag(MODULE_ID, "aspectId")) refreshTracker();
  });
}

// Badges on aspect tokens
Hooks.on("refreshToken", token => {
  if (token.document.getFlag(MODULE_ID, "aspectId")) drawTokenBadges(token);
});

// Drops from the tracker window onto the canvas
Hooks.on("dropCanvasData", handleCanvasDrop);

// Quick invoke/compel controls on the HUD
Hooks.on("renderTokenHUD", onRenderHUD);
Hooks.on("renderDrawingHUD", onRenderHUD);
