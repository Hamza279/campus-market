const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const THUMBNAIL_SIZE = 640;
const THUMBNAIL_QUALITY = 0.82;

export const IMAGE_UPLOAD_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");

export const getImageFileValidationError = (file: File): string | null => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return "Upload a JPG, PNG, or WebP image.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be 8 MB or smaller.";
  }

  return null;
};

export const createImageThumbnail = async (file: File): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Unable to prepare image thumbnail.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const thumbnail = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", THUMBNAIL_QUALITY);
  });

  if (!thumbnail) {
    throw new Error("Unable to create image thumbnail.");
  }

  return thumbnail;
};
