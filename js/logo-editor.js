const SNAP_THRESHOLD = 5;

function normalizeQrRegion(region, canvas) {
  if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };
  if (!region) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  const width = region.width ?? region.size ?? canvas.width;
  const height = region.height ?? region.size ?? canvas.height;
  return {
    x: region.x ?? 0,
    y: region.y ?? 0,
    width,
    height,
  };
}

export function createLogoEditor({ stage, handle, guides, snapLabel, onChange }) {
  let dragging = false;
  let dragOffset = { x: 0, y: 0 };
  let canvas = null;
  let qrRegion = null;
  let lastLogo = null;

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

    const rect = getQrScreenRect();
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
    const borderPad = parseFloat(handle.dataset.borderPad);
    placeHandle(offsetX, offsetY, parseFloat(handle.dataset.logoSize), borderPad);
    if (lastLogo) applyHandleBorder(lastLogo, borderPad);
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

  function getQrScreenRect() {
    if (!canvas) return { left: 0, top: 0, width: 0, height: 0 };
    const canvasRect = canvas.getBoundingClientRect();
    const region = normalizeQrRegion(qrRegion, canvas);
    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;
    return {
      left: canvasRect.left + region.x * scaleX,
      top: canvasRect.top + region.y * scaleY,
      width: region.width * scaleX,
      height: region.height * scaleY,
    };
  }

  function placeHandle(offsetX, offsetY, logoSize, borderPad) {
    if (!canvas) return;
    const stageRect = stage.getBoundingClientRect();
    const qrRect = getQrScreenRect();
    const pad = borderPad || 0;
    const total = logoSize + pad * 2;
    const centerX = 0.5 + (offsetX / 100) * 0.5;
    const centerY = 0.5 + (offsetY / 100) * 0.5;

    const w = total * qrRect.width;
    const h = total * qrRect.height;
    const left = qrRect.left - stageRect.left + (centerX - total / 2) * qrRect.width;
    const top = qrRect.top - stageRect.top + (centerY - total / 2) * qrRect.height;

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
    const qrRect = getQrScreenRect();
    guides.style.left = `${qrRect.left - stageRect.left}px`;
    guides.style.top = `${qrRect.top - stageRect.top}px`;
    guides.style.width = `${qrRect.width}px`;
    guides.style.height = `${qrRect.height}px`;
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

  function applyHandleBorder(logo, borderPad) {
    const img = handle.querySelector("img");
    const qrRect = getQrScreenRect();
    const borderPx = Math.max(0, borderPad * qrRect.width);

    if (borderPx > 0) {
      handle.style.backgroundColor = logo.borderColor || "#ffffff";
      handle.style.border = "none";
      img.style.position = "absolute";
      img.style.left = `${borderPx}px`;
      img.style.top = `${borderPx}px`;
      img.style.width = `calc(100% - ${borderPx * 2}px)`;
      img.style.height = `calc(100% - ${borderPx * 2}px)`;
    } else {
      handle.style.backgroundColor = "transparent";
      handle.style.border = "none";
      img.style.position = "";
      img.style.left = "";
      img.style.top = "";
      img.style.width = "100%";
      img.style.height = "100%";
    }
  }

  return {
    sync(config, canvasEl, region = null) {
      canvas = canvasEl;
      qrRegion = region;
      const normalized = normalizeQrRegion(region, canvasEl);
      const qrWidth = normalized.width || 1;
      if (!config.logo?.dataUrl || !canvas) {
        handle.hidden = true;
        hideGuides();
        return;
      }

      lastLogo = config.logo;
      handle.hidden = false;
      const img = handle.querySelector("img");
      img.src = config.logo.dataUrl;
      handle.dataset.logoSize = config.logo.size;
      handle.dataset.borderPad = (config.logo.borderWidth || 0) / qrWidth;
      handle.style.borderRadius = `${config.logo.borderRadius * 100}%`;

      const offsetX = Math.round(config.logo.offsetX * 100);
      const offsetY = Math.round(config.logo.offsetY * 100);
      const borderPad = (config.logo.borderWidth || 0) / qrWidth;
      placeHandle(offsetX, offsetY, config.logo.size, borderPad);
      applyHandleBorder(config.logo, borderPad);
      placeGuides();
    },

    center() {
      placeHandle(0, 0, parseFloat(handle.dataset.logoSize), parseFloat(handle.dataset.borderPad));
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
