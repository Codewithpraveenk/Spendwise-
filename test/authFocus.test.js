import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('popup focus cannot start anonymous checks or interrupt Google verification; authenticated focus still checks expiry', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:5173/login', pretendToBeVisual: true });
  const originals = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    dom.window.close();
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  });
  let meCalls = 0; let signedIn = false; let resolveGoogle;
  const user = { id: 'fixture-user', name: 'Fixture', email: 'fixture@example.com' };
  globalThis.fetch = async (url) => {
    if (url === '/api/auth/me') {
      meCalls++;
      return signedIn ? Response.json({ user }) : Response.json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in' } }, { status: 401 });
    }
    assert.equal(url, '/api/auth/google');
    return new Promise((resolve) => { resolveGoogle = () => { signedIn = true; resolve(Response.json({ user })); }; });
  };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  t.after(() => vite.close());
  const { mountProbe } = await vite.ssrLoadModule('/test/authFocusHarness.jsx');
  const container = dom.window.document.getElementById('root');
  const probe = await mountProbe(container);
  try {
    assert.match(container.textContent, /anonymous:no-user/);
    assert.equal(meCalls, 1);
    await probe.act(async () => dom.window.dispatchEvent(new dom.window.Event('focus')));
    assert.equal(meCalls, 1, 'Returning from an anonymous popup must not recheck the session');
    await probe.act(async () => container.querySelector('button').click());
    assert.match(container.textContent, /submitting:no-user/);
    await probe.act(async () => dom.window.dispatchEvent(new dom.window.Event('focus')));
    assert.equal(meCalls, 1, 'Focus must not abort the pending credential verification');
    await probe.act(async () => resolveGoogle());
    assert.match(container.textContent, /authenticated:fixture-user/);
    await probe.act(async () => dom.window.dispatchEvent(new dom.window.Event('focus')));
    assert.equal(meCalls, 2, 'Existing sessions must still be checked when returning to the app');
    assert.match(container.textContent, /authenticated:fixture-user/);
  } finally { await probe.close(); }
});
