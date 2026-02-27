export async function compressImageToJpeg(file, targetKB = 1800) {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const maxW = 1600;
  const scale = Math.min(1, maxW / img.width);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let q = 0.82;
  let blob = await canvasToBlob(canvas, "image/jpeg", q);
  while (blob.size > targetKB * 1024 && q > 0.35) {
    q -= 0.08;
    blob = await canvasToBlob(canvas, "image/jpeg", q);
  }
  return new File([blob], (file.name || "image") + ".jpg", { type: "image/jpeg" });
}
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}
function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}
