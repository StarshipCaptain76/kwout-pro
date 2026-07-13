/**
 * Server-only helper: renders branded auth emails and sends them via Resend
 * (through the Lovable connector gateway).
 *
 * Used by the custom Resend-backed auth server functions in
 * `src/lib/auth-email.functions.ts`.
 */

type EmailAction =
  | "signup"
  | "magiclink"
  | "recovery"
  | "invite"
  | "email_change";

const FROM = "KWOUT <hello@welcome.kwout.co.za>";
const BRAND = "KWOUT";

const COPY: Record<
  EmailAction,
  { subject: string; heading: string; body: string; cta: string }
> = {
  signup: {
    subject: `Confirm your ${BRAND} account`,
    heading: "Welcome to KWOUT",
    body:
      "Tap the button below to confirm your email address and finish creating your account.",
    cta: "Confirm email",
  },
  magiclink: {
    subject: `Your ${BRAND} sign-in link`,
    heading: "Sign in to KWOUT",
    body: "Tap the button below to sign in. This link expires shortly.",
    cta: "Sign in",
  },
  recovery: {
    subject: `Reset your ${BRAND} password`,
    heading: "Password reset",
    body:
      "We received a request to reset your password. Tap the button below to choose a new one. If you didn't ask for this, you can ignore this email.",
    cta: "Reset password",
  },
  invite: {
    subject: `You've been invited to ${BRAND}`,
    heading: "You're invited",
    body:
      "Tap the button below to accept your invitation and set up your account.",
    cta: "Accept invite",
  },
  email_change: {
    subject: `Confirm your new ${BRAND} email`,
    heading: "Confirm email change",
    body: "Tap the button below to confirm the change to your email address.",
    cta: "Confirm change",
  },
};

function renderHtml(action: EmailAction, actionUrl: string): {
  subject: string;
  html: string;
} {
  const c = COPY[action];
  const html = `<!doctype html>
<html><body style="margin:0;background:#f5f5f5;font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;padding:32px;max-width:560px;">
        <tr><td style="padding-bottom:20px;">
          <div style="font:800 22px/1 -apple-system,Segoe UI,sans-serif;letter-spacing:2px;">${BRAND}</div>
        </td></tr>
        <tr><td>
          <h1 style="margin:0 0 12px;font:700 22px/1.3 -apple-system,Segoe UI,sans-serif;">${c.heading}</h1>
          <p style="margin:0 0 20px;color:#374151;">${c.body}</p>
          <a href="${actionUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:700;font-size:15px;">${c.cta}</a>
          <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">If the button doesn't work, copy and paste this URL into your browser:<br><span style="word-break:break-all;color:#374151;">${actionUrl}</span></p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">You received this because someone (hopefully you) used this address on ${BRAND}. If it wasn't you, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject: c.subject, html };
}

export async function sendResendAuthEmail(params: {
  to: string;
  action: EmailAction;
  actionUrl: string;
}): Promise<void> {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured");

  const { subject, html } = renderHtml(params.action, params.actionUrl);

  const resp = await fetch(
    "https://connector-gateway.lovable.dev/resend/emails",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": resendApiKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: [params.to],
        subject,
        html,
      }),
    },
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    console.error(
      `sendResendAuthEmail: Resend send failed [${resp.status}] ${errBody}`,
    );
    throw new Error(`Email send failed [${resp.status}]: ${errBody}`);
  }
}
