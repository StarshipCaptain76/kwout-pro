/**
 * Custom Resend-backed auth email server functions.
 *
 * These replace Supabase's built-in auth email dispatch (which we can't
 * intercept — the "Send email hook" UI doesn't exist on Lovable Cloud).
 * We use the admin API's `generateLink` to mint the confirmation / recovery
 * link ourselves, then send a branded email through Resend.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Canonical public origin for auth links. We never trust the origin the
 * browser is currently on — a preview like `*.lovableproject.com` must not
 * end up in the emailed link, both because it looks off-brand and because
 * Supabase's redirect allow-list won't include every preview host.
 */
const PUBLIC_SITE_URL = "https://kwout.co.za";

function normalizeRedirect(input: string): string {
  try {
    const u = new URL(input);
    return `${PUBLIC_SITE_URL}${u.pathname}${u.search}`;
  } catch {
    const path = input.startsWith("/") ? input : `/${input}`;
    return `${PUBLIC_SITE_URL}${path}`;
  }
}

const SignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  redirectTo: z.string().url(),
});

const ResendVerificationInput = z.object({
  email: z.string().email(),
  redirectTo: z.string().url(),
});

const ResetInput = z.object({
  email: z.string().email(),
  redirectTo: z.string().url(),
});

/**
 * Create the user (if they don't exist) with email_confirm=false, then mint
 * a signup confirmation link and email it via Resend.
 * Returns { pending: true } — the client shows a "check your email" screen.
 */
export const sendSignupEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignupInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { sendResendAuthEmail } = await import("./auth-email-render.server");

    const { data: linkData, error } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email: data.email,
        password: data.password,
        options: { redirectTo: normalizeRedirect(data.redirectTo) },
      });

    if (error) {
      // If the user already exists, fall back to a magic-link style
      // verification email so they can still confirm and sign in.
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        const { data: mlData, error: mlErr } =
          await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: data.email,
            options: { redirectTo: normalizeRedirect(data.redirectTo) },
          });
        if (mlErr || !mlData?.properties?.action_link) {
          throw new Error(mlErr?.message || "Could not generate sign-in link");
        }
        await sendResendAuthEmail({
          to: data.email,
          action: "magiclink",
          actionUrl: mlData.properties.action_link,
        });
        return { pending: true as const, existing: true as const };
      }
      throw new Error(error.message);
    }

    const actionUrl = linkData?.properties?.action_link;
    if (!actionUrl) throw new Error("No confirmation link was generated");

    await sendResendAuthEmail({
      to: data.email,
      action: "signup",
      actionUrl,
    });

    return { pending: true as const, existing: false as const };
  });

/**
 * Resend the verification email for an existing unconfirmed user, using a
 * magic-link (which also confirms the email on click).
 */
export const resendVerificationEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResendVerificationInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { sendResendAuthEmail } = await import("./auth-email-render.server");

    const { data: linkData, error } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: data.email,
        options: { redirectTo: normalizeRedirect(data.redirectTo) },
      });

    if (error || !linkData?.properties?.action_link) {
      throw new Error(error?.message || "Could not generate verification link");
    }

    await sendResendAuthEmail({
      to: data.email,
      action: "magiclink",
      actionUrl: linkData.properties.action_link,
    });

    return { ok: true as const };
  });

/**
 * Send a password reset email via Resend. Always resolves successfully so we
 * don't leak whether the email is registered.
 */
export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResetInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { sendResendAuthEmail } = await import("./auth-email-render.server");

    const { data: linkData, error } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
        options: { redirectTo: normalizeRedirect(data.redirectTo) },
      });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      // Silently succeed for unknown emails so we don't leak account existence.
      if (
        msg.includes("not found") ||
        msg.includes("no user") ||
        msg.includes("user_not_found")
      ) {
        return { ok: true as const };
      }
      throw new Error(error.message);
    }

    const actionUrl = linkData?.properties?.action_link;
    if (!actionUrl) return { ok: true as const };

    await sendResendAuthEmail({
      to: data.email,
      action: "recovery",
      actionUrl,
    });

    return { ok: true as const };
  });
