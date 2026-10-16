import { Router } from 'express';

export function createHealthRouter() {
  const router = Router();
  router.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', service: 'spendwise-api', timestamp: new Date().toISOString() });
  });
  return router;
}
