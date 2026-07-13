## Goal

Send Supabase auth emails (signup verification, password reset, magic link, email change) via **Resend** from `hello@welcome.kwout.co.za` instead of the default Supabase sender that is currently being rate-limited.

## How it will work

Supabase Auth supports a "Send Email" webhook. When enabled, Supabase stops sending its own emails and POSTs each auth email event to our endpoint. We handle it, render the email, and send via Resend.

```text
Signup / reset / magic link
        │
        ▼
Supabase Auth ──(signed webhook)──►  /api/public/auth-email-hook  ──► Resend API ──► inbox
```

## Steps

1. **DNS — verify the sending subdomain in Resend**
   - You add `welcome.kwout.co.za` as a domain in Resend.
   - Resend shows SPF, DKIM, and DMARC records.
   - Add those records at your DNS provider for `kwout.co.za`.
   - Wait for Resend to mark the domain **Verified** (usually minutes, up to a few hours).

2. **Connect Resend to the project**
   - Use the built-in Resend connector so `RESEND_API_KEY` is injected as a secret — no manual paste.

3. **Create the auth email webhook endpoint**
   - New public route: `src/routes/api/public/auth-email-hook.ts`.
   - Verifies Supabase's `Standard-Webhooks` signature using a hook secret.
   - Renders a branded HTML template per email type (`signup`, `recovery`, `magiclink`, `email_change`, `invite`, `reauthentication`) using the KWOUT logo/colors.
   - Sends via Resend from `KWOUT <hello@welcome.kwout.co.za>` with the correct action link (confirmation URL / token) from the payload.
   - Returns 200 on success; surfaces Resend errors as 500 so Supabase retries.

4. **Store the hook secret**
   - Generate a strong secret and save it as `SUPABASE_AUTH_HOOK_SECRET` for the endpoint to verify signatures.

5. **Enable the Send Email Hook in Supabase Auth**
   - Point the hook at `https://kwout.co.za/api/public/auth-email-hook` with the shared secret.
   - Raise the hourly auth email rate limit now that sending goes through Resend (Resend caps, not Supabase's low default).

6. **Verify end to end**
   - Trigger a signup with a fresh address → confirm the branded email arrives from `hello@welcome.kwout.co.za`.
   - Trigger a password reset → confirm the reset link works.
   - Check Resend dashboard for delivery + Supabase auth logs for hook 200s.

## What you'll need to do manually

- Add the DNS records Resend shows for `welcome.kwout.co.za` at your registrar.
- Confirm you want me to proceed with enabling the Supabase Send Email hook (this switches ALL auth emails to Resend — if the endpoint or Resend is misconfigured, no auth emails will send until fixed).

## What I will NOT change

- App UI, business logic, PayFast/PDF/planner code — untouched.
- Existing Supabase schema — untouched.
- The Google sign-in flow — untouched (only email-based auth emails route through Resend).

## Notes / trade-offs

- Resend's `onboarding@resend.dev` only delivers to the Resend account owner, so it can't be used as a fallback for real users — the DNS verification of `welcome.kwout.co.za` is a hard prerequisite before switching the hook on.
- If DNS isn't verified yet when we flip the hook, auth emails will fail. Safer sequence: build the endpoint + secrets first, wait for DNS verification, then enable the hook.

Reply **approve** to proceed, or tell me what to change.
