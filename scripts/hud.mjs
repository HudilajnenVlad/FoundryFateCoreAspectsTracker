/**
 * Token HUD / Drawing HUD extension: quick invoke/compel controls on
 * the object placed on the canvas (right-click the token/drawing).
 */

import { MODULE_ID, getAspect, adjustAspect } from "./data.mjs";

export function onRenderHUD(hud, html) {
  if (!game.user.isGM) return;
  const doc = hud.object?.document;
  const aspectId = doc?.getFlag(MODULE_ID, "aspectId");
  if (!aspectId) return;
  const aspect = getAspect(aspectId, doc.parent);
  if (!aspect) return;

  // v12 passes jQuery, v13 passes an HTMLElement
  const root = html instanceof HTMLElement ? html : html[0];
  root.querySelector(".fate-aspect-hud")?.remove();

  const bar = document.createElement("div");
  bar.className = "fate-aspect-hud";
  bar.innerHTML = `
    <div class="fate-hud-group invoke">
      <button type="button" data-type="invoke" data-delta="-1" data-tooltip="${game.i18n.localize("FATEASPECTS.InvokeDec")}"><i class="fas fa-minus"></i></button>
      <span class="count" data-count="invoke">${aspect.invoke || 0}</span>
      <button type="button" data-type="invoke" data-delta="1" data-tooltip="${game.i18n.localize("FATEASPECTS.InvokeInc")}"><i class="fas fa-plus"></i></button>
    </div>
    <div class="fate-hud-group compel">
      <button type="button" data-type="compel" data-delta="-1" data-tooltip="${game.i18n.localize("FATEASPECTS.CompelDec")}"><i class="fas fa-minus"></i></button>
      <span class="count" data-count="compel">${aspect.compel || 0}</span>
      <button type="button" data-type="compel" data-delta="1" data-tooltip="${game.i18n.localize("FATEASPECTS.CompelInc")}"><i class="fas fa-plus"></i></button>
    </div>`;

  bar.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const { type, delta } = ev.currentTarget.dataset;
      const value = await adjustAspect(aspectId, type, Number(delta), doc.parent);
      if (value !== null) bar.querySelector(`[data-count="${type}"]`).textContent = value;
    });
  });

  root.appendChild(bar);
}
