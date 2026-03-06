const AVATAR_SIZE_PX = 256;
const MAX_AVATAR_BYTES = 120 * 1024;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.1;

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen seleccionada.'));
    };

    img.src = objectUrl;
  });

const canvasToWebpBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar la imagen optimizada.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality
    );
  });

export const optimizeProfileImage = async (file) => {
  const img = await loadImageFromFile(file);

  const sourceSize = Math.min(img.width, img.height);
  const sourceX = Math.floor((img.width - sourceSize) / 2);
  const sourceY = Math.floor((img.height - sourceSize) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('No se pudo procesar la imagen en este navegador.');
  }

  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    AVATAR_SIZE_PX,
    AVATAR_SIZE_PX
  );

  let quality = 0.9;
  let blob = await canvasToWebpBlob(canvas, quality);
  while (blob.size > MAX_AVATAR_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
    blob = await canvasToWebpBlob(canvas, quality);
  }

  return new File([blob], `profile-${Date.now()}.webp`, { type: 'image/webp' });
};

export const isValidProfileImage = (file) => {
  if (!file) return 'No se ha seleccionado ninguna imagen.';
  if (!file.type?.startsWith('image/')) return 'Solo se permiten archivos de imagen.';
  if (file.size > 10 * 1024 * 1024) return 'La imagen original es demasiado grande (máximo 10MB).';
  return null;
};

