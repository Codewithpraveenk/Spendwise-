import express, { Router } from 'express';
import { accountAccess } from '../middleware/accountAccess.js';
import { createSessions } from '../auth/sessions.js';
import { createWorkspaceService } from '../services/workspace.js';
import { exactBody, invalid } from '../services/financeValidation.js';

export function createWorkspaceRouter({ config, database }) {
  const router = Router();
  const sessions = database ? createSessions({ models: database.models, production: config.nodeEnv === 'production' }) : null;
  const service = database ? createWorkspaceService(database) : null;
  router.use(accountAccess(database));
  router.use((req, res, next) => sessions.requireUser(req, res, next));
  router.use(express.json({ limit: '5mb' }));
  router.use((req, _res, next) => { if (Object.keys(req.query).length) invalid('Workspace requests do not accept query parameters.'); next(); });
  router.get('/', async (req, res) => res.json({ workspace: await service.export(req.user._id) }));
  router.post('/preview', async (req, res) => {
    exactBody(req.body, ['workspace']);
    res.json(await service.preview(req.user._id, req.body.workspace));
  });
  router.post('/import', async (req, res) => {
    exactBody(req.body, ['workspace', 'requestId']);
    res.json(await service.import(req.user._id, req.body.workspace, req.body.requestId));
  });
  return router;
}
