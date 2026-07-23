/**
 * Token HUD / Drawing HUD extension: quick invoke/compel controls and a
 * token-type button, added as native control icons in the HUD's right
 * column so nothing overlaps the rest of the Foundry interface.
 *
 * Left-click increments a counter, right-click decrements it.
 * The type button (tokens only) cycles through the aspect types.
 */

import { MODULE_ID, getAspect, adjustAspect } from "./data.mjs";
import { ASPECT_TYPES, tokenImageForType, cycleAspectType } from "./placement.mjs";

export function onRenderHUD(hud, html) {
  if (!game.user.isGM) return;
  const doc = hud.object?.document;
  const aspectId = doc?.getFlag(MODULE_ID, "aspectId");
  if (!aspectId) return;
  const aspect = getAspect(aspectId, doc.parent);
  if (!aspect) return;

  // v12 passes jQuery, v13 passes an HTMLElement
  const root = html instanceof HTMLElement ? html : html[0];
  root.querySelectorAll(".fate-hud-btn").forEach(el => el.remove());
  const col = root.querySelector(".col.right") ?? root;

  const isToken = doc.documentName === "Token";
  const scene = doc.parent;

  const addButton = (cls, inner, tooltip, onLeft, onRight) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `control-icon fate-hud-btn ${cls}`;
    btn.innerHTML = inner;
    btn.dataset.tooltip = tooltip;
    btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); onLeft(btn); });
    if (onRight) btn.addEventListener("contextmenu", ev => { ev.preventDefault(); ev.stopPropagation(); onRight(btn); });
    col.appendChild(btn);
    return btn;
  };

  // Invokes: green counter, left-click +1 / right-click -1
  addButton(
    "fate-hud-invoke",
    `<span class="fate-hud-count invoke">${aspect.invoke || 0}</span>`,
    game.i18n.localize("FATEASPECTS.HUD.Invoke"),
    async btn => {
      const v = await adjustAspect(aspectId, "invoke", 1, scene);
      if (v !== null) btn.querySelector(".fate-hud-count").textContent = v;
    },
    async btn => {
      const v = await adjustAspect(aspectId, "invoke", -1, scene);
      if (v !== null) btn.querySelector(".fate-hud-count").textContent = v;
    }
  );

  // Compels: red counter, left-click +1 / right-click -1
  addButton(
    "fate-hud-compel",
    `<span class="fate-hud-count compel">${aspect.compel || 0}</span>`,
    game.i18n.localize("FATEASPECTS.HUD.Compel"),
    async btn => {
      const v = await adjustAspect(aspectId, "compel", 1, scene);
      if (v !== null) btn.querySelector(".fate-hud-count").textContent = v;
    },
    async btn => {
      const v = await adjustAspect(aspectId, "compel", -1, scene);
      if (v !== null) btn.querySelector(".fate-hud-count").textContent = v;
    }
  );

  // Token type: shows the current type image, click cycles to the next type
  if (isToken) {
    const typeTooltip = type => `${game.i18n.localize("FATEASPECTS.HUD.Type")}: ${game.i18n.localize(ASPECT_TYPES[type]?.label ?? "")}`;
    const current = aspect.tokenType ?? "aspect";
    addButton(
      "fate-hud-type",
      `<img src="${tokenImageForType(current)}" alt="type">`,
      typeTooltip(current),
      async btn => {
        const next = await cycleAspectType(aspectId, scene);
        if (!next) return;
        btn.querySelector("img").src = tokenImageForType(next);
        btn.dataset.tooltip = typeTooltip(next);
        game.tooltip?.deactivate?.();
      }
    );
  }
}
