const SNAP_THRESHOLD = 5;

export function createLogoEditor({ stage, handle, guides, snapLabel, onChange }) {
  let dragging = false;
  let dragOffset = { x: 0, y: 0 };
  let canvas = null;

  handle.addEventListener("pointerdown", (e) => {
    if (handle.hidden) return;
    e.preventDefault();
    dragging = true;
    handle.classList.add("is-dragging");
    stage.classList.add("is-editing");
    const rect = handle.getBoundingClientRect();
    dragOffset.x = e.clientX - (rect.left + rect.width / 2);
    dragOffset.y = e.clientY - (rect.top + rect.height / 2);
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", finishDrag);
  handle.addEventListener("pointercancel", finishDrag);

  function onPointerMove(e) {
    if (!dragging || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = e.clientX - dragOffset.x - rect.left;
    const centerY = e.clientY - dragOffset.y - rect.top;

    let offsetX = Math.round(((centerX / rect.width) - 0.5) * 100);
    let offsetY = Math.round(((centerY / rect.height) - 0.5) * 100);
    offsetX = clamp(offsetX, -50, 50);
    offsetY = clamp(offsetY, -50, 50);

    const snapped = {
      x: Math.abs(offsetX) <= SNAP_THRESHOLD,
      y: Math.abs(offsetY) <= SNAP_THRESHOLD,
    };
    if (snapped.x) offsetX = 0;
    if (snapped.y) offsetY = 0;

    showGuides(snapped);
    placeHandle(offsetX, offsetY, parseFloat(handle.dataset.logoSize), parseFloat(handle.dataset.borderPad));
    onChange({ offsetX, offsetY, dragging: true });
  }

  function finishDrag() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("is-dragging");
    stage.classList.remove("is-editing");
    hideGuides();

    const offsetX = Number(handle.dataset.offsetX || 0);
    const offsetY = Number(handle.dataset.offsetY || 0);
    if (snapLabel && offsetX === 0 && offsetY === 0) {
      snapLabel.textContent = "Snapped to center";
      snapLabel.hidden = false;
      setTimeout(() => { snapLabel.hidden = true; }, 800);
    }
    onChange({ offsetX, offsetY, dragging: false });
  }

  function placeHandle(offsetX, offsetY, logoSize, borderPad) {
    if (!canvas) return;
    const stageRect = stage.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const pad = borderPad || 0;
    const total = logoSize + pad * 2;
    const centerX = 0.5 + (offsetX / 100) * 0.5;
    const centerY = 0.5 + (offsetY / 100) * 0.5;

    const w = total * canvasRect.width;
    const h = total * canvasRect.height;
    const left = canvasRect.left - stageRect.left + (centerX - total / 2) * canvasRect.width;
    const top = canvasRect.top - stageRect.top + (centerY - total / 2) * canvasRect.height;

    handle.style.width = `${w}px`;
    handle.style.height = `${h}px`;
    handle.style.left = `${left}px`;
    handle.style.top = `${top}px`;
    handle.dataset.offsetX = offsetX;
    handle.dataset.offsetY = offsetY;
  }

  function placeGuides() {
    if (!canvas) return;
    const stageRect = stage.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    guides.style.left = `${canvasRect.left - stageRect.left}px`;
    guides.style.top = `${canvasRect.top - stageRect.top}px`;
    guides.style.width = `${canvasRect.width}px`;
    guides.style.height = `${canvasRect.height}px`;
  }

  function showGuides(snapped) {
    placeGuides();
    guides.classList.add("is-visible");
    guides.classList.toggle("is-snapped", snapped.x || snapped.y);
    if (snapLabel) {
      snapLabel.hidden = !(snapped.x && snapped.y);
      if (!snapLabel.hidden) snapLabel.textContent = "Snapped to center";
    }
  }

  function hideGuides() {
    guides.classList.remove("is-visible", "is-snapped");
  }

  return {
    sync(config, canvasEl) {
      canvas = canvasEl;
      if (!config.logo?.dataUrl || !canvas) {
        handle.hidden = true;
        hideGuides();
        return;
      }

      handle.hidden = false;
      handle.querySelector("img").src = config.logo.dataUrl;
      handle.dataset.logoSize = config.logo.size;
      handle.dataset.borderPad = (config.logo.borderWidth || 0) / canvas.width;
      handle.style.borderRadius = `${config.logo.borderRadius * 100}%`;

      const offsetX = Math.round(config.logo.offsetX * 100);
      const offsetY = Math.round(config.logo.offsetY * 100);
      placeHandle(offsetX, offsetY, config.logo.size, (config.logo.borderWidth || 0) / canvas.width);
      placeGuides();
    },

    center() {
      onChange({ offsetX: 0, offsetY: 0, dragging: false });
      if (snapLabel) {
        snapLabel.textContent = "Centered";
        snapLabel.hidden = false;
        setTimeout(() => { snapLabel.hidden = true; }, 800);
      }
    },
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
