# Free hosting and HTTPS email setup

The user chose free hosting. Brevo's HTTPS transactional email API is implemented; no live Brevo credentials are configured yet. Local Gmail SMTP remains available until you switch providers explicitly.

## What to do next

1. Create a free account at https://www.brevo.com/ and complete its onboarding. Check the current free sending allowance and account approval requirements there.
2. In Brevo's sender settings, add a SpendWise sender and verify the address. Follow any required sender/domain authentication steps. A domain you control is preferable for public use. Gmail domains cannot be authenticated by you; Brevo may replace a free-provider sender with its compliant sending address. Do not assume a Gmail address gives a custom authenticated domain.
3. Create a Brevo **API key**, not an SMTP key. Keep it out of chat and source control.
4. Open `C:\Users\Praveen\Documents\Spendwise\server\.env` in VS Code. Preserve the existing mail encryption key. Add or update the following privately, using your approved sender:

```dotenv
MAIL_PROVIDER=brevo
BREVO_API_KEY=your-private-api-key
MAIL_FROM=your-verified-sender@example.com
```

Unused SMTP settings are ignored when Brevo is selected; there is no automatic SMTP fallback. Without MAIL_PROVIDER, the existing SMTP behavior remains the default.

5. Verify authentication from the project root:

```powershell
cd C:\Users\Praveen\Documents\Spendwise
npm --prefix server run mail:check
```

This reads provider account metadata to check API authentication and sends no email. It does not prove sender approval or inbox delivery. Restart the backend and request a real password reset privately to test delivery; inspect Brevo delivery events. Never send a password or reset link in chat.

6. Use the same private values in the eventual hosting secret settings. Set APP_ORIGIN and CLIENT_ORIGINS to the public HTTPS origin and add it to Google's web client origins.

## Limits and operational behavior

The existing encrypted Atlas queue, leases and bounded retries work with both transports. HTTP calls have a ten-second timeout and never log provider responses or keys. A provider acknowledgment marks a job sent; it does not prove delivery. An ambiguous timeout or process failure can cause a duplicate email on retry; the reset token itself remains single-use.

Free hosting can sleep. Reset requests wake the app, but background retries pause while it is asleep. Free tiers have sending/runtime quotas; they are suitable for a portfolio deployment, not an always-available production guarantee. Provider quotas, bounces, delivery alerts and domain authentication still require operational setup.

References: [Brevo send API](https://developers.brevo.com/docs/send-a-transactional-email), [sender requirements](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders), [Render free limitations](https://render.com/docs/free).
