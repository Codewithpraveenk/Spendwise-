export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production.');

  const portText = env.PORT ?? '5000';
  if (!/^\d+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) throw new Error('PORT must be an integer from 1 to 65535.');

  const host = env.HOST ?? (nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1');
  if (!host || host.trim() !== host || /\s|\//.test(host)) throw new Error('HOST must be a hostname or IP address without spaces or a URL scheme.');

  // Render supplies this server-side value; explicit origins still support custom domains.
  const renderOrigin = env.RENDER === 'true' ? env.RENDER_EXTERNAL_URL?.trim() : undefined;
  const originText = env.CLIENT_ORIGINS ?? (nodeEnv === 'production' && renderOrigin ? renderOrigin : 'http://localhost:5173,http://127.0.0.1:5173');
  const clientOrigins = [...new Set(originText.split(',').map((value) => value.trim()))];
  if (!clientOrigins.length || clientOrigins.some((value) => {
    try {
      const url = new URL(value);
      return !['http:', 'https:'].includes(url.protocol) || url.origin !== value || Boolean(url.username || url.password);
    } catch { return true; }
  })) throw new Error('CLIENT_ORIGINS must contain comma-separated HTTP(S) origins without paths, trailing slashes, or wildcards.');

  const mongodbUri = env.MONGODB_URI?.trim() || undefined;
  if (mongodbUri && !/^mongodb(?:\+srv)?:\/\//.test(mongodbUri)) throw new Error('MONGODB_URI must use mongodb:// or mongodb+srv://.');
  if (nodeEnv === 'production' && !mongodbUri) throw new Error('MONGODB_URI is required in production.');

  const googleClientId = env.GOOGLE_CLIENT_ID?.trim() || undefined;
  if (googleClientId && !/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(googleClientId)) throw new Error('GOOGLE_CLIENT_ID must be a Google web application client ID.');

  const frontendSetting = env.SERVE_FRONTEND ?? (nodeEnv === 'production' ? 'true' : 'false');
  if (!['true', 'false'].includes(frontendSetting)) throw new Error('SERVE_FRONTEND must be true or false.');
  const proxySetting = env.TRUST_PROXY ?? 'false';
  if (!['false', 'loopback', '1'].includes(proxySetting)) throw new Error('TRUST_PROXY must be false, loopback, or 1 for a verified single-proxy deployment.');
  const trustProxy = proxySetting === '1' ? 1 : proxySetting === 'loopback' ? 'loopback' : false;

  const appOrigin = env.APP_ORIGIN?.trim() || (nodeEnv === 'production' ? renderOrigin : 'http://localhost:5173');
  if (!appOrigin || !clientOrigins.includes(appOrigin) || (nodeEnv === 'production' && !appOrigin.startsWith('https://'))) throw new Error('APP_ORIGIN must be an allowed frontend origin and use HTTPS in production.');
  const mailKey = env.MAIL_ENCRYPTION_KEY?.trim() || undefined;
  if (mailKey && !/^[a-f0-9]{64}$/i.test(mailKey)) throw new Error('MAIL_ENCRYPTION_KEY must contain 64 hexadecimal characters.');
  const mailProvider = env.MAIL_PROVIDER ?? 'smtp';
  if (!['smtp', 'brevo', 'disabled'].includes(mailProvider)) throw new Error('MAIL_PROVIDER must be smtp, brevo, or disabled.');
  let brevo;
  if (mailProvider === 'brevo') {
    const apiKey = env.BREVO_API_KEY?.trim();
    const from = env.MAIL_FROM?.trim();
    if (!apiKey || /\s/.test(apiKey) || !from || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from) || !mailKey) throw new Error('Brevo requires BREVO_API_KEY, a valid MAIL_FROM, and MAIL_ENCRYPTION_KEY.');
    brevo = Object.freeze({ apiKey, from });
  }
  const smtpHost = mailProvider === 'smtp' ? env.SMTP_HOST?.trim() || undefined : undefined;
  let smtp;
  if (smtpHost) {
    const port = env.SMTP_PORT ?? '465';
    const secure = env.SMTP_SECURE ?? 'true';
    const from = env.MAIL_FROM?.trim();
    if (!/^\d+$/.test(port) || +port < 1 || +port > 65535 || !['true', 'false'].includes(secure) || !env.SMTP_USER || !env.SMTP_PASSWORD || !from || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from) || !mailKey) throw new Error('Provide complete SMTP settings, a valid MAIL_FROM email, and MAIL_ENCRYPTION_KEY.');
    smtp = Object.freeze({ host: smtpHost, port: +port, secure: secure === 'true', user: env.SMTP_USER, password: env.SMTP_PASSWORD, from });
  }

  return Object.freeze({ nodeEnv, host, port: Number(portText), clientOrigins: Object.freeze(clientOrigins), mongodbUri, googleClientId, appOrigin, mailKey, smtp, brevo, serveFrontend: frontendSetting === 'true', trustProxy });
}
