import {
  drawPatternBackground,
  getTemplate,
  isPatternTemplate,
} from "./templates.js";

export const CARD_WIDTH = 480;
export const CARD_QR_SIZE = 300;

export const defaultCard = {
  enabled: true,
  template: "light",
  patternSeed: 0,
  companyName: "",
  subtitle: "",
  footer: "Scan to visit our website",
  textColor: "#1a1a2e",
};

export function isCardEnabled(card) {
  return card?.enabled !== false && card?.template && card.template !== "none";
}

export function computeCardLayout(card, qrSize = CARD_QR_SIZE) {
  const width = CARD_WIDTH;
  const padTop = 44;
  const padBottom = 44;
  const gap = 18;

  const hasTitle = Boolean(card.companyName?.trim());
  const hasSubtitle = Boolean(card.subtitle?.trim());
  const hasFooter = Boolean(card.footer?.trim());

  let y = padTop;
  const titleY = y;

  if (hasTitle) y += 34;
  if (hasTitle && hasSubtitle) y += 8;
  if (!hasTitle && hasSubtitle) y += 0;
  if (hasSubtitle) y += 22;

  if (hasTitle || hasSubtitle) y += gap;
  else y += 8;

  const qrY = y;
  y += qrSize + gap;

  const footerY = y;
  if (hasFooter) y += 22;

  y += padBottom;

  return {
    width,
    height: Math.max(y, qrSize + padTop + padBottom + 80),
    qr: { x: (width - qrSize) / 2, y: qrY, width: qrSize, height: qrSize, size: qrSize },
    title: { y: titleY, size: 26 },
    subtitle: { y: hasTitle ? titleY + 34 + 8 : titleY, size: 15 },
    footer: { y: footerY, size: 13 },
    hasTitle,
    hasSubtitle,
    hasFooter,
  };
}

function estimateLineCount(text, fontSize, maxWidth) {
  const charsPerLine = Math.max(8, Math.floor(maxWidth / (fontSize * 0.52)));
  const words = text.trim().split(/\s+/);
  let lines = 1;
  let lineLen = 0;
  for (const word of words) {
    const next = lineLen ? lineLen + 1 + word.length : word.length;
    if (next > charsPerLine) {
      lines += 1;
      lineLen = word.length;
    } else {
      lineLen = next;
    }
  }
  return lines;
}

export function getCardContentBounds(layout, card) {
  const qrPad = 14;
  const plateX = layout.qr.x - qrPad;
  const plateY = layout.qr.y - qrPad;
  const plateW = layout.qr.size + qrPad * 2;
  const plateH = layout.qr.size + qrPad * 2;
  const maxTextWidth = layout.width - 64;

  let top = layout.hasTitle ? layout.title.y - 10 : plateY - 8;
  let bottom = plateY + plateH + 12;

  if (layout.hasSubtitle) {
    const lines = estimateLineCount(card.subtitle, layout.subtitle.size, maxTextWidth);
    const subBottom = layout.subtitle.y + lines * (layout.subtitle.size + 3);
    bottom = Math.max(bottom, subBottom + 10);
  }

  if (layout.hasFooter) {
    const lines = estimateLineCount(card.footer, layout.footer.size, maxTextWidth);
    bottom = layout.footer.y + lines * (layout.footer.size + 3) + 12;
  }

  const contentW = Math.min(layout.width, Math.max(plateW + 24, maxTextWidth * 0.72));
  const centerX = layout.qr.x + layout.qr.size / 2;
  const x = Math.max(0, centerX - contentW / 2);
  const y = Math.max(0, top);
  const width = Math.min(layout.width - x, contentW);
  const height = Math.min(layout.height - y, bottom - y);

  return { x, y, width, height };
}

function drawCardBackground(ctx, width, height, card) {
  const tpl = getTemplate(card.template);

  if (isPatternTemplate(card.template)) {
    drawPatternBackground(ctx, width, height, card.template, card.patternSeed, tpl.palette);
    return;
  }

  ctx.fillStyle = tpl.palette?.base || tpl.backgroundColor;
  ctx.fillRect(0, 0, width, height);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCardText(ctx, layout, card) {
  const maxTextWidth = layout.width - 64;
  ctx.fillStyle = card.textColor || defaultCard.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  if (layout.hasTitle) {
    ctx.font = `700 ${layout.title.size}px "DM Sans", system-ui, sans-serif`;
    const lines = wrapText(ctx, card.companyName.trim(), maxTextWidth);
    lines.forEach((line, i) => {
      ctx.fillText(line, layout.width / 2, layout.title.y + i * (layout.title.size + 4));
    });
  }

  if (layout.hasSubtitle) {
    ctx.font = `500 ${layout.subtitle.size}px "DM Sans", system-ui, sans-serif`;
    ctx.globalAlpha = 0.78;
    const lines = wrapText(ctx, card.subtitle.trim(), maxTextWidth);
    lines.forEach((line, i) => {
      ctx.fillText(line, layout.width / 2, layout.subtitle.y + i * (layout.subtitle.size + 3));
    });
    ctx.globalAlpha = 1;
  }

  if (layout.hasFooter) {
    ctx.font = `500 ${layout.footer.size}px "DM Sans", system-ui, sans-serif`;
    ctx.globalAlpha = 0.65;
    const lines = wrapText(ctx, card.footer.trim(), maxTextWidth);
    lines.forEach((line, i) => {
      ctx.fillText(line, layout.width / 2, layout.footer.y + i * (layout.footer.size + 3));
    });
    ctx.globalAlpha = 1;
  }
}

export function composeCard(qrCanvas, config) {
  const card = config.card || defaultCard;
  const layout = computeCardLayout(card, qrCanvas.width);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;

  const ctx = canvas.getContext("2d");
  drawCardBackground(ctx, layout.width, layout.height, card);

  const qrPad = 14;
  const plateW = layout.qr.size + qrPad * 2;
  const plateH = layout.qr.size + qrPad * 2;
  const plateX = layout.qr.x - qrPad;
  const plateY = layout.qr.y - qrPad;

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  roundRect(ctx, plateX, plateY, plateW, plateH, 16);
  ctx.fill();

  ctx.drawImage(qrCanvas, layout.qr.x, layout.qr.y, layout.qr.size, layout.qr.size);
  drawCardText(ctx, layout, card);

  return { canvas, layout };
}

export function composeCardSvg(qrSvg, config, qrSize) {
  const card = config.card || defaultCard;
  const layout = computeCardLayout(card, qrSize);
  const ns = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("xmlns", ns);
  svg.setAttribute("width", layout.width);
  svg.setAttribute("height", layout.height);
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);

  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = layout.width;
  bgCanvas.height = layout.height;
  drawCardBackground(bgCanvas.getContext("2d"), layout.width, layout.height, card);

  const bgImage = document.createElementNS(ns, "image");
  bgImage.setAttribute("href", bgCanvas.toDataURL("image/png"));
  bgImage.setAttribute("width", layout.width);
  bgImage.setAttribute("height", layout.height);
  svg.appendChild(bgImage);

  const plate = document.createElementNS(ns, "rect");
  const qrPad = 14;
  plate.setAttribute("x", layout.qr.x - qrPad);
  plate.setAttribute("y", layout.qr.y - qrPad);
  plate.setAttribute("width", layout.qr.size + qrPad * 2);
  plate.setAttribute("height", layout.qr.size + qrPad * 2);
  plate.setAttribute("rx", "16");
  plate.setAttribute("fill", "rgba(255,255,255,0.92)");
  svg.appendChild(plate);

  const qrGroup = document.createElementNS(ns, "g");
  qrGroup.setAttribute("transform", `translate(${layout.qr.x} ${layout.qr.y})`);
  const imported = document.importNode(qrSvg, true);
  imported.setAttribute("width", qrSize);
  imported.setAttribute("height", qrSize);
  qrGroup.appendChild(imported);
  svg.appendChild(qrGroup);

  if (layout.hasTitle) {
    appendText(svg, card.companyName.trim(), layout.width / 2, layout.title.y, {
      size: layout.title.size,
      weight: 700,
      color: card.textColor,
    });
  }
  if (layout.hasSubtitle) {
    appendText(svg, card.subtitle.trim(), layout.width / 2, layout.subtitle.y, {
      size: layout.subtitle.size,
      weight: 500,
      color: card.textColor,
      opacity: 0.78,
    });
  }
  if (layout.hasFooter) {
    appendText(svg, card.footer.trim(), layout.width / 2, layout.footer.y, {
      size: layout.footer.size,
      weight: 500,
      color: card.textColor,
      opacity: 0.65,
    });
  }

  return svg;
}

function appendText(svg, text, x, y, { size, weight, color, opacity = 1 }) {
  const ns = "http://www.w3.org/2000/svg";
  const el = document.createElementNS(ns, "text");
  el.setAttribute("x", x);
  el.setAttribute("y", y + size);
  el.setAttribute("text-anchor", "middle");
  el.setAttribute("fill", color);
  el.setAttribute("font-family", '"DM Sans", system-ui, sans-serif');
  el.setAttribute("font-size", size);
  el.setAttribute("font-weight", weight);
  if (opacity < 1) el.setAttribute("opacity", opacity);
  el.textContent = text;
  svg.appendChild(el);
}

function roundRect(ctx, x, y, w, h, r) {
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
