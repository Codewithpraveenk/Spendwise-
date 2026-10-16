import mongoose from 'mongoose';
import { createModels } from './models/index.js';

export async function connectDatabase(uri, { autoIndex = false } = {}) {
  const connection = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000,
    socketTimeoutMS: 10000, maxPoolSize: 10, autoIndex,
  });
  try {
    await connection.asPromise();
    const topology = await connection.db.admin().command({ hello: 1 });
    const models = createModels(connection);
    if (autoIndex) await Promise.all(Object.values(models).map((model) => model.init()));
    return {
      connection, models,
      supportsTransactions: Boolean(topology.setName || topology.msg === 'isdbgrid'),
      async isReady() {
        if (connection.readyState !== 1) return false;
        try { await connection.db.command({ ping: 1 }, { timeoutMS: 2000 }); return true; }
        catch { return false; }
      },
      close: () => connection.close(),
    };
  } catch (error) {
    await connection.close().catch(() => {});
    throw error;
  }
}
