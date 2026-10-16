import { loadConfig } from './config/env.js';
import { connectDatabase } from './database.js';
import { startupFailure } from './startupFailure.js';

let database;
let stage = 'configuration';
try {
  const config = loadConfig();
  if (!config.mongodbUri) throw new Error('Database is not configured.');
  stage = 'database_connection';
  database = await connectDatabase(config.mongodbUri);
  // Add declared indexes; never use syncIndexes here, which could drop indexes.
  stage = 'index_creation';
  for (const model of Object.values(database.models)) await model.createIndexes();
  console.log('Database indexes are ready.');
} catch (error) {
  console.error(JSON.stringify(startupFailure(error, stage)));
  process.exitCode = 1;
} finally {
  await database?.close();
}
