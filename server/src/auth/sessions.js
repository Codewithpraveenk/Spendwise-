import { createHash, randomBytes } from 'node:crypto';
import { parseCookie, stringifySetCookie } from 'cookie';
import { HttpError } from '../errors/HttpError.js';

const lifetimeMs = 7 * 24 * 60 * 60 * 1000;
export const digestToken = (token) => createHash('sha256').update(token).digest('hex');

export function createSessions({ models, production }) {
  const name = production ? '__Host-spendwise_session' : 'spendwise_session';
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' };
  function tokenFrom(req) {
    const token = parseCookie(req.headers.cookie ?? '')[name];
    return /^[a-f0-9]{64}$/.test(token ?? '') ? token : undefined;
  }
  async function revoke(req) {
    const token = tokenFrom(req);
    if (token) await models.Session.deleteOne({ tokenHash: digestToken(token) });
  }
  return {
    async issue(req, res, user) {
      await revoke(req);
      const token = randomBytes(32).toString('hex');
      await models.Session.create({ owner: user._id, tokenHash: digestToken(token), expiresAt: new Date(Date.now() + lifetimeMs), authVersion: user.authVersion ?? 0 });
      const cookie = stringifySetCookie({ name, value: token, ...cookieOptions, maxAge: lifetimeMs / 1000 });
      const previous = res.getHeader?.('Set-Cookie');
      res.setHeader('Set-Cookie', previous ? [...(Array.isArray(previous) ? previous : [previous]), cookie] : cookie);
    },
    async logout(req, res) {
      await revoke(req);
      res.setHeader('Set-Cookie', stringifySetCookie({ name, value: '', ...cookieOptions, maxAge: 0 }));
    },
    async requireUser(req, _res, next) {
      const token = tokenFrom(req);
      const session = token ? await models.Session.findOne({ tokenHash: digestToken(token), expiresAt: { $gt: new Date() } }) : null;
      const user = session ? await models.User.findById(session.owner) : null;
      if (!user || (user.authVersion ?? 0) !== (session.authVersion ?? 0)) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
      req.user = user;
      next();
    },
    clearCookie(res) { res.setHeader('Set-Cookie', stringifySetCookie({ name, value: '', ...cookieOptions, maxAge: 0 })); },
  };
}
