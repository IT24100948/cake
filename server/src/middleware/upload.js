const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { uploadDir } = require('../config/env');
const ApiError = require('../utils/ApiError');

fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
});

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
    next(err);
  });

const publicUrl = (file) => (file ? `/uploads/${file.filename}` : null);

/** Delete a previously uploaded file (ignores missing files and external URLs). */
function removeUpload(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  fs.unlink(path.join(uploadDir, path.basename(url)), () => {});
}

module.exports = { imageUpload, publicUrl, removeUpload };
