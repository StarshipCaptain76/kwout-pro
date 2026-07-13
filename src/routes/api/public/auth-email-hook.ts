import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Supabase Auth "Send Email" hook endpoint.
 *
 * Supabase POSTs an event here every time an auth email should go out.
 * We verify the Standard Webhooks signature, render a branded email, and
 * send it via Resend from hello@welcome.kwout.co.za.
 *
 * Configure in Supabase (Cloud → Users → Auth Settings → Send email hook):
 *   URL:    https://kwout.co.za/api/public/auth-email-hook
 *   Secret: v1,whsec_<AUTH_EMAIL_HOOK_SECRET> (see instructions in chat)
 */

type EmailAction =
  | "signup"
  | "login"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email_change_current"
  | "email_change_new"
  | "reauthentication";

interface SendEmailPayload {
  user: { email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailAction;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

const FROM = "KWOUT <hello@welcome.kwout.co.za>";
const BRAND = "KWOUT";

function verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  // Reject replays older than 5 minutes.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;

  // Secret in Supabase must be stored as "v1,whsec_<base64>". Strip the prefix
  // so we can compare against raw HMAC bytes.
  const base64Secret = secret.replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
  const secretBytes = Buffer.from(base64Secret, "base64");

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  // Header format: "v1,<sig1> v1,<sig2> ..." — any match is valid.
  for (const part of signatureHeader.split(" ")) {
    const [, sig] = part.split(",");
    if (!sig) continue;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

function buildActionUrl(p: SendEmailPayload["email_data"]): string {
  const url = new URL(`${p.site_url.replace(/\/$/, "")}/auth/callback`);
  // Preserve Supabase's verify flow: /auth/v1/verify handles the token_hash.
  const verifyUrl = new URL(`${p.site_url.replace(/\/$/, "")}/auth/callback`);
  // Use Supabase's built-in verify endpoint so tokens are consumed correctly.
  const supabaseVerify = new URL(
    `${process.env.SUPABASE_URL}/auth/v1/verify`,
  );
  supabaseVerify.searchParams.set("token", p.token_hash);
  supabaseVerify.searchParams.set("type", p.email_action_type);
  supabaseVerify.searchParams.set("redirect_to", p.redirect_to || verifyUrl.toString());
  void url;
  return supabaseVerify.toString();
}

function renderEmail(action: EmailAction, actionUrl: string, token: string) {
  const copy: Record<EmailAction, { subject: string; heading: string; body: string; cta: string }> = {
    signup: {
      subject: `Confirm your ${BRAND} account`,
      heading: "Welcome to KWOUT",
      body: "Tap the button below to confirm your email address and finish creating your account.",
      cta: "Confirm email",
    },
    login: {
      subject: `Your ${BRAND} sign-in link`,
      heading: "Sign in to KWOUT",
      body: "Tap the button below to sign in. This link expires shortly.",
      cta: "Sign in",
    },
    invite: {
      subject: `You've been invited to ${BRAND}`,
      heading: "You're invited",
      body: "Tap the button below to accept your invitation and set up your account.",
      cta: "Accept invite",
    },
    magiclink: {
      subject: `Your ${BRAND} magic link`,
      heading: "Sign in to KWOUT",
      body: "Tap the button below to sign in without a password.",
      cta: "Sign in",
    },
    recovery: {
      subject: `Reset your ${BRAND} password`,
      heading: "Password reset",
      body: "We received a request to reset your password. Tap the button below to choose a new one. If you didn't ask for this, you can ignore this email.",
      cta: "Reset password",
    },
    email_change: {
      subject: `Confirm your new ${BRAND} email`,
      heading: "Confirm email change",
      body: "Tap the button below to confirm the change to your email address.",
      cta: "Confirm change",
    },
    email_change_current: {
      subject: `Confirm your email change on ${BRAND}`,
      heading: "Confirm email change",
      body: "Tap the button below to confirm the change from this email address.",
      cta: "Confirm",
    },
    email_change_new: {
      subject: `Confirm your new ${BRAND} email`,
      heading: "Confirm new email",
      body: "Tap the button below to confirm this as your new email address.",
      cta: "Confirm",
    },
    reauthentication: {
      subject: `${BRAND} verification code`,
      heading: "Verify it's you",
      body: `Your verification code is below.`,
      cta: "",
    },
  };

  const c = copy[action] ?? copy.magiclink;

  const button = c.cta
    ? `<a href="${actionUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:700;font-size:15px;">${c.cta}</a>`
    : "";

  const codeBlock =
    action === "reauthentication"
      ? `<div style="font:700 28px/1.2 -apple-system,Segoe UI,sans-serif;letter-spacing:6px;padding:16px 20px;background:#f3f4f6;border-radius:8px;display:inline-block;">${token}</div>`
      : "";

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
          ${button}
          ${codeBlock}
          ${
            c.cta
              ? `<p style="margin:24px 0 0;font-size:12px;color:#6b7280;">If the button doesn't work, copy and paste this URL into your browser:<br><span style="word-break:break-all;color:#374151;">${actionUrl}</span></p>`
              : ""
          }
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">You received this because someone (hopefully you) used this address on ${BRAND}. If it wasn't you, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: c.subject, html };
}

export const Route = createFileRoute("/api/public/auth-email-hook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.AUTH_EMAIL_HOOK_SECRET;
        const lovableApiKey = process.env.LOVABLE_API_KEY;
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!secret || !lovableApiKey || !resendApiKey) {
          console.error("auth-email-hook: missing required env", {
            hasSecret: !!secret,
            hasLovable: !!lovableApiKey,
            hasResend: !!resendApiKey,
          });
          return new Response("Server misconfigured", { status: 500 });
        }

        const rawBody = await request.text();
        if (!verifySignature(rawBody, request.headers, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: SendEmailPayload;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const to = payload.user.new_email || payload.user.email;
        const actionUrl = buildActionUrl(payload.email_data);
        const { subject, html } = renderEmail(
          payload.email_data.email_action_type,
          actionUrl,
          payload.email_data.token,
        );

        const resp = await fetch(
          "https://connector-gateway.lovable.dev/resend/emails",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableApiKey}`,
              "X-Connection-Api-Key": resendApiKey,
            },
            body: JSON.stringify({ from: FROM, to: [to], subject, html }),
          },
        );

        if (!resp.ok) {
          const errBody = await resp.text();
          console.error(`auth-email-hook: Resend send failed [${resp.status}] ${errBody}`);
          // 500 → Supabase retries with backoff.
          return new Response(`Send failed: ${errBody}`, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
