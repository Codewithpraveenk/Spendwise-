import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../src/state/AuthProvider';
import { useAuth } from '../src/state/useAuth';

function Probe() {
  const { status, user, googleLogin } = useAuth();
  return <><p>{status}:{user?.id ?? 'no-user'}</p><button onClick={() => { void googleLogin({ credential: 'fixture-only' }); }}>Google callback</button></>;
}

export async function mountProbe(container) {
  const root = createRoot(container);
  await act(async () => { root.render(<AuthProvider><Probe /></AuthProvider>); });
  return { act, async close() { await act(async () => root.unmount()); } };
}
