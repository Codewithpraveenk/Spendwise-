import { HttpError } from '../errors/HttpError.js';

export function accountAccess(database) {
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (req.get('X-Spendwise-Request') !== '1' || !req.is('application/json') || req.get('Sec-Fetch-Site') === 'cross-site')) {
      throw new HttpError(403, 'REQUEST_NOT_ALLOWED', 'Use a same-site JSON request with X-Spendwise-Request: 1.');
    }
    if (!database || database.connection.readyState !== 1) throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'Account storage is unavailable. Please try again later.');
    next();
  };
}
