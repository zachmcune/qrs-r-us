import { api } from "./api.js";
import { renderQr } from "./qr.js";

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
        thumb.appendChild(await renderQr(qr.targetUrl, qr.config, 120));
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
