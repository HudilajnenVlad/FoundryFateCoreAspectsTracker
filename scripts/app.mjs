/**
 * The aspect tracker window (ApplicationV2, works on Foundry v12 and v13).
 */

import {
  MODULE_ID, sortedAspects, getAspect, createAspect, adjustAspect,
  renameAspect, deleteAspect, importLegacyMacroAspects, updateAspect
} from "./data.mjs";
import { ASPECT_TYPES } from "./placement.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class AspectTrackerApp extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "fate-aspects-tracker",
    classes: ["fate-aspects-tracker"],
    window: {
      title: "FATEASPECTS.Title",
      icon: "fas fa-feather-pointed",
      resizable: true
    },
    position: { width: 460, height: 560 },
    actions: {
      addAspect: AspectTrackerApp.onAddAspect,
      addFromSelection: AspectTrackerApp.onAddFromSelection,
      adjust: AspectTrackerApp.onAdjust,
      deleteAspect: AspectTrackerApp.onDeleteAspect,
      importLegacy: AspectTrackerApp.onImportLegacy
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/tracker.hbs` }
  };

  async _prepareContext(_options) {
    const tokenTypeChoices = Object.fromEntries(
      Object.entries(ASPECT_TYPES).map(([key, t]) => [key, game.i18n.localize(t.label)])
    );
    return {
      isGM: game.user.isGM,
      sceneName: canvas?.scene?.name ?? "—",
      aspects: sortedAspects().map(a => ({ ...a, tokenType: a.tokenType ?? "aspect" })),
      tokenTypeChoices
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const html = this.element;

    // Rename via the inline name inputs
    html.querySelectorAll("input.aspect-name").forEach(input => {
      input.addEventListener("change", async ev => {
        const id = ev.currentTarget.closest("[data-aspect-id]")?.dataset.aspectId;
        const ok = await renameAspect(id, ev.currentTarget.value);
        if (!ok) ev.currentTarget.value = getAspect(id)?.name ?? "";
      });
    });

    // Token type dropdown: remembers the type and re-skins placed tokens
    html.querySelectorAll("select.aspect-type").forEach(select => {
      select.addEventListener("change", async ev => {
        const id = ev.currentTarget.closest("[data-aspect-id]")?.dataset.aspectId;
        await updateAspect(id, { tokenType: ev.currentTarget.value });
      });
    });

    // Enter in the "new aspect" field adds it
    html.querySelector("input.new-aspect-name")?.addEventListener("keydown", ev => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        this.constructor.onAddAspect.call(this, ev, ev.currentTarget);
      }
    });

    // Drag handles: place as text or as token by dragging onto the canvas
    html.querySelectorAll(".drag-handle").forEach(handle => {
      handle.addEventListener("dragstart", ev => {
        const id = ev.currentTarget.closest("[data-aspect-id]")?.dataset.aspectId;
        ev.dataTransfer.setData("text/plain", JSON.stringify({
          type: "FateAspect",
          aspectId: id,
          mode: ev.currentTarget.dataset.mode
        }));
      });
    });
  }

  /* ------------------------------------------ */
  /*  Actions                                   */
  /* ------------------------------------------ */

  static async onAddAspect(_event, _target) {
    const input = this.element.querySelector("input.new-aspect-name");
    const id = await createAspect(input?.value ?? "");
    if (id) {
      if (input) input.value = "";
      ui.notifications.info(game.i18n.format("FATEASPECTS.Notify.Added", { name: getAspect(id).name }));
    }
  }

  static async onAddFromSelection(_event, _target) {
    const selected = canvas.drawings?.controlled[0] ?? canvas.tokens?.controlled[0] ?? canvas.tiles?.controlled[0];
    if (!selected) {
      ui.notifications.error(game.i18n.localize("FATEASPECTS.Notify.NoSelection"));
      return;
    }
    const doc = selected.document;
    const name = (doc.text ?? doc.name ?? "").trim();
    if (!name) {
      ui.notifications.error(game.i18n.localize("FATEASPECTS.Notify.SelectionNoText"));
      return;
    }
    const id = await createAspect(name);
    if (id) {
      // Link the source object to the new aspect so it stays in sync
      await doc.setFlag(MODULE_ID, "aspectId", id);
      ui.notifications.info(game.i18n.format("FATEASPECTS.Notify.Added", { name }));
    }
  }

  static async onAdjust(_event, target) {
    const id = target.closest("[data-aspect-id]")?.dataset.aspectId;
    const { type, delta } = target.dataset;
    await adjustAspect(id, type, Number(delta));
  }

  static async onDeleteAspect(_event, target) {
    const id = target.closest("[data-aspect-id]")?.dataset.aspectId;
    const aspect = getAspect(id);
    if (!aspect) return;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("FATEASPECTS.ConfirmDeleteTitle") },
      content: `<p>${game.i18n.format("FATEASPECTS.ConfirmDeleteContent", { name: foundry.utils.escapeHTML?.(aspect.name) ?? aspect.name })}</p>`
    });
    if (confirmed) await deleteAspect(id);
  }

  static async onImportLegacy(_event, _target) {
    await importLegacyMacroAspects();
  }
}

/* -------------------------------------------- */
/*  Singleton access                            */
/* -------------------------------------------- */

let tracker = null;

export function getTracker() {
  if (!tracker) tracker = new AspectTrackerApp();
  return tracker;
}

export function openTracker() {
  getTracker().render({ force: true });
}

export function toggleTracker() {
  const app = getTracker();
  if (app.rendered) app.close();
  else app.render({ force: true });
}

/** Re-render the tracker if it is open. Skipped while the user is typing in it. */
export function refreshTracker() {
  if (!tracker?.rendered) return;
  const active = document.activeElement;
  if (active?.tagName === "INPUT" && tracker.element?.contains(active)) return;
  tracker.render();
}
