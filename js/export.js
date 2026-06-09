export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPng(canvas, filename = "qr-code.png") {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      downloadBlob(blob, filename);
      resolve();
    }, "image/png");
  });
}

export function exportSvg(svgElement, filename = "qr-code.svg") {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);
  const blob = new Blob(
    ['<?xml version="1.0" encoding="UTF-8"?>', source],
    { type: "image/svg+xml" }
  );
  downloadBlob(blob, filename);
}

export async function exportPdf(canvas, filename = "qr-code.pdf") {
  const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 48;
  const maxSize = pageWidth - margin * 2;
  const dataUrl = canvas.toDataURL("image/png", 1.0);
  pdf.addImage(dataUrl, "PNG", margin, margin, maxSize, maxSize);
  pdf.save(filename);
}
