let loading;
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timeout = setTimeout(() => fail(), 15000);
    function fail() { clearTimeout(timeout); script.remove(); loading = undefined; reject(new Error('Google sign-in could not load. Check your connection or browser blocking settings, then retry.')); }
    script.onerror = fail;
    script.onload = () => {
      if (!window.google?.accounts?.id) { fail(); return; }
      clearTimeout(timeout); resolve(window.google.accounts.id);
    };
    document.head.appendChild(script);
  });
  return loading;
}
