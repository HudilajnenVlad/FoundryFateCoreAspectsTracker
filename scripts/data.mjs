/**
 * Data layer: aspects are stored per-scene in scene flags.
 * Shape: scene.flags["fate-core-aspects-tracker"].aspects = {
 *   [id]: { name, invoke, compel, timestamp }
 * }
 * Placed drawings/tokens carry flags["fate-core-aspects-tracker"].aspectId
 * linking them back to their aspect.
 */

export const MODULE_ID = "fate-core-aspects-tracker";

/* -------------------------------------------- */
/*  Reading                                     */
/* -------------------------------------------- */

export function getAspects(scene = canvas?.scene) {
  if (!scene) return {};
  return foundry.utils.deepClone(scene.getFlag(MODULE_ID, "aspects") ?? {});
}

export function getAspect(id, scene = canvas?.scene) {
  return getAspects(scene)[id] ?? null;
}

export function sortedAspects(scene = canvas?.scene) {
  return Object.entries(getAspects(scene))
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/** The derived canvas text for an aspect: "Name ++ -" */
export function buildAspectText(aspect) {
  let text = aspect.name;
  if (aspect.invoke > 0) text += ` ${"+".repeat(aspect.invoke)}`;
  if (aspect.compel > 0) text += ` ${"-".repeat(aspect.compel)}`;
  return text;
}

/** Parse canvas text back into { name, invoke, compel }. */
export function parseAspectText(text) {
  const m = String(text ?? "").trim().match(/^(.*?)\s*(\++)?\s*(-+)?$/);
  return {
    name: (m?.[1] ?? "").trim(),
    invoke: (m?.[2] ?? "").length,
    compel: (m?.[3] ?? "").length
  };
}

/* -------------------------------------------- */
/*  Writing                                     */
/* -------------------------------------------- */

export async function createAspect(name, scene = canvas?.scene) {
  if (!scene) return null;
  name = name.trim();
  if (!name) {
    ui.notifications.error(game.i18n.localize("FATEASPECTS.Notify.EmptyName"));
    return null;
  }
  const existing = Object.values(getAspects(scene));
  if (existing.some(a => a.name === name)) {
    ui.notifications.error(game.i18n.format("FATEASPECTS.Notify.Exists", { name }));
    return null;
  }
  const id = foundry.utils.randomID();
  await scene.update({
    [`flags.${MODULE_ID}.aspects.${id}`]: { name, invoke: 0, compel: 0, timestamp: Date.now() }
  });
  return id;
}

/** Merge partial changes into an aspect. */
export async function updateAspect(id, changes, scene = canvas?.scene) {
  if (!scene || !getAspect(id, scene)) return;
  await scene.update({ [`flags.${MODULE_ID}.aspects.${id}`]: changes });
}

/** Adjust invoke/compel by delta, clamped at 0. Returns the new value. */
export async function adjustAspect(id, type, delta, scene = canvas?.scene) {
  const aspect = getAspect(id, scene);
  if (!aspect || !["invoke", "compel"].includes(type)) return null;
  const value = Math.max(0, (aspect[type] || 0) + delta);
  if (value === aspect[type]) return value;
  await updateAspect(id, { [type]: value }, scene);
  return value;
}

export async function renameAspect(id, newName, scene = canvas?.scene) {
  const aspect = getAspect(id, scene);
  if (!aspect) return false;
  newName = newName.trim();
  if (!newName) {
    ui.notifications.error(game.i18n.localize("FATEASPECTS.Notify.EmptyName"));
    return false;
  }
  if (newName === aspect.name) return true;
  const duplicate = Object.entries(getAspects(scene)).some(([i, a]) => i !== id && a.name === newName);
  if (duplicate) {
    ui.notifications.error(game.i18n.format("FATEASPECTS.Notify.Exists", { name: newName }));
    return false;
  }
  await updateAspect(id, { name: newName, timestamp: Date.now() }, scene);
  return true;
}

/** Delete an aspect and every drawing/token placed for it. */
export async function deleteAspect(id, scene = canvas?.scene) {
  const aspect = getAspect(id, scene);
  if (!aspect) return;

  const drawingIds = scene.drawings.filter(d => d.getFlag(MODULE_ID, "aspectId") === id).map(d => d.id);
  if (drawingIds.length) await scene.deleteEmbeddedDocuments("Drawing", drawingIds);
  const tokenIds = scene.tokens.filter(t => t.getFlag(MODULE_ID, "aspectId") === id).map(t => t.id);
  if (tokenIds.length) await scene.deleteEmbeddedDocuments("Token", tokenIds);

  await scene.update({ [`flags.${MODULE_ID}.aspects.-=${id}`]: null });
  ui.notifications.info(game.i18n.format("FATEASPECTS.Notify.Deleted", { name: aspect.name }));
}

/* -------------------------------------------- */
/*  Migration from the old macro                */
/* -------------------------------------------- */

/** Import aspects from the legacy macro's world setting "world.fate-aspects" into the current scene. */
export async function importLegacyMacroAspects(scene = canvas?.scene) {
  if (!scene) return;
  if (!game.settings.settings.has("world.fate-aspects")) {
    game.settings.register("world", "fate-aspects", {
      name: "Fate Aspects (legacy macro storage)",
      scope: "world",
      config: false,
      type: Object,
      default: {}
    });
  }
  const legacy = game.settings.get("world", "fate-aspects") || {};
  const names = new Set(Object.values(getAspects(scene)).map(a => a.name));
  const updates = {};
  let count = 0;
  for (const [name, data] of Object.entries(legacy)) {
    if (names.has(name)) continue;
    const id = foundry.utils.randomID();
    updates[`flags.${MODULE_ID}.aspects.${id}`] = {
      name,
      invoke: data.invoke || 0,
      compel: data.compel || 0,
      timestamp: data.timestamp || Date.now()
    };
    count++;
  }
  if (!count) {
    ui.notifications.warn(game.i18n.localize("FATEASPECTS.Notify.NoLegacy"));
    return;
  }
  await scene.update(updates);
  ui.notifications.info(game.i18n.format("FATEASPECTS.Notify.Imported", { count }));
}
