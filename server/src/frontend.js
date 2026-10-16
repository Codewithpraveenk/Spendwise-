import express from 'express';
import { statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

export function mountFrontend(app, directory) {
  const root = resolve(directory); const index = join(root, 'index.html');
  try { if (!statSync(index).isFile()) throw new Error(); }
  catch { throw new Error('Frontend build is missing. Run npm run build before starting the combined server.'); }
  app.use(express.static(root, { index: false, dotfiles: 'deny', redirect: false,
    setHeaders(res, path) {
      const immutable = path.startsWith(join(root, 'assets') + sep) && /-[a-zA-Z0-9_-]{8,}\.[a-z0-9]+$/i.test(path);
      res.set('Cache-Control', path === index ? 'no-store' : immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  }));
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || !req.accepts('html') || extname(req.path) || req.path.startsWith('/assets') || req.path.split('/').some((part) => part.startsWith('.'))) return next();
    res.sendFile(index, { headers: { 'Cache-Control': 'no-store' } });
  });
}
