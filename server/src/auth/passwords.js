import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from '../errors/HttpError.js';

const derive = promisify(scrypt);
const settings = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
let activeDerivations = 0;

async function deriveKey(password, salt) {
  // Bound concurrent memory-heavy work independently of per-IP request limits.
  if (activeDerivations >= 2) throw new HttpError(503, 'AUTH_BUSY', 'Sign-in is busy. Please try again shortly.');
  activeDerivations++;
  try { return await derive(password, salt, 64, settings); }
  finally { activeDerivations--; }
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt);
  return `scrypt-v1$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [version, salt, hex] = (encoded ?? '').split('$');
  if (version !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hex ?? '')) return false;
  const key = await deriveKey(password, salt);
  return timingSafeEqual(key, Buffer.from(hex, 'hex'));
}
