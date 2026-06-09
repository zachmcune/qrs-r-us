import QRCodeStyling from "https://cdn.jsdelivr.net/npm/qr-code-styling@1.9.2/+esm";
import { getLogoSrc } from "./logo-utils.js";

const DOT_STYLES = ["square", "dots", "rounded", "extra-rounded", "classy", "classy-rounded"];
const CORNER_STYLES = ["square", "dot", "extra-rounded"];
const ERROR_LEVELS = ["L", "M", "Q", "H"];

export const defaults = {
  foregroundColor: "#1a1a2e",
  backgroundColor: "#ffffff",
  dotStyle: "rounded",
  cornerSquareStyle: "extra-rounded",
  cornerDotStyle: "dot",
  errorCorrectionLevel: "H",
  logo: {
    logoId: null,
    url: null,
    size: 0.22,
    offsetX: 0,
    offsetY: 0,
    borderWidth: 6,
    borderColor: "#ffffff",
    borderRadius: 0.2,
  },
};

export { DOT_STYLES, CORNER_STYLES, ERROR_LEVELS };

function buildQrInstance(data, config, size = 512) {
  const qr = new QRCodeStyling({
    width: size,
    height: size,
    type: "canvas",
    data,
    margin: 8,
    qrOptions: {
      typeNumber: 0,
      mode: "Byte",
      errorCorrectionLevel: config.errorCorrectionLevel,
    },
    dotsOptions: {
      type: config.dotStyle,
      color: config.foregroundColor,
    },
    cornersSquareOptions: {
      type: config.cornerSquareStyle,
      color: config.foregroundColor,
    },
    cornersDotOptions: {
      type: config.cornerDotStyle,
      color: config.foregroundColor,
    },
    backgroundOptions: {
      color: config.backgroundColor,
    },
  });
  return qr;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function qrBaseCanvas(data, config, size) {
  const qr = buildQrInstance(data, config, size);
  const blob = await qr.getRawData("png");
  if (!blob) throw new Error("Failed to render QR code");

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, size, size);
  return canvas;
}

async function drawLogoOnCanvas(canvas, config) {
  const { logo } = config;
  const logoSrc = getLogoSrc(logo);
  if (!logoSrc) return canvas;

  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const logoSize = size * logo.size;
  const centerX = size / 2 + logo.offsetX * size * 0.5;
  const centerY = size / 2 + logo.offsetY * size * 0.5;
  const x = centerX - logoSize / 2;
  const y = centerY - logoSize / 2;
  const radius = logoSize * logo.borderRadius;

  const img = await loadImage(logoSrc);

  if (logo.borderWidth > 0) {
    const pad = logo.borderWidth;
    drawRoundedRect(ctx, x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, radius + pad);
    ctx.fillStyle = logo.borderColor;
    ctx.fill();
  }

  ctx.save();
  drawRoundedRect(ctx, x, y, logoSize, logoSize, radius);
  ctx.clip();
  ctx.drawImage(img, x, y, logoSize, logoSize);
  ctx.restore();

  return canvas;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderQr(data, config, size = 512) {
  const base = await qrBaseCanvas(data, config, size);
  const composed = document.createElement("canvas");
  composed.width = base.width;
  composed.height = base.height;
  const ctx = composed.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0);
  return drawLogoOnCanvas(composed, config);
}

export async function renderQrSvg(data, config, size = 512) {
  const qr = new QRCodeStyling({
    width: size,
    height: size,
    type: "svg",
    data,
    margin: 8,
    qrOptions: {
      typeNumber: 0,
      mode: "Byte",
      errorCorrectionLevel: config.errorCorrectionLevel,
    },
    dotsOptions: { type: config.dotStyle, color: config.foregroundColor },
    cornersSquareOptions: { type: config.cornerSquareStyle, color: config.foregroundColor },
    cornersDotOptions: { type: config.cornerDotStyle, color: config.foregroundColor },
    backgroundOptions: { color: config.backgroundColor },
  });

  const blob = await qr.getRawData("svg");
  if (!blob) throw new Error("Failed to render SVG");
  const markup = await blob.text();
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  let svg = doc.documentElement;
  if (svg.querySelector("parsererror")) throw new Error("Failed to render SVG");

  const logoSrc = getLogoSrc(config.logo);
  if (logoSrc) {
    const { logo } = config;
    const logoSize = size * logo.size;
    const centerX = size / 2 + logo.offsetX * size * 0.5;
    const centerY = size / 2 + logo.offsetY * size * 0.5;
    const x = centerX - logoSize / 2;
    const y = centerY - logoSize / 2;
    const r = logoSize * logo.borderRadius;

    const clone = svg.cloneNode(true);
    const ns = "http://www.w3.org/2000/svg";

    if (logo.borderWidth > 0) {
      const border = document.createElementNS(ns, "rect");
      const pad = logo.borderWidth;
      border.setAttribute("x", x - pad);
      border.setAttribute("y", y - pad);
      border.setAttribute("width", logoSize + pad * 2);
      border.setAttribute("height", logoSize + pad * 2);
      border.setAttribute("rx", r + pad);
      border.setAttribute("fill", logo.borderColor);
      clone.appendChild(border);
    }

    const clipId = `logo-clip-${Date.now()}`;
    const defs = document.createElementNS(ns, "defs");
    const clip = document.createElementNS(ns, "clipPath");
    clip.setAttribute("id", clipId);
    const clipRect = document.createElementNS(ns, "rect");
    clipRect.setAttribute("x", x);
    clipRect.setAttribute("y", y);
    clipRect.setAttribute("width", logoSize);
    clipRect.setAttribute("height", logoSize);
    clipRect.setAttribute("rx", r);
    clip.appendChild(clipRect);
    defs.appendChild(clip);
    clone.insertBefore(defs, clone.firstChild);

    const image = document.createElementNS(ns, "image");
    image.setAttribute("href", logoSrc);
    image.setAttribute("x", x);
    image.setAttribute("y", y);
    image.setAttribute("width", logoSize);
    image.setAttribute("height", logoSize);
    image.setAttribute("clip-path", `url(#${clipId})`);
    clone.appendChild(image);

    svg = clone;
  }

  return svg;
}

export function readConfigFromForm(form, logoPreviewSrc = null, logoId = null) {
  return {
    foregroundColor: form.foregroundColor.value,
    backgroundColor: form.backgroundColor.value,
    dotStyle: form.dotStyle.value,
    cornerSquareStyle: form.cornerSquareStyle.value,
    cornerDotStyle: form.cornerDotStyle.value,
    errorCorrectionLevel: form.errorCorrectionLevel.value,
    logo: {
      logoId,
      url: logoPreviewSrc || (logoId ? `/api/logos/${logoId}` : null),
      size: Number(form.logoSize.value) / 100,
      offsetX: Number(form.logoOffsetX.value) / 100,
      offsetY: Number(form.logoOffsetY.value) / 100,
      borderWidth: Number(form.logoBorderWidth.value),
      borderColor: form.logoBorderColor.value,
      borderRadius: Number(form.logoBorderRadius.value) / 100,
    },
  };
}

export function applyConfigToForm(form, config) {
  form.foregroundColor.value = config.foregroundColor;
  form.backgroundColor.value = config.backgroundColor;
  form.dotStyle.value = config.dotStyle;
  form.cornerSquareStyle.value = config.cornerSquareStyle;
  form.cornerDotStyle.value = config.cornerDotStyle;
  form.errorCorrectionLevel.value = config.errorCorrectionLevel;
  form.logoSize.value = Math.round(config.logo.size * 100);
  form.logoOffsetX.value = Math.round(config.logo.offsetX * 100);
  form.logoOffsetY.value = Math.round(config.logo.offsetY * 100);
  form.logoBorderWidth.value = config.logo.borderWidth;
  form.logoBorderColor.value = config.logo.borderColor;
  form.logoBorderRadius.value = Math.round(config.logo.borderRadius * 100);
}
