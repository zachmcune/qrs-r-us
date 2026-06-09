import { api } from "./api.js";
import { renderQr, normalizeConfig, defaults } from "./qr.js";
import { composeCard, getCardContentBounds, isCardEnabled } from "./card.js";
import { getTemplate } from "./templates.js";

const THUMB_SIZE = 120;
const THUMB_CARD_QR_SIZE = 140;

const listEl = document.getElementById("qr-list");
const emptyEl = document.getElementById("empty-state");
const authStatus = document.getElementById("auth-status");

init();

async function init() {
  let user;
  try {
    user = (await api.me()).user;
  } catch {
    user = null;
  }

  if (!user) {
    location.href = "login.html?next=dashboard.html";
    return;
  }

  authStatus.innerHTML = `
    <a href="index.html" class="btn btn--ghost btn--small">Create</a>
    <span class="auth-email">${user.email}</span>
    <button type="button" id="logout-btn" class="btn btn--ghost btn--small">Sign out</button>`;
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await api.logout();
    location.href = "index.html";
  });

  await loadQrCodes();
}

async function loadQrCodes() {
  try {
    const { qrCodes } = await api.listQrCodes();
    if (!qrCodes.length) {
      emptyEl.hidden = false;
      listEl.innerHTML = "";
      return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = "";

    for (const qr of qrCodes) {
      const card = document.createElement("article");
      card.className = "qr-card";

      const thumb = document.createElement("div");
      thumb.className = "qr-card__thumb";
      try {
        thumb.appendChild(await renderThumb(qr.targetUrl, qr.config));
      } catch {
        thumb.textContent = "Preview unavailable";
      }

      card.innerHTML = `
        <div class="qr-card__body">
          <h2>${escapeHtml(qr.name)}</h2>
          <p class="muted">${escapeHtml(qr.targetUrl)}</p>
        </div>
        <div class="qr-card__actions">
          <a class="btn btn--ghost" href="index.html?id=${qr.id}">Edit</a>
          <button type="button" class="btn btn--danger" data-delete="${qr.id}">Delete</button>
        </div>
      `;

      card.insertBefore(thumb, card.firstChild);
      listEl.appendChild(card);
    }

    listEl.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => deleteQr(btn.dataset.delete));
    });
  } catch (err) {
    listEl.innerHTML = `<p class="message message--error">${escapeHtml(err.message)}</p>`;
  }
}

function prepareConfig(raw) {
  const normalized = normalizeConfig({ ...raw });
  const card = normalized.card
    ? { ...defaults.card, ...normalized.card }
    : { ...defaults.card, enabled: false, template: "none" };

  return {
    ...defaults,
    ...normalized,
    card,
    logo: { ...defaults.logo, ...normalized.logo },
  };
}

function cropAndFillSquare(source, crop, size, backdrop = "#14141a") {
  const thumb = document.createElement("canvas");
  thumb.width = size;
  thumb.height = size;
  const ctx = thumb.getContext("2d");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, size, size);

  const scale = Math.max(size / crop.width, size / crop.height);
  const w = crop.width * scale;
  const h = crop.height * scale;
  ctx.drawImage(
    source,
    crop.x, crop.y, crop.width, crop.height,
    (size - w) / 2, (size - h) / 2, w, h
  );
  return thumb;
}

async function renderThumb(targetUrl, rawConfig) {
  const config = prepareConfig(rawConfig);
  const cardActive = isCardEnabled(config.card);
  const backdrop = cardActive
    ? getTemplate(config.card.template).palette?.base || config.backgroundColor
    : config.backgroundColor;

  if (!cardActive) {
    const qrCanvas = await renderQr(targetUrl, config, THUMB_SIZE);
    return cropAndFillSquare(
      qrCanvas,
      { x: 0, y: 0, width: qrCanvas.width, height: qrCanvas.height },
      THUMB_SIZE,
      backdrop
    );
  }

  const qrCanvas = await renderQr(targetUrl, config, THUMB_CARD_QR_SIZE);
  const composed = composeCard(qrCanvas, config);
  const crop = getCardContentBounds(composed.layout, config.card);
  return cropAndFillSquare(composed.canvas, crop, THUMB_SIZE, backdrop);
}

async function deleteQr(id) {
  if (!confirm("Delete this QR code?")) return;
  try {
    await api.deleteQrCode(id);
    await loadQrCodes();
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
