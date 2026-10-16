import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../errors/HttpError.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { createSessions } from '../auth/sessions.js';
import { accountAccess } from '../middleware/accountAccess.js';
import { createGoogleAuth } from '../auth/google.js';
import { createRecovery, recoveryMessage } from '../auth/recovery.js';
import { setTimeout as delay } from 'node:timers/promises';
import { randomInt } from 'node:crypto';
import { productionRateStore } from '../middleware/mongoRateLimitStore.js';

export const publicUser = (user) => ({ id: user._id.toString(), name: user.name, email: user.email });

function credentials(body, registering) {
  const fields = registering ? ['name', 'email', 'password'] : ['email', 'password'];
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some((key) => !fields.includes(key)) || fields.some((key) => typeof body[key] !== 'string')) {
    throw new HttpError(400, 'INVALID_INPUT', 'Provide only the required account fields as strings.');
  }
  const email = body.email.trim().toLowerCase();
  const name = body.name?.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.password.length > 128 || body.password.length < (registering ? 15 : 1) || (registering && (!name || name.length > 80))) {
    throw new HttpError(400, 'INVALID_INPUT', 'Use a valid email, a name up to 80 characters, and a password of 15–128 characters when registering.');
  }
  return { email, name, password: body.password };
}

export function createAuthRouter({ config, database, googleVerifier }) {
  const router = Router();
  router.get('/capabilities', (_req, res) => res.set('Cache-Control', 'no-store').json({ passwordRecovery: Boolean(config.smtp || config.brevo) }));
  router.use(accountAccess(database));
  const sessions = database ? createSessions({ models: database.models, production: config.nodeEnv === 'production' }) : null;
  const google = database ? createGoogleAuth({ config, database, verify: googleVerifier }) : null;
  const recovery = database ? createRecovery({ config, database }) : null;
  const limit = rateLimit({
    store: productionRateStore(config, database, 'account'),
    // Local development includes repeated setup checks and Google challenge reloads.
    // Keep the production and test protections active.
    skip: () => config.nodeEnv === 'development',
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many account attempts. Try again in 15 minutes.')),
  });
  // A valid fixed hash keeps unknown-account login on the same expensive path.
  const dummyHash = `scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
  // Email delivery needs its own abuse controls even during local development.
  const recoveryLimit = rateLimit({ store: productionRateStore(config, database, 'recovery'), windowMs: 15 * 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'RECOVERY_RATE_LIMIT', 'Too many recovery attempts. Try again later.')) });
  router.post('/forgot-password', recoveryLimit, async (req, res) => {
    const started = Date.now();
    await recovery.request(req.body);
    await delay(Math.max(0, 250 + randomInt(50) - (Date.now() - started)));
    res.status(202).json({ message: recoveryMessage });
  });
  router.post('/reset-password', recoveryLimit, async (req, res) => {
    await recovery.reset(req.body);
    sessions.clearCookie(res);
    res.json({ message: 'Password updated. Previous sessions have been signed out. Sign in with your new password.' });
  });
  router.get('/google/challenge', limit, async (req, res) => res.json(await google.challenge(req, res)));
  router.post('/google', limit, async (req, res) => {
    const user = await google.login(req, res);
    await sessions.issue(req, res, user);
    res.json({ user: publicUser(user) });
  });
  router.post('/register', limit, async (req, res) => {
    const input = credentials(req.body, true);
    const passwordHash = await hashPassword(input.password);
    let user;
    try { user = await database.models.User.create({ name: input.name, email: input.email, passwordHash }); }
    catch (error) {
      if (error.code === 11000) throw new HttpError(409, 'REGISTRATION_UNAVAILABLE', 'Registration could not be completed with these details. Try signing in.');
      throw error;
    }
    await sessions.issue(req, res, user);
    res.status(201).json({ user: publicUser(user) });
  });
  router.post('/login', limit, async (req, res) => {
    const input = credentials(req.body, false);
    const user = await database.models.User.findOne({ email: input.email }).select('+passwordHash');
    const valid = await verifyPassword(input.password, user?.passwordHash ?? dummyHash);
    if (!user || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    await sessions.issue(req, res, user);
    res.json({ user: publicUser(user) });
  });
  router.get('/me', (req, res, next) => sessions.requireUser(req, res, next), (req, res) => res.json({ user: publicUser(req.user) }));
  router.post('/logout', async (req, res) => {
    await sessions.logout(req, res);
    res.status(204).end();
  });
  return router;
}
