import multer from 'multer';
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err instanceof multer.MulterError) {
    status = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `Image is too large. The limit is ${Math.round(config.upload.maxBytes / 1024 / 1024)} MB.`
        : 'Upload failed. Send a single image in the "image" field.';
  } else if (err.name === 'ValidationError') {
    // mongoose schema validation
    status = 400;
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0]?.message || 'Validation failed';
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'That record already exists';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  }

  if (status >= 500) {
    console.error(err);
    if (config.isProd) message = 'Something went wrong on our side. Please try again.';
  }

  res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
}
