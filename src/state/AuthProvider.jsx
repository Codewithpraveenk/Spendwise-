import { useCallback, useEffect, useRef, useState } from 'react';
import { createAuthApi } from '../services/authApi';
import { AuthContext } from './useAuth.js';

// Keep account details in memory; the HttpOnly session cookie stays server-managed.
const api = createAuthApi();

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, status: 'loading', error: null });
  const active = useRef(null);
  const perform = useCallback(async (operation, { checking = false } = {}) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState((previous) => ({ ...previous, status: checking ? 'loading' : 'submitting', error: null }));
    try {
      const user = await operation(controller.signal);
      if (controller.signal.aborted) return false;
      setState({ user, status: user ? 'authenticated' : 'anonymous', error: null });
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      if (checking && error.status === 401) {
        setState({ user: null, status: 'anonymous', error: null });
      } else {
        setState((previous) => ({ ...previous, status: previous.user ? 'authenticated' : 'anonymous', error }));
      }
      return false;
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, []);
  const refresh = useCallback(() => perform((signal) => api.me(signal), { checking: true }), [perform]);
  const clearError = useCallback(() => setState((previous) => ({ ...previous, error: null })), []);
  const expire = useCallback(() => { active.current?.abort(); setState({ user: null, status: 'anonymous', error: null }); }, []);
  useEffect(() => {
    refresh();
    const onFocus = () => { if (document.visibilityState === 'visible' && !active.current) refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { active.current?.abort(); window.removeEventListener('focus', onFocus); };
  }, [refresh]);
  return <AuthContext.Provider value={{ ...state, refresh, clearError, expire,
    login: (values) => perform((signal) => api.login(values, signal)),
    register: (values) => perform((signal) => api.register(values, signal)),
    googleLogin: (values) => perform((signal) => api.google(values, signal)),
    logout: () => perform(async (signal) => { await api.logout(signal); return null; }),
  }}>{children}</AuthContext.Provider>;
}
