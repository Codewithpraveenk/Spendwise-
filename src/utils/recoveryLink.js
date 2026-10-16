export function readRecoveryToken(fragment) {
  const token = new URLSearchParams(fragment.replace(/^#/, '')).get('token') ?? '';
  return /^[a-f0-9]{64}$/.test(token) ? token : '';
}

// Preserve router history state while removing the secret from the address bar.
// No fragment means no new email link; keep an already captured in-memory token.
export function consumeRecoveryFragment(location, history) {
  if (!location.hash) return null;
  const token = readRecoveryToken(location.hash);
  history.replaceState(history.state, '', location.pathname + location.search);
  return token;
}
