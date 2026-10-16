import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('unauthenticated and pending sessions cannot render finance routes or seeded records', async (t) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  t.after(() => vite.close());
  const { renderRoute } = await vite.ssrLoadModule('/test/routerHarness.jsx');
  for (const path of ['/', '/transactions', '/budgets', '/recurring', '/data', '/account', '/?source=local', '/unknown']) {
    assert.equal(renderRoute(path), '', `Anonymous access must be blocked for ${path}`);
    const pending = renderRoute(path, 'loading');
    assert.match(pending, /Checking your session/);
    assert.doesNotMatch(pending, /Main navigation|Monthly summary|Net balance|Personal workspace/);
  }
  for (const path of ['/login', '/register', '/forgot-password']) {
    const html = renderRoute(path);
    assert.match(html, /SpendWise/);
    assert.doesNotMatch(html, /Main navigation|Continue with local workspace|Monthly summary/);
  }
  assert.match(renderRoute('/login'), /Welcome back/);
  assert.match(renderRoute('/register'), /New accounts start empty/);
});
