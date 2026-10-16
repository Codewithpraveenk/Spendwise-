import { HttpError } from '../errors/HttpError.js';

export function notFound(req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'Route not found.'));
}

export function errorHandler(logger) {
  // Express recognizes an error handler by these four parameters.
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong. Please try again.';

    if (error instanceof HttpError) {
      ({ status, code, message } = error);
    } else if (error.type === 'entity.parse.failed') {
      status = 400;
      code = 'INVALID_JSON';
      message = 'Provide a valid JSON request body.';
    } else if (error.type === 'entity.too.large') {
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = req.originalUrl?.split('?')[0].startsWith('/api/workspace') ? 'The workspace request exceeds the 5 MB limit.' : 'The request body exceeds the 100 KB limit.';
    } else if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
      status = error.status;
      code = 'BAD_REQUEST';
      message = 'The request could not be processed.';
    }

    if (status >= 500) logger.error({ event: 'request_failed', requestId: req.requestId, status, code });
    res.status(status).json({ error: { code, message, requestId: req.requestId } });
  };
}
