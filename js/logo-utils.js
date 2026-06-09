const MAX_LOGO_DIMENSION = 512;
const MAX_SVG_BYTES = 200_000;

export function logoUrl(logoId) {
  return logoId ? `/api/logos/${logoId}` : null;
}

export function getLogoSrc(logo) {
  if (!logo) return null;
  return logo.url || logoUrl(logo.logoId);
}

export async function prepareLogoFile(file) {
  if (file.type === "image/svg+xml") {
    if (file.size > MAX_SVG_BYTES) throw new Error("SVG logo must be under 200KB");
    return file;
  }

  if (!file.type.startsWith("image/")) throw new Error("Please upload an image file");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Failed to compress logo"))),
      "image/webp",
      0.85
    );
  });

  return new File([blob], "logo.webp", { type: "image/webp" });
}

export function configForSave(config) {
  if (!config?.logo) return config;

  const logo = { ...config.logo };

  if (!logo.logoId) {
    delete logo.url;
    return { ...config, logo: null };
  }

  logo.url = logoUrl(logo.logoId);
  return { ...config, logo };
}
