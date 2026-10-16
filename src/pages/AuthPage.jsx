import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../state/useAuth';
import { validateAccount } from '../services/authApi';
import FormField, { inputClass, primaryButtonClass } from '../components/ui/FormField';
import { AccountError } from './AccountPage';
import GoogleSignIn from '../components/auth/GoogleSignIn';

export default function AuthPage({ registering = false }) {
  const { user, status, error, login, register, clearError } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [visible, setVisible] = useState(false);
  const formRef = useRef(null);
  useEffect(() => { clearError(); }, [registering, clearError]);
  if (user) return <Navigate to="/account" replace />;
  const busy = status === 'loading' || status === 'submitting';
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const validation = validateAccount(values, registering);
    setErrors(validation);
    if (Object.keys(validation).length) {
      formRef.current?.elements.namedItem(Object.keys(validation)[0])?.focus();
      return;
    }
    const payload = { email: values.email.trim(), password: values.password, ...(registering ? { name: values.name.trim() } : {}) };
    const ok = await (registering ? register(payload) : login(payload));
    if (ok) { setValues({ name: '', email: '', password: '', confirmPassword: '' }); navigate('/account', { replace: true }); }
    else setValues((previous) => ({ ...previous, password: '', confirmPassword: '' }));
  }
  const field = (name, label, type, autoComplete, hint) => <FormField key={name} name={name} label={label} error={errors[name]} hint={hint}>
    <input id={name} name={name} type={type} autoComplete={autoComplete} value={values[name]} onChange={(event) => { setValues({ ...values, [name]: event.target.value }); setErrors((previous) => ({ ...previous, [name]: undefined })); }} className={inputClass} required aria-invalid={Boolean(errors[name])} aria-describedby={[errors[name] ? `${name}-error` : '', hint ? `${name}-hint` : ''].filter(Boolean).join(' ') || undefined} maxLength={name === 'email' ? 254 : name === 'name' ? 80 : 128} />
  </FormField>;
  return <section className="mx-auto max-w-lg">
    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">SpendWise account</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight">{registering ? 'Create your account' : 'Welcome back'}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">{registering ? 'Start with a name, email, and a memorable passphrase.' : 'Sign in with your email and password.'}</p>
    <form ref={formRef} onSubmit={submit} noValidate className="mt-7 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7" aria-busy={busy}>
      <AccountError error={error?.code?.startsWith('GOOGLE_') ? null : error} />
      {status === 'loading' && <p role="status" className="text-sm text-slate-600">Checking your session…</p>}
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
        <legend className="sr-only">{registering ? 'Registration details' : 'Sign-in details'}</legend>
        {registering && field('name', 'Your name', 'text', 'name')}
        {field('email', 'Email address', 'email', 'username')}
        {field('password', 'Password', visible ? 'text' : 'password', registering ? 'new-password' : 'current-password', registering ? 'Use 15–128 characters. Spaces are welcome; avoid reusing a password.' : undefined)}
        {!registering && <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 underline">Forgot password?</Link>}
        {registering && field('confirmPassword', 'Confirm password', visible ? 'text' : 'password', 'new-password')}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-600"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} className="size-4" />Show password</label>
        <button type="submit" className={`${primaryButtonClass} w-full disabled:opacity-50`} disabled={busy}>{status === 'submitting' ? (registering ? 'Creating account…' : 'Signing in…') : registering ? 'Create account' : 'Sign in'}</button>
      </fieldset>
      <p className="text-center text-sm text-slate-600">{registering ? 'Already have an account?' : 'New to SpendWise?'} <Link to={registering ? '/login' : '/register'} className="font-semibold text-indigo-700 underline">{registering ? 'Sign in' : 'Create account'}</Link></p>
    </form>
    <GoogleSignIn busy={busy} />
    <p className="mt-5 text-sm leading-6 text-slate-600">After signing in, choose Account data on Overview, Transactions, Budgets, Recurring payments, or Data & backups for server records. Your local workspace stays separate and is never imported automatically.</p>
    <Link to="/" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 underline">Continue with local workspace</Link>
  </section>;
}
