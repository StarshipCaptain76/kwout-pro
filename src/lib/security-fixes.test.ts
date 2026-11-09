import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { escapeCsvCell } from "./csv";
import { randomPassword } from "./password";
import { validatePaymentOrigin } from "./payment-origin";
import { buildExportFiles } from "./exports/accounting";
import type { BillingSettings } from "./store";

describe("selected security fixes", () => {
  it("neutralizes formula triggers, whitespace bypasses and CSV delimiters", () => {
    for (const input of ["=1+1", "+CMD", "-CMD", "@SUM(A1)", "  =1+1", "\t=1+1", "\r=1+1", "\n=1+1", "=HYPERLINK(\"https://example.com\")"]) {
      assert.ok(escapeCsvCell(input).replace(/^"/, "").startsWith("'"));
    }
    assert.equal(escapeCsvCell(-123.45), "-123.45");
    assert.equal(escapeCsvCell("-123.45"), "-123.45");
    assert.equal(escapeCsvCell('a,"b"'), '"a,""b"""');
    assert.equal(escapeCsvCell("ordinary"), "ordinary");
    assert.equal(escapeCsvCell(null), "");
  });

  it("neutralizes hostile expense and customer fields in every accounting format", () => {
    for (const pkg of ["csv", "quickbooks", "sage"] as const) {
      const files = buildExportFiles({
        pkg, sets: ["expenses", "customers"], docs: [],
        billing: { currency: "R" } as BillingSettings,
        expenses: [{ id: "one", createdAt: "2026-11-09", date: "2026-11-09", category: "=1+1", vendor: "+CMD", description: "@SUM(A1)", amount: -42 }],
        customers: [{ id: "one", name: "=1+1", email: "test@example.com", phone: "+27664027116" }],
      });
      assert.equal(files.length, 2);
      assert.ok(files[0].content.includes("'=1+1"));
      assert.ok(files[0].content.includes("'+CMD"));
      assert.ok(files[1].content.includes("'=1+1"));
    }
  });

  it("generates sixteen-character passwords with Web Crypto", () => {
    const passwords = Array.from({ length: 100 }, () => randomPassword());
    assert.equal(new Set(passwords).size, 100);
    for (const password of passwords) assert.match(password, /^[a-zA-Z2-9]{16}$/);
    assert.ok(readFileSync(new URL("./password.ts", import.meta.url), "utf8").includes("crypto.getRandomValues(bytes)"));
  });

  it("allows known app origins and rejects attacker destinations and URL tricks", () => {
    for (const origin of ["https://kwout.co.za", "https://www.kwout.co.za", "https://kwout-pro.lovable.app", "https://id-preview--0aab91b2-f339-4b47-bbf6-c950818b9459.lovable.app"]) {
      assert.equal(validatePaymentOrigin(origin), origin);
    }
    for (const origin of ["https://evil.example", "https://kwout.co.za.evil.example", "https://kwout.co.za@evil.example", "https://evil.example@kwout.co.za", "https://kwout.co.za/path", "https://kwout.co.za?next=evil", "http://kwout.co.za", "https://other.lovable.app", "https://kwout.co.za:444", "http://localhost:8080"]) {
      assert.throws(() => validatePaymentOrigin(origin));
    }
    assert.equal(validatePaymentOrigin("http://localhost:8080", true), "http://localhost:8080");
  });

  it("checks stored owner authorization before loading the privileged password reset client", () => {
    const source = readFileSync(new URL("./staff.functions.ts", import.meta.url), "utf8").split("export const resetStaffPassword")[1];
    const admin = source.indexOf('await import("@/integrations/supabase/client.server")');
    assert.ok(source.indexOf('if (roleError || !ownerRole) throw') < admin);
    assert.ok(source.indexOf('if (ownerStaffError || !ownerStaff) throw') < admin);
    assert.ok(source.includes('.eq("workspace_owner_id", context.userId)'));
    assert.ok(source.includes('.eq("role", "owner")'));
    assert.ok(source.includes('membershipError || memberships !== 1'));
  });
});