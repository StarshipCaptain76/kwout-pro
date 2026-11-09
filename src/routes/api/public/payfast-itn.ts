import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { isFoundingUser } from "@/lib/founding-users";

// PayFast Instant Transaction Notification (ITN) webhook.
// Verifies signature, validates against PayFast, and updates the user's subscription.

function sign(fields: Record<string, string>, passphrase: string): string {
  const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, "+");
  const parts = Object.entries(fields)
    .filter(([k, v]) => k !== "signature" && v !== "" && v != null)
    .map(([k, v]) => `${k}=${enc(String(v).trim())}`);
  if (passphrase) parts.push(`passphrase=${enc(passphrase.trim())}`);
  return createHash("md5").update(parts.join("&")).digest("hex");
}

export const Route = createFileRoute("/api/public/payfast-itn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const passphrase = process.env.PAYFAST_PASSPHRASE ?? "";
        const mode = (process.env.PAYFAST_MODE ?? "sandbox").toLowerCase();
        const validateHost =
          mode === "live" ? "https://www.payfast.co.za" : "https://sandbox.payfast.co.za";

        const raw = await request.text();
        const params = new URLSearchParams(raw);
        const fields: Record<string, string> = {};
        params.forEach((v, k) => (fields[k] = v));

        const signature = fields.signature ?? "";
        const expected = sign(fields, passphrase);
        if (signature.toLowerCase() !== expected.toLowerCase()) {
          console.warn("PayFast ITN signature mismatch");
          return new Response("invalid signature", { status: 400 });
        }

        // Server-side validate: post the raw body back to PayFast.
        try {
          const v = await fetch(`${validateHost}/eng/query/validate`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: raw,
          });
          const text = (await v.text()).trim();
          if (!/^VALID/i.test(text)) {
            console.warn("PayFast ITN validate rejected", text);
            return new Response("not valid", { status: 400 });
          }
        } catch (e) {
          console.error("PayFast validate error", e);
          return new Response("validate failed", { status: 502 });
        }

        const userId = fields.custom_str1 || fields.m_payment_id;
        const paymentStatus = (fields.payment_status ?? "").toUpperCase();
        const token = fields.token || null;

        let status: "trial" | "active" | "past_due" | "cancelled" | null = null;
        if (paymentStatus === "COMPLETE") status = "active";
        else if (paymentStatus === "FAILED") status = "past_due";
        else if (paymentStatus === "CANCELLED") status = "cancelled";

        if (userId && status) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: account, error } = await supabaseAdmin.auth.admin.getUserById(userId);
          if (error) return new Response("user lookup failed", { status: 500 });
          if (isFoundingUser(account.user?.email)) return new Response("ok");
          const nextEnd = new Date();
          nextEnd.setDate(nextEnd.getDate() + 31);
          const patch: {
            status: "trial" | "active" | "past_due" | "cancelled";
            payfast_token?: string;
            current_period_end?: string;
          } = { status };
          if (token) patch.payfast_token = token;
          if (status === "active") patch.current_period_end = nextEnd.toISOString();
          await supabaseAdmin.from("subscriptions").update(patch).eq("user_id", userId);
        }

        return new Response("ok");
      },
    },
  },
});
