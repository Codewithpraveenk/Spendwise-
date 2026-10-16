import { createHash } from 'node:crypto';
import { HttpError } from '../errors/HttpError.js';

// Fixed-window counters shared across app instances. Raw client IPs are not stored.
export class MongoRateLimitStore {
  localKeys = false;
  constructor(Model, prefix, clock = () => Date.now()) { this.Model = Model; this.prefix = prefix; this.clock = clock; }
  init(options) { this.windowMs = options.windowMs; }
  bucket(key) {
    const window = Math.floor(this.clock() / this.windowMs);
    return { id: createHash('sha256').update(`${this.prefix}:${key}:${window}`).digest('hex'), resetTime: new Date((window + 1) * this.windowMs) };
  }
  async increment(key) {
    const { id, resetTime } = this.bucket(key);
    try {
      let record;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { record = await this.Model.findOneAndUpdate({ _id: id }, { $inc: { totalHits: 1 }, $setOnInsert: { resetTime } }, { upsert: true, returnDocument: 'after' }); break; }
        catch (error) { if (error.code !== 11000 || attempt === 2) throw error; }
      }
      return { totalHits: record.totalHits, resetTime: record.resetTime };
    } catch { throw new HttpError(503, 'RATE_LIMIT_UNAVAILABLE', 'Account protection is temporarily unavailable. Try again shortly.'); }
  }
  async decrement(key) { await this.Model.updateOne({ _id: this.bucket(key).id, totalHits: { $gt: 0 } }, { $inc: { totalHits: -1 } }); }
  async resetKey(key) { await this.Model.deleteOne({ _id: this.bucket(key).id }); }
}

export function productionRateStore(config, database, prefix) {
  return config.nodeEnv === 'production' && database ? new MongoRateLimitStore(database.models.RateLimitBucket, prefix) : undefined;
}
