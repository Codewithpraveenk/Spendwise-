import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { parseCookie, stringifySetCookie } from 'cookie';
import { HttpError } from '../errors/HttpError.js';
import { digestToken } from './sessions.js';
import { verifyPassword } from './passwords.js';

const invalidToken = () => new HttpError(401, 'GOOGLE_TOKEN_INVALID', 'Google sign-in could not be verified. Choose your Google account again.');
export function verifiedGoogleClaims(payload, audience, nonce, now = Date.now()) {
  if (!payload || payload.aud !== audience || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)
    || !Number.isFinite(payload.exp) || payload.exp * 1000 <= now || payload.nonce !== nonce
    || typeof payload.sub !== 'string' || !/^[a-zA-Z0-9_-]{1,255}$/.test(payload.sub)
    || payload.email_verified !== true || typeof payload.email !== 'string' || payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw invalidToken();
  return { sub: payload.sub, email: payload.email.trim().toLowerCase(), name: (typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : payload.email.split('@')[0]).slice(0, 80) };
}

// The verifier is injectable only by server-side tests, never by a request/config value.
export function createGoogleAuth({ config, database, verify }) {
  const client = new OAuth2Client({ transporterOptions: { timeout: 10000, retry: false } });
  const verifyToken = verify ?? (async (credential) => (await client.verifyIdToken({ idToken: credential, audience: config.googleClientId })).getPayload());
  const production = config.nodeEnv === 'production';
  const name = production ? '__Host-spendwise_google' : 'spendwise_google';
  const options = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' };
  const enabled = () => { if (!config.googleClientId) throw new HttpError(503, 'GOOGLE_NOT_CONFIGURED', 'Google sign-in is not configured on this server.'); };
  return {
    async challenge(req, res) {
      enabled();
      const previous = parseCookie(req.headers.cookie ?? '')[name];
      if (/^[a-f0-9]{64}$/.test(previous ?? '')) await database.models.GoogleChallenge.deleteOne({ tokenHash: digestToken(previous) });
      const nonce = randomBytes(32).toString('hex');
      await database.models.GoogleChallenge.create({ tokenHash: digestToken(nonce), expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
      res.setHeader('Set-Cookie', stringifySetCookie({ name, value: nonce, ...options, maxAge: 300 }));
      return { nonce, clientId: config.googleClientId };
    },
    async login(req, res) {
      enabled();
      const body = req.body;
      if (!body || Array.isArray(body) || Object.keys(body).some((key) => !['credential', 'password'].includes(key)) || typeof body.credential !== 'string' || body.credential.length < 20 || body.credential.length > 10000 || (body.password !== undefined && (typeof body.password !== 'string' || !body.password || body.password.length > 128))) throw new HttpError(400, 'INVALID_INPUT', 'Provide a Google credential and, only when linking, your existing SpendWise password.');
      const nonce = parseCookie(req.headers.cookie ?? '')[name];
      if (!/^[a-f0-9]{64}$/.test(nonce ?? '')) throw invalidToken();
      const tokenHash = digestToken(nonce);
      if (!await database.models.GoogleChallenge.exists({ tokenHash, expiresAt: { $gt: new Date() } })) throw invalidToken();
      let claims;
      try { claims = verifiedGoogleClaims(await verifyToken(body.credential), config.googleClientId, nonce); }
      catch { throw invalidToken(); }
      const { User, GoogleChallenge } = database.models;
      const known = await User.findOne({ googleSub: claims.sub }).select('+googleSub +passwordHash')
        ?? await User.findOne({ email: claims.email }).select('+googleSub +passwordHash');
      const linking = known && known.googleSub !== claims.sub;
      if (linking) {
        if (known.googleSub) throw new HttpError(409, 'GOOGLE_LINK_CONFLICT', 'This SpendWise account is linked to a different Google identity. Sign in with its existing method.');
        if (!body.password) throw new HttpError(409, 'GOOGLE_LINK_REQUIRED', 'An account already uses this email. Enter its SpendWise password to connect Google and keep your existing records.');
        if (!await verifyPassword(body.password, known.passwordHash)) throw new HttpError(401, 'GOOGLE_LINK_PASSWORD', 'The SpendWise password is incorrect. Google has not been connected.');
      }
      if (!database.supportsTransactions) throw new HttpError(503, 'TRANSACTIONS_REQUIRED', 'Google sign-in requires a connected MongoDB replica set or Atlas cluster.');
      let user;
      try {
        user = await database.connection.transaction(async (session) => {
          const consumed = await GoogleChallenge.findOneAndDelete({ tokenHash, expiresAt: { $gt: new Date() } }, { session });
          if (!consumed) throw invalidToken();
          if (!known) return (await User.create([{ name: claims.name, email: claims.email, googleSub: claims.sub }], { session }))[0];
          if (linking) {
            const linked = await User.findOneAndUpdate({ _id: known._id, googleSub: { $exists: false }, passwordHash: known.passwordHash }, { $set: { googleSub: claims.sub }, $inc: { __v: 1 } }, { session, returnDocument: 'after' });
            if (!linked) throw new HttpError(409, 'GOOGLE_LINK_CONFLICT', 'This account changed. Start Google sign-in again.');
            return linked;
          }
          const existing = await User.findOne({ _id: known._id, googleSub: claims.sub }).session(session);
          if (!existing) throw invalidToken();
          return existing;
        });
      } catch (error) {
        if (error.code === 11000) throw new HttpError(409, 'GOOGLE_ACCOUNT_CHANGED', 'This account was created or connected in another request. Choose your Google account again.');
        throw error;
      }
      res.append('Set-Cookie', stringifySetCookie({ name, value: '', ...options, maxAge: 0 }));
      return user;
    },
  };
}
