import { setTimeout as delay } from 'node:timers/promises';

const target = process.env.SPENDWISE_API_TARGET || 'http://127.0.0.1:5000';
const deadline = Date.now() + 30000;
console.log('Waiting for the account API and database before starting the frontend…');
let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch(new URL('/api/ready', target), { signal: AbortSignal.timeout(1000) });
    const data = await response.json();
    if (response.ok && data.status === 'ready' && data.database === 'connected') { ready = true; break; }
  } catch { /* API startup or database connection may still be in progress. */ }
  await delay(500);
}
if (!ready) {
  console.error('The account API did not become ready within 30 seconds. Check the api output and private server/.env configuration, then retry npm run dev.');
  process.exitCode = 1;
} else console.log('Account API ready. Starting the frontend.');
