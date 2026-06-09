export const PATTERN_TEMPLATES = new Set(["waves", "rings", "lattice", "spiral", "contours"]);

export function isPatternTemplate(id) {
  return PATTERN_TEMPLATES.has(id);
}

export function newPatternSeed() {
  return Math.floor(Math.random() * 1_000_000) + 1;
}

export function createSeededRandom(seed) {
  let state = (Math.abs(Math.floor(Number(seed) || 1)) % 2_147_483_646) + 1;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
}

export const TEMPLATES = [
  {
    id: "light",
    name: "Simple Light",
    description: "Clean white background with dark modules.",
    category: "basic",
    foregroundColor: "#1a1a2e",
    backgroundColor: "#ffffff",
    dotStyle: "rounded",
    cornerSquareStyle: "extra-rounded",
    cornerDotStyle: "dot",
    errorCorrectionLevel: "H",
    logoBorderColor: "#ffffff",
    palette: { base: "#ffffff", accent: "#c7d2fe", ink: "#4338ca" },
  },
  {
    id: "dark",
    name: "Simple Dark",
    description: "Dark background with light modules.",
    category: "basic",
    foregroundColor: "#f4f4f6",
    backgroundColor: "#14141a",
    dotStyle: "rounded",
    cornerSquareStyle: "extra-rounded",
    cornerDotStyle: "dot",
    errorCorrectionLevel: "H",
    logoBorderColor: "#14141a",
    palette: { base: "#14141a", accent: "#6c5ce7", ink: "#a5b4fc" },
  },
  {
    id: "waves",
    name: "Wave Field",
    description: "Flowing sine curves — unique layout every shuffle.",
    category: "pattern",
    foregroundColor: "#1e1b4b",
    backgroundColor: "#f8fafc",
    dotStyle: "dots",
    cornerSquareStyle: "dot",
    cornerDotStyle: "dot",
    errorCorrectionLevel: "H",
    logoBorderColor: "#ffffff",
    palette: { base: "#f8fafc", accent: "#818cf8", ink: "#4f46e5" },
  },
  {
    id: "rings",
    name: "Concentric Rings",
    description: "Rippling circles from a seeded focal point.",
    category: "pattern",
    foregroundColor: "#134e4a",
    backgroundColor: "#ecfdf5",
    dotStyle: "extra-rounded",
    cornerSquareStyle: "extra-rounded",
    cornerDotStyle: "dot",
    errorCorrectionLevel: "H",
    logoBorderColor: "#ffffff",
    palette: { base: "#ecfdf5", accent: "#5eead4", ink: "#0d9488" },
  },
  {
    id: "lattice",
    name: "Math Lattice",
    description: "Rotated grid lines with golden-ratio spacing.",
    category: "pattern",
    foregroundColor: "#7c2d12",
    backgroundColor: "#fff7ed",
    dotStyle: "square",
    cornerSquareStyle: "square",
    cornerDotStyle: "square",
    errorCorrectionLevel: "H",
    logoBorderColor: "#ffffff",
    palette: { base: "#fff7ed", accent: "#fdba74", ink: "#ea580c" },
  },
  {
    id: "spiral",
    name: "Golden Spiral",
    description: "Fibonacci spiral dots with a unique spin each time.",
    category: "pattern",
    foregroundColor: "#312e81",
    backgroundColor: "#eef2ff",
    dotStyle: "classy-rounded",
    cornerSquareStyle: "classy-rounded",
    cornerDotStyle: "dot",
    errorCorrectionLevel: "H",
    logoBorderColor: "#ffffff",
    palette: { base: "#eef2ff", accent: "#a5b4fc", ink: "#6366f1" },
  },
  {
    id: "contours",
    name: "Contour Map",
    description: "Topographic lines from summed sine hills.",
    category: "pattern",
    foregroundColor: "#1e3a5f",
    backgroundColor: "#f0f9ff",
    dotStyle: "rounded",
    cornerSquareStyle: "rounded",
    cornerDotStyle: "dot",
    errorCorrectionLevel: "H",
    logoBorderColor: "#ffffff",
    palette: { base: "#f0f9ff", accent: "#7dd3fc", ink: "#0284c7" },
  },
];

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

export function applyCardTemplate(templateId, currentSeed = 0) {
  if (templateId === "none") {
    return {
      card: {
        enabled: false,
        template: "none",
        patternSeed: 0,
        textColor: "#1a1a2e",
      },
    };
  }

  const tpl = getTemplate(templateId);
  const seed = isPatternTemplate(templateId)
    ? (Number(currentSeed) || newPatternSeed())
    : 0;

  return {
    card: {
      enabled: true,
      template: tpl.id,
      patternSeed: seed,
      textColor: tpl.id === "dark" ? "#f4f4f6" : tpl.foregroundColor,
    },
  };
}

export function drawPatternBackground(ctx, width, height, templateId, seed, palette) {
  const rand = createSeededRandom(seed);
  const colors = palette || getTemplate(templateId).palette;
  const size = Math.max(width, height);

  ctx.fillStyle = colors.base;
  ctx.fillRect(0, 0, width, height);

  switch (templateId) {
    case "waves":
      drawWaves(ctx, width, height, rand, colors);
      break;
    case "rings":
      drawRings(ctx, width, height, size, rand, colors);
      break;
    case "lattice":
      drawLattice(ctx, width, height, size, rand, colors);
      break;
    case "spiral":
      drawSpiral(ctx, width, height, rand, colors);
      break;
    case "contours":
      drawContours(ctx, width, height, rand, colors);
      break;
    default:
      break;
  }
}

function drawWaves(ctx, width, height, rand, colors) {
  const bands = 7 + Math.floor(rand() * 5);
  const freq = 0.01 + rand() * 0.015;
  const amplitude = height * (0.03 + rand() * 0.03);
  const phase = rand() * Math.PI * 2;

  ctx.lineWidth = 1.2;
  for (let i = 0; i < bands; i++) {
    const t = i / Math.max(bands - 1, 1);
    ctx.strokeStyle = mixColors(colors.accent, colors.ink, t * 0.65);
    ctx.globalAlpha = 0.35 + rand() * 0.25;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 3) {
      const y = height * (0.15 + t * 0.7)
        + Math.sin(x * freq + phase + i * 0.8) * amplitude
        + Math.cos(x * freq * 0.5 + i) * amplitude * 0.35;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawRings(ctx, width, height, size, rand, colors) {
  const cx = width * (0.35 + rand() * 0.3);
  const cy = height * (0.35 + rand() * 0.3);
  const spacing = 8 + rand() * 10;
  const maxR = size * 0.85;

  for (let r = spacing; r < maxR; r += spacing * (0.85 + rand() * 0.3)) {
    const t = r / maxR;
    ctx.strokeStyle = mixColors(colors.accent, colors.ink, t * 0.7);
    ctx.globalAlpha = 0.22 + (1 - t) * 0.28;
    ctx.lineWidth = 1 + (1 - t) * 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawLattice(ctx, width, height, size, rand, colors) {
  const phi = 1.61803398875;
  const spacing = 14 + Math.floor(rand() * 10);
  const angle = (Math.PI / 4) + (rand() - 0.5) * 0.35;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(angle);
  ctx.translate(-width / 2, -height / 2);

  const span = size * 1.5;
  ctx.lineWidth = 1;
  for (let x = -span; x < span; x += spacing) {
    const t = (x + span) / (span * 2);
    ctx.strokeStyle = mixColors(colors.accent, colors.ink, Math.abs(t - 0.5) * 1.4);
    ctx.globalAlpha = 0.2 + rand() * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, -span);
    ctx.lineTo(x + span / phi, span);
    ctx.stroke();
  }
  for (let y = -span; y < span; y += spacing) {
    const t = (y + span) / (span * 2);
    ctx.strokeStyle = mixColors(colors.ink, colors.accent, Math.abs(t - 0.5) * 1.2);
    ctx.globalAlpha = 0.18 + rand() * 0.12;
    ctx.beginPath();
    ctx.moveTo(-span, y);
    ctx.lineTo(span, y - span / phi);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSpiral(ctx, width, height, rand, colors) {
  const cx = width / 2;
  const cy = height / 2;
  const phi = (1 + Math.sqrt(5)) / 2;
  const spin = rand() * Math.PI * 2;
  const maxRadius = Math.min(width, height) * 0.48;
  const startR = 6;

  const radiusAt = (theta) => startR * Math.pow(phi, theta / (Math.PI * 1.55));

  function drawArm(offset, lineAlpha, dotAlpha) {
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = mixColors(colors.accent, colors.ink, 0.5);
    ctx.globalAlpha = lineAlpha;
    ctx.beginPath();
    for (let theta = 0; ; theta += 0.1) {
      const r = radiusAt(theta);
      if (r > maxRadius) break;
      const x = cx + Math.cos(theta + spin + offset) * r;
      const y = cy + Math.sin(theta + spin + offset) * r;
      if (theta === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (let theta = 0; ; theta += 0.38) {
      const r = radiusAt(theta);
      if (r > maxRadius) break;
      const t = r / maxRadius;
      const x = cx + Math.cos(theta + spin + offset) * r;
      const y = cy + Math.sin(theta + spin + offset) * r;
      const dotR = 2 + (1 - t) * 2.5;

      ctx.fillStyle = mixColors(colors.accent, colors.ink, t * 0.85);
      ctx.globalAlpha = dotAlpha * (0.65 + (1 - t) * 0.35);
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawArm(0, 0.38, 0.42);
  drawArm((Math.PI * 2) / 3, 0.16, 0.22);
  drawArm((Math.PI * 4) / 3, 0.16, 0.22);
  ctx.globalAlpha = 1;
}

function drawContours(ctx, width, height, rand, colors) {
  const hills = 2 + Math.floor(rand() * 2);
  const sources = Array.from({ length: hills }, () => ({
    x: width * (0.25 + rand() * 0.5),
    y: height * (0.25 + rand() * 0.5),
    amp: 0.55 + rand() * 0.35,
    wavelength: 90 + rand() * 80,
  }));

  const sample = (x, y) => {
    let h = 0;
    for (const s of sources) {
      const dx = x - s.x;
      const dy = y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      h += s.amp * Math.sin((dist / s.wavelength) * Math.PI * 2);
    }
    return h;
  };

  const cell = 10;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const values = Array.from({ length: rows + 1 }, (_, row) =>
    Array.from({ length: cols + 1 }, (_, col) => sample(col * cell, row * cell))
  );

  let min = Infinity;
  let max = -Infinity;
  for (const row of values) {
    for (const v of row) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }

  const levelCount = 7;
  ctx.lineWidth = 1;

  for (let li = 1; li < levelCount; li++) {
    const level = min + (li / levelCount) * (max - min);
    const t = li / levelCount;
    ctx.strokeStyle = mixColors(colors.accent, colors.ink, t * 0.65);
    ctx.globalAlpha = 0.09 + t * 0.09;
    ctx.beginPath();
    traceContourLines(ctx, values, cols, rows, cell, level);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function traceContourLines(ctx, values, cols, rows, cell, level) {
  const interp = (a, b, va, vb) => {
    if (va === vb) return a;
    return a + (b - a) * ((level - va) / (vb - va));
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tl = values[row][col];
      const tr = values[row][col + 1];
      const br = values[row + 1][col + 1];
      const bl = values[row + 1][col];
      const x = col * cell;
      const y = row * cell;

      const pts = [
        { x: interp(x, x + cell, tl, tr), y },
        { x: x + cell, y: interp(y, y + cell, tr, br) },
        { x: interp(x + cell, x, br, bl), y: y + cell },
        { x, y: interp(y + cell, y, bl, tl) },
      ];

      const mask = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
      const edges = CONTOUR_EDGES[mask];
      if (!edges) continue;

      for (const [from, to] of edges) {
        ctx.moveTo(pts[from].x, pts[from].y);
        ctx.lineTo(pts[to].x, pts[to].y);
      }
    }
  }
}

const CONTOUR_EDGES = {
  1: [[0, 3]],
  2: [[1, 2]],
  3: [[0, 1], [2, 3]],
  4: [[1, 2]],
  5: [[0, 1], [2, 3]],
  6: [[0, 2]],
  7: [[0, 3]],
  8: [[0, 3]],
  9: [[0, 2]],
  10: [[0, 1], [2, 3]],
  11: [[1, 2]],
  12: [[0, 1], [2, 3]],
  13: [[1, 2]],
  14: [[0, 3]],
};

function mixColors(a, b, t) {
  const clamp = Math.max(0, Math.min(1, t));
  const parse = (hex) => {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * clamp);
  const g = Math.round(ag + (bg - ag) * clamp);
  const bl = Math.round(ab + (bb - ab) * clamp);
  return `rgb(${r}, ${g}, ${bl})`;
}
