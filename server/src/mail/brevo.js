// Fixed HTTPS endpoints; provider response bodies and credentials never reach logs.
export function createBrevoMailer(settings, request = fetch) {
  async function call(path, options = {}) {
    try {
      const response = await request(`https://api.brevo.com/v3/${path}`, {
        ...options, redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'api-key': settings.apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch { throw new Error('Email provider request failed.'); }
  }
  return {
    async sendMail(message) {
      const result = await call('smtp/email', { method: 'POST', body: JSON.stringify({
        sender: { name: 'SpendWise', email: settings.from }, to: [{ email: message.to }],
        subject: message.subject, textContent: message.text,
      }) });
      if (typeof result.messageId !== 'string' || !result.messageId) throw new Error('Email provider did not accept the message.');
      // Acceptance is not a guarantee of inbox delivery; verify provider events separately.
      return { accepted: [message.to], rejected: [], messageId: result.messageId };
    },
    async verify() { await call('account'); },
    close() {},
  };
}
