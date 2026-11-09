import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createHash } from "crypto";
import { assertBillableUser, foundingSubscription, isFoundingUser } from "@/lib/founding-users";

export interface SubscriptionStatus {
  status: "trial" | "active" | "past_due" | "cancelled" | "legacy_free";
  trialStartedAt: string;
  currentPeriodEnd: string | null;
  daysLeftInTrial: number;
  trialExpired: boolean;
  needsPayment: boolean;
}

const MS_PER_DAY = 86_400_000;
const TRIAL_DAYS = 30;

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionStatus> => {
    const { supabase, userId } = context;
    if (isFoundingUser(context.claims.email)) return foundingSubscription();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, trial_started_at, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const trialStartedAt = data?.trial_started_at ?? new Date().toISOString();
    const status = (data?.status ?? "trial") as SubscriptionStatus["status"];
    const currentPeriodEnd = data?.current_period_end ?? null;
    const elapsed = Math.floor((Date.now() - new Date(trialStartedAt).getTime()) / MS_PER_DAY);
    const daysLeftInTrial = Math.max(0, TRIAL_DAYS - elapsed);
    const trialExpired = status === "trial" && daysLeftInTrial === 0;
    const needsPayment = status === "cancelled" || status === "past_due" || trialExpired;

    return { status, trialStartedAt, currentPeriodEnd, daysLeftInTrial, trialExpired, needsPayment };
  });

// PayFast signing: MD5 of URL-encoded key=value pairs in given order,
// with passphrase (URL-encoded) appended as final "passphrase=" pair.
function payfastSignature(fields: Record<string, string>, passphrase: string): string {
  const enc = (v: string) =>
    encodeURIComponent(v).replace(/%20/g, "+");
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `${k}=${enc(String(v).trim())}`);
  if (passphrase) parts.push(`passphrase=${enc(passphrase.trim())}`);
  return createHash("md5").update(parts.join("&")).digest("hex");
}

export const createPayfastCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ origin: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertBillableUser(context.claims.email);
    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    const passphrase = process.env.PAYFAST_PASSPHRASE ?? "";
    const mode = (process.env.PAYFAST_MODE ?? "sandbox").toLowerCase();
    if (!merchantId || !merchantKey) throw new Error("PayFast not configured");

    const host = mode === "live" ? "https://www.payfast.co.za" : "https://sandbox.payfast.co.za";
    const { userId, claims } = context;
    const email = (claims.email as string | undefined) ?? "";

    // Build in PayFast's documented signing order.
    const fields: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${data.origin}/settings?billing=success`,
      cancel_url: `${data.origin}/settings?billing=cancelled`,
      notify_url: `${data.origin}/api/public/payfast-itn`,
      name_first: "KWOUT",
      name_last: "Subscriber",
      email_address: email,
      m_payment_id: userId,
      amount: "100.00",
      item_name: "KWOUT Monthly",
      item_description: "Everything KWOUT — quotes, invoices, statements, payslips, reports.",
      custom_str1: userId,
      subscription_type: "1",
      billing_date: new Date().toISOString().slice(0, 10),
      recurring_amount: "100.00",
      frequency: "3", // monthly
      cycles: "0",    // indefinite
    };
    const signature = payfastSignature(fields, passphrase);
    const params = new URLSearchParams({ ...fields, signature }).toString();
    return { url: `${host}/eng/process?${params}` };
  });

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (isFoundingUser(context.claims.email)) return { ok: true };
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("subscriptions")
      .select("payfast_token")
      .eq("user_id", userId)
      .maybeSingle();
    const token = row?.payfast_token;

    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    const passphrase = process.env.PAYFAST_PASSPHRASE ?? "";
    const mode = (process.env.PAYFAST_MODE ?? "sandbox").toLowerCase();
    const host = mode === "live" ? "https://api.payfast.co.za" : "https://sandbox.payfast.co.za";

    if (token && merchantId && merchantKey) {
      const timestamp = new Date().toISOString();
      const headers: Record<string, string> = {
        "merchant-id": merchantId,
        version: "v1",
        timestamp,
      };
      const sig = payfastSignature(headers, passphrase);
      try {
        await fetch(`${host}/subscriptions/${encodeURIComponent(token)}/cancel`, {
          method: "PUT",
          headers: { ...headers, signature: sig, "merchant-key": merchantKey },
        });
      } catch (e) {
        console.error("PayFast cancel failed", e);
      }
    }

    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", userId);

    return { ok: true };
  });
