import multer from 'multer';
import sharp from 'sharp';
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';

// Files are held in memory: they are small, validated straight away, and then
// handed to the storage driver, so nothing unvalidated ever touches the disk.
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxBytes, files: 1 },
}).single('image');

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

/**
 * Validate and normalise an uploaded photo.
 *
 * The file extension and the browser's MIME type are both ignored; sharp decodes the
 * actual bytes, so a renamed non-image is rejected. The result is always a JPEG that is
 * rotated upright, at most `maxDimension` pixels on its longest side, with EXIF
 * metadata (including GPS position) removed.
 */
export async function normaliseImage(file) {
  if (!file?.buffer?.length) throw ApiError.badRequest('Please attach a photo of the crop');

  let meta;
  try {
    meta = await sharp(file.buffer).metadata();
  } catch {
    throw ApiError.badRequest('That file is not a readable image. Upload a JPG, PNG or WebP photo.');
  }
  if (!ALLOWED_FORMATS.has(meta.format)) {
    throw ApiError.badRequest('Unsupported image type. Upload a JPG, PNG or WebP photo.');
  }
  if ((meta.width || 0) < 64 || (meta.height || 0) < 64) {
    throw ApiError.badRequest('The image is too small to analyse. Use a photo at least 64 pixels wide.');
  }

  const { data, info } = await sharp(file.buffer)
    .rotate() // apply EXIF orientation, then metadata is dropped by default
    .resize({ width: config.upload.maxDimension, height: config.upload.maxDimension, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, width: info.width, height: info.height, bytes: data.length };
}
