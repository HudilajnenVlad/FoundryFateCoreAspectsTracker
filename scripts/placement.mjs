/**
 * Canvas placement: creating text drawings and tokens for aspects,
 * drawing invoke/compel badges on tokens, and two-way sync between
 * placed objects and the aspect data.
 */

import {
  MODULE_ID, getAspect, getAspects, buildAspectText, parseAspectText, updateAspect
} from "./data.mjs";

const BADGE_CONTAINER = "fate-aspect-badges";

/* -------------------------------------------- */
/*  Placement (drop from the tracker window)    */
/* -------------------------------------------- */

/** Handle "dropCanvasData" for our drag payloads. */
export function handleCanvasDrop(_canvas, data) {
  if (data?.type !== "FateAspect") return true;
  const { aspectId, mode, x, y } = data;
  if (mode === "token") placeAspectToken(aspectId, x, y);
  else placeAspectDrawing(aspectId, x, y);
  return false;
}

/** Create a clean text drawing (no stroke, no fill) for an aspect. */
export async function placeAspectDrawing(aspectId, x, y, scene = canvas?.scene) {
  const aspect = getAspect(aspectId, scene);
  if (!aspect) return;

  const fontSize = game.settings.get(MODULE_ID, "fontSize");
  const fontFamily = game.settings.get(MODULE_ID, "fontFamily");
  const textColor = game.settings.get(MODULE_ID, "textColor");
  const text = buildAspectText(aspect);

  // Measure the text so the drawing box fits it without visual clutter
  let width = 300;
  try {
    const metrics = PIXI.TextMetrics.measureText(text, new PIXI.TextStyle({ fontFamily, fontSize }));
    width = Math.ceil(metrics.width) + 30;
  } catch (e) {
    width = Math.max(220, Math.ceil(text.length * fontSize * 0.62) + 30);
  }
  const height = Math.ceil(fontSize * 2);

  try {
    await scene.createEmbeddedDocuments("Drawing", [{
      author: game.user.id,
      x: x - width / 2,
      y: y - height / 2,
      sort: 100,
      text,
      fontSize,
      fontFamily,
      textColor,
      textAlpha: 1,
      fillType: CONST.DRAWING_FILL_TYPES.NONE,
      fillAlpha: 0,
      strokeWidth: 0,
      strokeAlpha: 0,
      strokeColor: "#000000",
      hidden: false,
      locked: false,
      shape: { type: foundry.data.ShapeData.TYPES.RECTANGLE, width, height },
      flags: { [MODULE_ID]: { aspectId } }
    }]);
    ui.notifications.info(game.i18n.format("FATEASPECTS.Notify.Placed", { name: aspect.name }));
  } catch (e) {
    console.error(`${MODULE_ID} |`, e);
    ui.notifications.error(game.i18n.localize("FATEASPECTS.Notify.PlaceFailed"));
  }
}

/** Create an actorless token for an aspect. Badges are drawn on refresh. */
export async function placeAspectToken(aspectId, x, y, scene = canvas?.scene) {
  const aspect = getAspect(aspectId, scene);
  if (!aspect) return;
  const size = scene.grid.size ?? 100;
  try {
    await scene.createEmbeddedDocuments("Token", [{
      name: aspect.name,
      texture: { src: game.settings.get(MODULE_ID, "tokenImage") },
      x: x - size / 2,
      y: y - size / 2,
      width: 1,
      height: 1,
      displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
      disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
      lockRotation: true,
      flags: { [MODULE_ID]: { aspectId } }
    }]);
    ui.notifications.info(game.i18n.format("FATEASPECTS.Notify.Placed", { name: aspect.name }));
  } catch (e) {
    console.error(`${MODULE_ID} |`, e);
    ui.notifications.error(game.i18n.localize("FATEASPECTS.Notify.PlaceFailed"));
  }
}

/* -------------------------------------------- */
/*  Token badges (roll20-style status circles)  */
/* -------------------------------------------- */

/**
 * Draw invoke (green) / compel (red) count badges in the token's
 * top-right corner. Called from the "refreshToken" hook.
 */
export function drawTokenBadges(token) {
  const doc = token.document;
  const aspectId = doc.getFlag(MODULE_ID, "aspectId");

  const aspect = aspectId ? getAspect(aspectId, doc.parent) : null;
  const state = aspect ? `${aspect.invoke || 0}/${aspect.compel || 0}/${token.w}` : "none";
  if (token._fateBadgeState === state && token.children.some(c => c.name === BADGE_CONTAINER)) return;
  token._fateBadgeState = state;

  // Remove any previous badges
  for (const child of token.children.filter(c => c.name === BADGE_CONTAINER)) {
    child.destroy({ children: true });
  }
  if (!aspect) return;

  const entries = [];
  if (aspect.invoke > 0) entries.push({ count: aspect.invoke, color: 0x2e9e3f });
  if (aspect.compel > 0) entries.push({ count: aspect.compel, color: 0xd42a2a });
  if (!entries.length) return;

  const container = new PIXI.Container();
  container.name = BADGE_CONTAINER;
  container.eventMode = "none";

  const r = Math.max(9, Math.min(18, token.w * 0.16));
  let cx = token.w - r - 2 - (entries.length - 1) * (2 * r + 2);
  const cy = r + 2;

  for (const { count, color } of entries) {
    const g = new PIXI.Graphics();
    g.lineStyle(Math.max(1.5, r * 0.12), 0xffffff, 0.9);
    g.beginFill(color, 0.95);
    g.drawCircle(cx, cy, r);
    g.endFill();
    container.addChild(g);

    const label = new PIXI.Text(String(count), {
      fontFamily: "Arial",
      fontSize: Math.round(r * 1.3),
      fontWeight: "bold",
      fill: 0xffffff
    });
    label.resolution = 4;
    label.anchor.set(0.5);
    label.position.set(cx, cy);
    container.addChild(label);

    cx += 2 * r + 2;
  }

  token.addChild(container);
}

/** Redraw badges on every aspect token of the active canvas. */
export function refreshBadges() {
  if (!canvas?.ready) return;
  for (const token of canvas.tokens?.placeables ?? []) {
    if (token.document.getFlag(MODULE_ID, "aspectId")) {
      token._fateBadgeState = null;
      drawTokenBadges(token);
    }
  }
}

/* -------------------------------------------- */
/*  Sync: aspect data -> placed objects         */
/* -------------------------------------------- */

/**
 * Bring every placed drawing/token of the scene in line with the aspect data.
 * Runs on the active GM client only (called from the updateScene hook).
 */
export async function syncPlacements(scene) {
  const aspects = getAspects(scene);

  const drawingUpdates = [];
  for (const d of scene.drawings) {
    const id = d.getFlag(MODULE_ID, "aspectId");
    if (!id || !aspects[id]) continue;
    const text = buildAspectText(aspects[id]);
    if (d.text !== text) drawingUpdates.push({ _id: d.id, text });
  }
  if (drawingUpdates.length) await scene.updateEmbeddedDocuments("Drawing", drawingUpdates);

  const tokenUpdates = [];
  for (const t of scene.tokens) {
    const id = t.getFlag(MODULE_ID, "aspectId");
    if (!id || !aspects[id]) continue;
    if (t.name !== aspects[id].name) tokenUpdates.push({ _id: t.id, name: aspects[id].name });
  }
  if (tokenUpdates.length) await scene.updateEmbeddedDocuments("Token", tokenUpdates);
}

/* -------------------------------------------- */
/*  Sync: placed objects -> aspect data         */
/* -------------------------------------------- */

/** User edited a linked drawing's text directly on the canvas. */
export async function onUpdateDrawing(doc, changes, _options, userId) {
  if (game.user.id !== userId || !game.user.isGM) return;
  if (changes.text === undefined) return;
  const aspectId = doc.getFlag(MODULE_ID, "aspectId");
  if (!aspectId) return;
  const aspect = getAspect(aspectId, doc.parent);
  if (!aspect) return;

  const parsed = parseAspectText(changes.text);
  if (!parsed.name) return;
  if (parsed.name === aspect.name && parsed.invoke === aspect.invoke && parsed.compel === aspect.compel) return;

  await updateAspect(aspectId, parsed, doc.parent);
}

/** User renamed a linked token directly on the canvas. */
export async function onUpdateToken(doc, changes, _options, userId) {
  if (game.user.id !== userId || !game.user.isGM) return;
  if (changes.name === undefined) return;
  const aspectId = doc.getFlag(MODULE_ID, "aspectId");
  if (!aspectId) return;
  const aspect = getAspect(aspectId, doc.parent);
  if (!aspect || changes.name === aspect.name || !changes.name.trim()) return;

  await updateAspect(aspectId, { name: changes.name.trim() }, doc.parent);
}

/* -------------------------------------------- */
/*  Keybinding target resolution                */
/* -------------------------------------------- */

/** Find the aspect targeted by hover/selection on the canvas (roll20-style). */
export function targetAspectId() {
  const candidates = [
    canvas.tokens?.hover?.document,
    ...(canvas.tokens?.controlled ?? []).map(t => t.document),
    canvas.drawings?.hover?.document,
    ...(canvas.drawings?.controlled ?? []).map(d => d.document)
  ];
  for (const doc of candidates) {
    const id = doc?.getFlag?.(MODULE_ID, "aspectId");
    if (id && getAspect(id, doc.parent)) return id;
  }
  return null;
}
