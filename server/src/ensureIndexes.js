import { loadConfig } from './config/env.js';
import { connectDatabase } from './database.js';

let database;
try {
  const config = loadConfig();
  if (!config.mongodbUri) throw new Error('Database is not configured.');
  database = await connectDatabase(config.mongodbUri);
  // Add declared indexes; never use syncIndexes here, which could drop indexes.
  for (const model of Object.values(database.models)) await model.createIndexes();
  console.log('Database indexes are ready.');
} catch {
  console.error('Could not prepare indexes. Check database configuration, permissions, and duplicate records.');
  process.exitCode = 1;
} finally {
  await database?.close();
}
