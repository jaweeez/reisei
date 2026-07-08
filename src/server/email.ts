import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';

// SES email sender (server-only; never in the client bundle). AWS SDK v3's default
// credential chain reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION from env.
// When SES isn't configured we LOG the message instead of sending, so local dev works
// without AWS (mirrors the coach's keyword fallback when chatEnabled() is false).

export const emailEnabled = () => Boolean(process.env.SES_FROM_EMAIL);

let _client: SESv2Client | null = null;
function client(): SESv2Client {
  if (!_client) _client = new SESv2Client({ region: process.env.SES_REGION || process.env.AWS_REGION || 'us-east-1' });
  return _client;
}

export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  const from = process.env.SES_FROM_EMAIL;
  if (!from) {
    // Dev fallback: no SES configured, so log it (the code lands in the server logs).
    console.log(`[email:dev] to=${opts.to} subject="${opts.subject}"\n${opts.text}`);
    return;
  }
  await client().send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [opts.to] },
      Content: {
        Simple: {
          Subject: { Data: opts.subject },
          Body: { Text: { Data: opts.text }, ...(opts.html ? { Html: { Data: opts.html } } : {}) },
        },
      },
    }),
  );
}

/** The verification / reset code email. Terse, in voice, no em dashes. */
export async function sendCodeEmail(to: string, code: string, purpose: 'verify_email' | 'pin_reset'): Promise<void> {
  const subject = purpose === 'pin_reset' ? 'Your Reisei reset code' : 'Verify your Reisei email';
  const line = purpose === 'pin_reset' ? 'Use this code to set a new PIN.' : 'Use this code to verify your email.';
  const text = `${line}\n\n${code}\n\nThis code expires in 10 minutes. If this was not you, ignore this email.`;
  await sendEmail({ to, subject, text });
}
