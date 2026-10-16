export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', retryAfter } = {}) {
    super(message);
    this.name = 'ApiError';
    Object.assign(this, { status, code, retryAfter });
  }
}

export function createAuthApi(fetcher = (...args) => fetch(...args), timeoutMs = 15000) {
  async function request(path, { method = 'GET', body, signal, challenge = false, notice = false } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await fetcher(`/api/auth/${path}`, {
        method, credentials: 'include', signal: controller.signal,
        headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json', 'X-Spendwise-Request': '1' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 204) return null;
      let data;
      try { data = await response.json(); }
      catch (error) {
        if (controller.signal.aborted) throw error;
        throw new ApiError(response.status >= 500 ? 'Cannot reach the account server. Check that the backend is running and MongoDB is configured, then try again.' : 'The server returned an unreadable response. Please try again.', { status: response.status, code: 'INVALID_RESPONSE' });
      }
      if (!response.ok) throw new ApiError(data.error?.message ?? 'The request failed. Please try again.', { status: response.status, code: data.error?.code ?? 'REQUEST_FAILED', retryAfter: response.headers.get('retry-after') });
      if (notice) {
        if (typeof data?.message !== 'string' || !data.message || data.message.length > 1000) throw new ApiError('The server did not confirm the recovery request. Try signing in or requesting a fresh link.', { code: 'INVALID_RESPONSE' });
        return data.message;
      }
      if (challenge) {
        if (!/^[a-f0-9]{64}$/.test(data?.nonce ?? '') || typeof data?.clientId !== 'string' || !/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(data.clientId)) throw new ApiError('The server returned invalid Google sign-in configuration.', { code: 'INVALID_RESPONSE' });
        return { nonce: data.nonce, clientId: data.clientId };
      }
      const user = data.user;
      if (!user || ['id', 'name', 'email'].some((key) => typeof user[key] !== 'string' || !user[key])) throw new ApiError('The server returned incomplete account details.', { code: 'INVALID_RESPONSE' });
      return { id: user.id, name: user.name, email: user.email };
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'The account request timed out. Check your connection and try again.' : 'Cannot reach the account server. Check that the backend is running, then try again.');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  return {
    me: (signal) => request('me', { signal }),
    login: (body, signal) => request('login', { method: 'POST', body, signal }),
    register: (body, signal) => request('register', { method: 'POST', body, signal }),
    googleChallenge: (signal) => request('google/challenge', { signal, challenge: true }),
    google: ({ credential, password }, signal) => request('google', { method: 'POST', body: { credential, ...(password !== undefined ? { password } : {}) }, signal }),
    forgotPassword: (email, signal) => request('forgot-password', { method: 'POST', body: { email }, signal, notice: true }),
    resetPassword: ({ token, password }, signal) => request('reset-password', { method: 'POST', body: { token, password }, signal, notice: true }),
    logout: (signal) => request('logout', { method: 'POST', body: {}, signal }),
  };
}

export function validateAccount(values, registering) {
  const errors = {};
  if (registering && (!values.name.trim() || values.name.trim().length > 80)) errors.name = 'Enter a name between 1 and 80 characters.';
  if (values.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (values.password.length < (registering ? 15 : 1) || values.password.length > 128) errors.password = registering ? 'Use a passphrase of 15–128 characters.' : 'Enter your password (up to 128 characters).';
  if (registering && values.confirmPassword !== values.password) errors.confirmPassword = 'The passwords do not match.';
  return errors;
}
