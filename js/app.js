import { api } from "./api.js";
import {
  defaults,
  DOT_STYLES,
  CORNER_STYLES,
  ERROR_LEVELS,
  readConfigFromForm,
  applyConfigToForm,
  renderQr,
  renderQrSvg,
} from "./qr.js";
import { exportPng, exportSvg, exportPdf } from "./export.js";
import { createLogoEditor } from "./logo-editor.js";

const form = document.getElementById("qr-form");
const preview = document.getElementById("preview");
const stage = document.getElementById("canvas-stage");
const authStatus = document.getElementById("auth-status");
const saveBtn = document.getElementById("save-btn");
const logoInput = document.getElementById("logo-input");
const uploadZone = document.getElementById("upload-zone");
const clearLogoBtn = document.getElementById("clear-logo");
const centerLogoBtn = document.getElementById("center-logo");
const toastEl = document.getElementById("toast");
const snapLabel = document.getElementById("snap-label");

let user = null;
let savedQr = null;
let logoDataUrl = null;
let renderTimer = null;
let lastCanvas = null;
let lastSvg = null;
let isDraggingLogo = false;

const editId = new URLSearchParams(location.search).get("id");
const RENDER_SIZE = 512;
const positionControls = document.getElementById("position-controls");

const logoEditor = createLogoEditor({
  stage,
  guides: document.getElementById("center-guides"),
  handle: document.getElementById("logo-handle"),
  snapLabel,
  onChange: ({ offsetX, offsetY, dragging }) => {
    isDraggingLogo = dragging;
    form.logoOffsetX.value = offsetX;
    form.logoOffsetY.value = offsetY;
    updateAllRanges();
    scheduleRender(dragging);
  },
});

init();

async function init() {
  populateSelects();
  applyConfigToForm(form, defaults);
  setupTabs();
  initRangeControls();
  await refreshAuth();

  if (editId && !user) {
    location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }

  if (editId && user) await loadExisting(editId);

  bindEvents();
  scheduleRender(false);
  window.addEventListener("resize", () => {
    if (lastCanvas) logoEditor.sync(readConfigFromForm(form, logoDataUrl), lastCanvas);
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
      tab.classList.add("is-active");
      document.getElementById(`panel-${tab.dataset.tab}`)?.classList.add("is-active");
    });
  });
}

function offsetToPixels(value) {
  return Math.round((Number(value) / 100) * RENDER_SIZE * 0.5);
}

function formatOffsetLabel(axis, value) {
  const px = offsetToPixels(value);
  if (px === 0) return "Centered";
  if (axis === "x") return px > 0 ? `${px}px right of center` : `${Math.abs(px)}px left of center`;
  return px > 0 ? `${px}px below center` : `${Math.abs(px)}px above center`;
}

function updateRangeTrack(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const val = Number(input.value);
  const pct = ((val - min) / (max - min)) * 100;

  if (input.classList.contains("range--centered")) {
    const center = ((0 - min) / (max - min)) * 100;
    if (val >= 0) {
      input.style.setProperty("--range-fill-start", `${center}%`);
      input.style.setProperty("--range-fill-end", `${pct}%`);
    } else {
      input.style.setProperty("--range-fill-start", `${pct}%`);
      input.style.setProperty("--range-fill-end", `${center}%`);
    }
    return;
  }

  input.style.setProperty("--range-percent", `${pct}%`);
}

function updateRangeDisplay(input) {
  const label = document.querySelector(`[data-for="${input.name}"]`);
  const val = Number(input.value);

  if (label) {
    if (input.name === "logoSize") label.textContent = `${input.value}%`;
    else if (input.name === "logoOffsetX") label.textContent = formatOffsetLabel("x", val);
    else if (input.name === "logoOffsetY") label.textContent = formatOffsetLabel("y", val);
    else if (input.name === "logoBorderRadius") label.textContent = `${input.value}%`;
    else if (input.name === "logoBorderWidth") label.textContent = `${input.value}px`;
    else label.textContent = input.value;
  }

  input.setAttribute("aria-valuetext", label?.textContent || input.value);
  updateRangeTrack(input);
}

function initRangeControls() {
  form.querySelectorAll('input[type="range"]').forEach((input) => {
    if (input.dataset.rangeBound) return;
    input.dataset.rangeBound = "true";
    input.addEventListener("input", () => {
      updateRangeDisplay(input);
      if (input.name?.includes("Offset") && !isDraggingLogo) scheduleRender(false);
    });
    updateRangeDisplay(input);
  });
}

function updateAllRanges() {
  form.querySelectorAll('input[type="range"]').forEach(updateRangeDisplay);
}

function populateSelects() {
  fillSelect(form.dotStyle, DOT_STYLES);
  fillSelect(form.cornerSquareStyle, CORNER_STYLES);
  fillSelect(form.cornerDotStyle, CORNER_STYLES.filter((s) => s !== "classy-rounded"));
  fillSelect(form.errorCorrectionLevel, ERROR_LEVELS);
}

function fillSelect(select, options) {
  select.innerHTML = options.map((o) => `<option value="${o}">${formatLabel(o)}</option>`).join("");
}

function formatLabel(value) {
  return value.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function refreshAuth() {
  try {
    user = (await api.me()).user;
  } catch {
    user = null;
  }

  if (user) {
    authStatus.innerHTML = `
      <a href="dashboard.html" class="btn btn--ghost btn--small">My QR codes</a>
      <span class="auth-email">${user.email}</span>
      <button type="button" id="logout-btn" class="btn btn--ghost btn--small">Sign out</button>`;
    document.getElementById("logout-btn")?.addEventListener("click", handleLogout);
    saveBtn.disabled = false;
  } else {
    authStatus.innerHTML = `<a href="login.html" class="btn btn--primary btn--small">Sign in to save</a>`;
    saveBtn.disabled = true;
  }
}

async function handleLogout() {
  await api.logout();
  user = null;
  savedQr = null;
  await refreshAuth();
}

async function loadExisting(id) {
  try {
    const { qrCode } = await api.getQrCode(id);
    savedQr = qrCode;
    form.name.value = qrCode.name;
    form.targetUrl.value = qrCode.targetUrl;
    applyConfigToForm(form, qrCode.config);
    logoDataUrl = qrCode.config.logo?.dataUrl || null;
    updateUploadZone();
    saveBtn.textContent = "Save changes";
    document.title = `Edit ${qrCode.name} — QR's R Us`;
    updateAllRanges();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function bindEvents() {
  form.addEventListener("input", (e) => {
    if (e.target.type === "range" && e.target.name?.includes("Offset")) return;
    scheduleRender(false);
  });
  form.addEventListener("change", () => scheduleRender(false));

  uploadZone.addEventListener("click", () => logoInput.click());
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("is-dragover");
  });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("is-dragover"));
  uploadZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    uploadZone.classList.remove("is-dragover");
    const file = e.dataTransfer.files?.[0];
    if (file) await loadLogo(file);
  });

  logoInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (file) await loadLogo(file);
  });

  clearLogoBtn.addEventListener("click", () => {
    logoDataUrl = null;
    logoInput.value = "";
    updateUploadZone();
    scheduleRender(false);
  });

  centerLogoBtn.addEventListener("click", () => {
    form.logoOffsetX.value = 0;
    form.logoOffsetY.value = 0;
    logoEditor.center();
    updateAllRanges();
  });

  saveBtn.addEventListener("click", handleSave);
  document.getElementById("export-png").addEventListener("click", () => exportCurrent("png"));
  document.getElementById("export-svg").addEventListener("click", () => exportCurrent("svg"));
  document.getElementById("export-pdf").addEventListener("click", () => exportCurrent("pdf"));
}

async function loadLogo(file) {
  if (file.size > 500_000) return showToast("Logo must be under 500KB", "error");
  logoDataUrl = await readFileAsDataUrl(file);
  updateUploadZone();
  scheduleRender(false);
}

function updateUploadZone() {
  const hasLogo = Boolean(logoDataUrl);
  const preview = uploadZone.querySelector(".upload-zone__preview");
  const placeholder = uploadZone.querySelector(".upload-zone__placeholder");
  uploadZone.classList.toggle("has-logo", hasLogo);
  clearLogoBtn.hidden = !hasLogo;
  centerLogoBtn.hidden = !hasLogo;
  positionControls.hidden = !hasLogo;
  if (hasLogo) {
    preview.src = logoDataUrl;
    preview.hidden = false;
    placeholder.hidden = true;
  } else {
    preview.hidden = true;
    placeholder.hidden = false;
  }
}

function scheduleRender(skipLogo) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => renderPreview(skipLogo), skipLogo ? 16 : 100);
}

function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

async function renderPreview(skipLogo = false) {
  const targetUrl = normalizeUrl(form.targetUrl.value);
  stage.classList.toggle("is-empty", !targetUrl);

  if (!targetUrl) {
    preview.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon">◫</div>
      <p>Enter your website URL to begin</p>
    </div>`;
    logoEditor.sync({ logo: { dataUrl: null } }, null);
    return;
  }

  try {
    new URL(targetUrl);
  } catch {
    preview.innerHTML = `<div class="empty-state"><p>Enter a valid URL</p></div>`;
    return;
  }

  const config = readConfigFromForm(form, logoDataUrl);
  const renderConfig = skipLogo && logoDataUrl
    ? { ...config, logo: { ...config.logo, dataUrl: null } }
    : config;

  try {
    const canvas = await renderQr(targetUrl, renderConfig, RENDER_SIZE);
    lastCanvas = canvas;
    if (!isDraggingLogo) {
      lastSvg = await renderQrSvg(targetUrl, config, RENDER_SIZE);
    }

    preview.innerHTML = "";
    preview.appendChild(canvas);
    logoEditor.sync(config, canvas);
  } catch (err) {
    preview.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

async function handleSave() {
  if (!user) return (location.href = "login.html");

  const name = form.name.value.trim();
  const targetUrl = normalizeUrl(form.targetUrl.value);
  const config = readConfigFromForm(form, logoDataUrl);

  if (!name) return showToast("Give your QR code a name", "error");
  try {
    new URL(targetUrl);
  } catch {
    return showToast("Enter a valid URL", "error");
  }

  saveBtn.disabled = true;
  try {
    const payload = { name, targetUrl, config };
    if (savedQr) {
      savedQr = (await api.updateQrCode(savedQr.id, payload)).qrCode;
      showToast("Changes saved", "success");
    } else {
      savedQr = (await api.createQrCode(payload)).qrCode;
      history.replaceState(null, "", `?id=${savedQr.id}`);
      saveBtn.textContent = "Save changes";
      showToast("QR code saved to your account", "success");
    }
    await renderPreview(false);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    saveBtn.disabled = false;
  }
}

async function exportCurrent(format) {
  if (!lastCanvas) return showToast("Create a QR code first", "error");
  const name = (form.name.value.trim() || "qr-code").replace(/[^a-z0-9-_]+/gi, "-");
  if (format === "png") await exportPng(lastCanvas, `${name}.png`);
  if (format === "svg" && lastSvg) exportSvg(lastSvg, `${name}.svg`);
  if (format === "pdf") await exportPdf(lastCanvas, `${name}.pdf`);
  showToast(`Downloaded ${format.toUpperCase()}`, "success");
}

function showToast(text, type = "info") {
  toastEl.textContent = text;
  toastEl.className = `toast toast--${type} is-visible`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove("is-visible"), 3200);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
