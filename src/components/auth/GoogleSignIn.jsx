import { useEffect, useRef, useState } from 'react';
import { createAuthApi } from '../../services/authApi';
import { loadGoogleIdentity } from '../../services/googleIdentity';
import { useAuth } from '../../state/useAuth';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../ui/FormField';
import { Link } from 'react-router';

const api = createAuthApi();
export default function GoogleSignIn({ busy }) {
  const { googleLogin, error, clearError } = useAuth();
  const [stage, setStage] = useState('idle');
  const [failure, setFailure] = useState('');
  const [credential, setCredential] = useState(null);
  const [password, setPassword] = useState('');
  const [revision, setRevision] = useState(0);
  const container = useRef(null);
  const callback = useRef(null);
  const inFlight = useRef(false);
  callback.current = async (response) => {
    if (busy || inFlight.current) return;
    if (typeof response?.credential !== 'string') { setFailure('Google returned no sign-in credential. Please choose your account again.'); return; }
    inFlight.current = true; setCredential(response.credential); setPassword(''); setFailure('');
    try { await googleLogin({ credential: response.credential }); }
    finally { inFlight.current = false; }
  };
  const started = stage !== 'idle';
  useEffect(() => {
    if (!started) return;
    let disposed = false;
    let observer;
    const controller = new AbortController();
    setStage('loading'); setFailure('');
    Promise.all([api.googleChallenge(controller.signal), loadGoogleIdentity()]).then(([challenge, google]) => {
      if (disposed) return;
      google.initialize({ client_id: challenge.clientId, nonce: challenge.nonce, auto_select: false, ux_mode: 'popup', callback: (response) => { if (!disposed) callback.current(response); } });
      let lastWidth;
      const render = () => {
        if (disposed || !container.current) return;
        const available = container.current.clientWidth;
        const width = Math.floor(Math.min(360, available));
        if (width < 200 || width === lastWidth) return;
        lastWidth = width;
        container.current.replaceChildren();
        google.renderButton(container.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width });
      };
      render();
      observer = new ResizeObserver(render);
      observer.observe(container.current);
      setStage('ready');
    }).catch((reason) => { if (!disposed) { setFailure(reason.message); setStage('error'); } });
    return () => { disposed = true; controller.abort(); observer?.disconnect(); container.current?.replaceChildren(); };
  }, [started, revision]);
  const linking = credential && ['GOOGLE_LINK_REQUIRED', 'GOOGLE_LINK_PASSWORD'].includes(error?.code);
  async function link(event) {
    event.preventDefault();
    if (busy || inFlight.current || !password) return;
    inFlight.current = true;
    try { await googleLogin({ credential, password }); }
    finally { setPassword(''); inFlight.current = false; }
  }
  function restart() { if (busy) return; clearError(); setCredential(null); setPassword(''); setRevision((value) => value + 1); }
  return <section aria-label="Google sign-in" className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
    <h2 className="text-sm font-semibold">Continue with your Google account</h2>
    <p className="mt-2 text-xs leading-5 text-slate-500">Google sign-in uses the same private SpendWise account storage. It requests your basic profile and email, with no Gmail or bank access.</p>
    {stage === 'idle' && <button type="button" disabled={busy} onClick={() => setStage('loading')} className={`mt-4 w-full ${secondaryButtonClass}`}>Continue with Google</button>}
    {stage === 'loading' && <p role="status" className="mt-4 text-sm text-slate-600">Loading Google sign-in…</p>}
    {failure && <p role="alert" className="mt-4 text-sm leading-6 text-rose-800">{failure}</p>}
    {error?.code?.startsWith('GOOGLE_') && <p role="alert" className="mt-4 text-sm leading-6 text-rose-800">{error.message}</p>}
    <div ref={container} aria-hidden={busy || Boolean(linking)} inert={busy || Boolean(linking)} className={`mt-4 min-h-0 w-full overflow-hidden ${busy || linking ? 'hidden' : ''}`} />
    {busy && started && <p role="status" className="mt-4 text-sm text-slate-600">Verifying your account…</p>}
    {linking && <form onSubmit={link} className="mt-4 space-y-3" aria-busy={busy}>
      <p className="text-sm leading-6 text-slate-700">Your email already has a SpendWise account. Enter its password to connect Google to that account and retain your records.</p>
      <label htmlFor="google-link-password" className="block text-sm font-medium">Existing SpendWise password</label>
      <input id="google-link-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={128} disabled={busy} className={inputClass} />
      <button type="submit" disabled={busy || !password} className={`${primaryButtonClass} disabled:opacity-50`}>Connect Google and sign in</button>
      <Link to="/forgot-password" className="block py-2 text-sm font-medium text-indigo-700 underline">Forgot your SpendWise password?</Link>
    </form>}
    {started && !busy && <button type="button" onClick={restart} className="mt-4 min-h-11 text-sm font-medium text-indigo-700 underline">{stage === 'error' ? 'Retry Google sign-in' : 'Choose Google account again'}</button>}
  </section>;
}
