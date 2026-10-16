const target = process.env.SPENDWISE_API_TARGET || 'http://127.0.0.1:5000';
let failed = false;
for (const [label, origin] of [['API', target], ['Frontend API proxy', 'http://127.0.0.1:5173']]) {
  try {
    const response = await fetch(new URL('/api/ready', origin), { signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    if (!response.ok || data.status !== 'ready' || data.database !== 'connected') throw new Error();
    console.log(`${label}: ready; database connected.`);
  } catch {
    failed = true;
    console.error(`${label}: unavailable or not ready.`);
  }
}
if (failed) {
  console.error('From the SpendWise folder, run npm run dev. Check the api terminal output if MongoDB is unavailable. Keep private credentials out of shared logs.');
  process.exitCode = 1;
} else console.log('Local account service and frontend proxy are ready. This does not verify Google or email-provider configuration.');
