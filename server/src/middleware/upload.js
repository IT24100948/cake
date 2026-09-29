const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { uploadDir, blobToken } = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const useBlob = !!blobToken;
const newName = (mime) => `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[mime]}`;

if (!useBlob) fs.mkdirSync(uploadDir, { recursive: true });

/**
 * Local development keeps files on disk (served from /uploads). On Vercel the
 * filesystem is read-only, so files are held in memory and pushed to Vercel Blob.
 */
const storage = useBlob
  ? multer.memoryStorage()
  : multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, newName(file.mimetype)),
  });

async function toBlob(file) {
  const { put } = require('@vercel/blob');
  const blob = await put(`uploads/${newName(file.mimetype)}`, file.buffer, {
    access: 'public',
    contentType: file.mimetype,
    token: blobToken,
  });
  file.url = blob.url;
}

/** Single image upload (jpg/png/webp, max 2 MB). */
const imageUpload = (field) => (req, res, next) =>
  multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req2, file, cb) =>
      ALLOWED[file.mimetype]
        ? cb(null, true)
        : cb(ApiError.unprocessable('Invalid image', { [field]: 'Only JPG, PNG or WEBP images are allowed' })),
  }).single(field)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller' : err.message;
      return next(ApiError.unprocessable('Invalid image', { [field]: msg }));
    }
    if (err || !req.file || !useBlob) return next(err);
    toBlob(req.file).then(() => next(), (e) => next(new ApiError(502, `Image upload failed: ${e.message}`)));
  });

/** Public URL of an uploaded file: a Blob CDN URL on Vercel, /uploads/<name> locally. */
const publicUrl = (file) => {
  if (!file) return null;
  return file.url || `/uploads/${file.filename}`;
};

/** Delete a previously uploaded file (ignores seed images and missing files). */
function removeUpload(url) {
  if (!url) return;
  if (/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url)) {
    if (!useBlob) return;
    require('@vercel/blob').del(url, { token: blobToken }).catch(() => {});
    return;
  }
  if (!url.startsWith('/uploads/') || url.startsWith('/uploads/seed/')) return;
  fs.unlink(path.join(uploadDir, path.basename(url)), () => {});
}

module.exports = { imageUpload, publicUrl, removeUpload };
