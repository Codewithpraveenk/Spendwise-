import { Router } from 'express';
import { accountAccess } from '../middleware/accountAccess.js';
import { createSessions } from '../auth/sessions.js';
import { createFinanceService, financeModels } from '../services/finance.js';
import { checkId, checkVersion, exactBody, listOptions, validateRecord } from '../services/financeValidation.js';

export function createFinanceRouter({ config, database }) {
  const router = Router();
  const sessions = database ? createSessions({ models: database.models, production: config.nodeEnv === 'production' }) : null;
  const service = database ? createFinanceService(database) : null;
  router.use(accountAccess(database));
  router.use((req, res, next) => sessions.requireUser(req, res, next));
  for (const kind of Object.keys(financeModels)) {
    router.get(`/${kind}`, async (req, res) => res.json(await service.list(kind, req.user._id, listOptions(req.query))));
    router.get(`/${kind}/:id`, async (req, res) => res.json({ item: await service.get(kind, req.user._id, checkId(req.params.id)) }));
    if (kind !== 'payments') {
      router.post(`/${kind}`, async (req, res) => res.status(201).json({ item: await service.create(kind, req.user._id, validateRecord(kind, req.body)) }));
      router.put(`/${kind}/:id`, async (req, res) => {
        const id = checkId(req.params.id);
        const values = validateRecord(kind, req.body, true);
        res.json({ item: await service.update(kind, req.user._id, id, req.body.version, values) });
      });
    }
    router.delete(`/${kind}/:id`, async (req, res) => {
      const id = checkId(req.params.id);
      exactBody(req.body, ['version']);
      await service.remove(kind, req.user._id, id, checkVersion(req.body.version));
      res.status(204).end();
    });
  }
  router.post('/recurring/:id/payments', async (req, res) => {
    const id = checkId(req.params.id);
    const body = exactBody(req.body, ['billMonth', 'date', 'version']);
    checkVersion(body.version);
    res.status(201).json(await service.recordPayment(req.user._id, id, body));
  });
  return router;
}
