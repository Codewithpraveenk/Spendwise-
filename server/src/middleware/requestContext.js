import { randomUUID } from 'node:crypto';

export function requestContext(logger) {
  return (req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    const started = performance.now();
    // Capture before mounted routers temporarily change req.url/req.path.
    const path = req.path;
    const method = req.method;
    res.on('finish', () => {
      // Deliberately exclude query strings, bodies, cookies and authorization.
      logger.info({ event: 'request', requestId: req.requestId, method, path, status: res.statusCode, durationMs: Math.round(performance.now() - started) });
    });
    next();
  };
}
