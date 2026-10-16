import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { createAuthApi } from '../services/authApi';
import { useAuth } from '../state/useAuth';
import FormField, { inputClass, primaryButtonClass } from '../components/ui/FormField';
import { AccountError } from './AccountPage';
import { readRecoveryToken, consumeRecoveryFragment } from '../utils/recoveryLink';

const api = createAuthApi();
export default function RecoveryPage({ resetting = false }) {
  const { expire } = useAuth();
  const [token, setToken] = useState(() => resetting ? readRecoveryToken(window.location.hash) : '');
  const [values, setValues] = useState({ email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  const operation = useRef(null);
  const form = useRef(null);
  const validToken = /^[a-f0-9]{64}$/.test(token);
  useEffect(() => {
    const capture = () => {
      if (!resetting) return;
      const next = consumeRecoveryFragment(window.location, window.history);
      if (next === null) return;
      operation.current?.abort(); operation.current = null;
      setToken(next); setValues({ email: '', password: '', confirm: '' }); setErrors({}); setFailure(null); setMessage(''); setDone(false); setBusy(false);
    };
    capture();
    window.addEventListener('hashchange', capture);
    return () => { operation.current?.abort(); window.removeEventListener('hashchange', capture); };
  }, [resetting]);
  function update(name, value) { setValues((previous) => ({ ...previous, [name]: value })); setErrors((previous) => ({ ...previous, [name]: undefined })); }
  async function submit(event) {
    event.preventDefault();
    if (operation.current || done || (resetting && !validToken)) return;
    const next = {};
    if (!resetting && (values.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))) next.email = 'Enter a valid email address.';
    if (resetting && (values.password.length < 15 || values.password.length > 128)) next.password = 'Use 15–128 characters. Spaces are welcome.';
    if (resetting && values.password !== values.confirm) next.confirm = 'The passwords do not match.';
    setErrors(next); setFailure(null); setMessage('');
    if (Object.keys(next).length) { form.current?.elements.namedItem(Object.keys(next)[0])?.focus(); return; }
    const controller = new AbortController(); operation.current = controller; setBusy(true);
    try {
      const result = resetting ? await api.resetPassword({ token, password: values.password }, controller.signal) : await api.forgotPassword(values.email.trim(), controller.signal);
      if (controller.signal.aborted) return;
      if (resetting) { expire(); setValues({ email: '', password: '', confirm: '' }); setDone(true); }
      setMessage(result);
    } catch (error) { if (!controller.signal.aborted) { setFailure(error); setValues((previous) => ({ ...previous, password: '', confirm: '' })); } }
    finally { if (operation.current === controller) { operation.current = null; if (!controller.signal.aborted) setBusy(false); } }
  }
  return <section className="mx-auto max-w-lg">
    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Account recovery</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight">{resetting ? 'Choose a new password' : 'Forgot your password?'}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">{resetting ? 'Your finance records stay unchanged. Resetting ends previous account sessions.' : 'Enter your SpendWise account email. We’ll send a one-time link if it has a password. Google-only accounts can continue with Google.'}</p>
    <form ref={form} onSubmit={submit} noValidate aria-busy={busy} className="mt-7 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
      <AccountError error={failure} />
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">{message}</p>}
      {resetting && !validToken && <p role="alert" className="text-sm leading-6 text-amber-900">Open the complete reset link from your email. If you refreshed this page, reopen that email link.</p>}
      <fieldset disabled={busy || done || (resetting && !validToken)} className="min-w-0 space-y-5 disabled:opacity-60"><legend className="sr-only">{resetting ? 'New password details' : 'Recovery email'}</legend>
        {!resetting ? <FormField name="recovery-email" label="Email address" error={errors.email}><input id="recovery-email" name="email" type="email" autoComplete="email" value={values.email} onChange={(event) => update('email', event.target.value)} maxLength={254} required className={inputClass} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'recovery-email-error' : undefined} /></FormField> : <>
          <FormField name="recovery-password" label="New password" error={errors.password} hint="Use 15–128 characters and avoid reusing a password."><input id="recovery-password" name="password" type={visible ? 'text' : 'password'} autoComplete="new-password" value={values.password} onChange={(event) => update('password', event.target.value)} required maxLength={128} className={inputClass} aria-invalid={Boolean(errors.password)} aria-describedby={`recovery-password-hint${errors.password ? ' recovery-password-error' : ''}`} /></FormField>
          <FormField name="recovery-confirm" label="Confirm new password" error={errors.confirm}><input id="recovery-confirm" name="confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" value={values.confirm} onChange={(event) => update('confirm', event.target.value)} required maxLength={128} className={inputClass} aria-invalid={Boolean(errors.confirm)} aria-describedby={errors.confirm ? 'recovery-confirm-error' : undefined} /></FormField>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />Show passwords</label>
        </>}
        <button type="submit" className={`${primaryButtonClass} w-full disabled:opacity-50`}>{busy ? 'Please wait…' : resetting ? 'Save new password' : 'Send reset link'}</button>
      </fieldset>
      {!resetting && message && <p className="text-xs leading-5 text-slate-500">Links expire after 15 minutes. Allow a minute for delivery; repeated requests within 60 seconds keep the existing link. Delivery failures are retried by the server.</p>}
    </form>
    <div className="mt-5 flex flex-wrap gap-5 text-sm font-medium text-indigo-700"><Link to="/login" className="inline-flex min-h-11 items-center underline">Back to sign in</Link>{resetting && !done && <Link to="/forgot-password" className="inline-flex min-h-11 items-center underline">Request a new reset link</Link>}</div>
  </section>;
}
