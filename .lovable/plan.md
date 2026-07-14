## Add Terms field to Billing settings and documents

**Settings > Billing**
- Add a new "Terms" textarea field (multi-line) alongside existing billing fields in `src/routes/settings.tsx`.
- Persist as `terms?: string` on `BillingSettings` in `src/lib/store.ts` (with a sensible default like empty string, and migration guard so existing users don't break).

**Quote / Invoice document view (`src/routes/doc.$id.tsx`)**
- Render a "Terms" section above the existing "Notes" section, showing `billing.terms` when non-empty. Same styling/typography as Notes for consistency.

**PDF output (`src/lib/pdf.ts`)**
- Insert a "Terms" block above the "Notes" block in the generated PDF, only when terms text is present.

**Share message (`src/lib/share-message.ts`)**
- Out of scope — WhatsApp/email share text stays as-is unless you want terms appended too.

No database, permissions, or business-logic changes. Terms are a single global value stored in billing settings and applied to every quote/invoice.

Confirm: should the Terms text also be appended to the WhatsApp share message, or PDF + on-screen view only?
