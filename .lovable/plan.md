# Add Legal page (Privacy, Terms, Cookies)

## New route
Create `src/routes/legal.tsx` — a single public route rendering three sections with in-page anchors (`#privacy`, `#terms`, `#cookies`) and a sticky/inline sub-nav at the top. Uses the KWOUT landing look & feel (bg `#F5F5F0`, green accent, Bebas display font) so it feels part of the marketing site. Includes `<main>` landmark, proper `head()` with title/description/canonical/og tags, and a "Back to home" link in the header.

## Homepage footer
Edit `src/routes/index.tsx` footer to add three links pointing to `/legal#privacy`, `/legal#terms`, `/legal#cookies`, alongside the existing copyright line.

## Content outline

**Business identity (used across all sections)**
- KWOUT
- 38 Geelhout Avenue, Still Bay, WC, South Africa, 6674
- Contact: (email pulled from existing support address if present; otherwise a `mailto:` placeholder using `support@kwout.co.za` — verify against code before writing)

**Privacy Policy** — what data KWOUT collects (account email, company profile, customer/quote/invoice data the user enters, payment metadata via PayFast), why, retention, user rights (access/delete via contact), third-party processors (Lovable Cloud backend, PayFast for payments), no sale of data, security posture (encrypted in transit, RLS on backend), children's data (not directed at under-18s), contact for privacy requests.

**Terms & Conditions** — PayFast merchant requirements:
- Description of service (business stationery SaaS: quotes, invoices, statements, payslips)
- Pricing: 30-day free trial, then R100/month, billed monthly in ZAR
- Payment processor: PayFast (Pty) Ltd; card data handled by PayFast, not stored by KWOUT
- Delivery: digital service, access granted immediately on successful payment
- Refund/cancellation: **no refunds; cancel anytime to stop future billing; access continues to end of paid period**
- Acceptable use, account responsibility, termination, limitation of liability, governing law (South Africa), jurisdiction (Western Cape courts)
- Merchant contact details (name + physical address above)
- Export control / country restrictions (available to SA customers)

**Cookie Policy** — what cookies KWOUT uses:
- Essential: Supabase auth session cookie, `otm_brand` brand cache cookie (documented in `src/lib/brand-cookie.ts`)
- No third-party analytics/advertising cookies
- How to disable (browser settings) and consequence (sign-in won't persist)

## Technical notes
- Route: `createFileRoute("/legal")` with `head()` setting title "Legal — KWOUT", description, `og:url`, `og:type: website`, canonical `https://kwout.co.za/legal`.
- Purely presentational — no data fetching, no auth gate.
- Use `<Link to="/legal" hash="privacy">` style navigation from footer.
- Anchor sections wrapped in `<section id="privacy">` etc. with `scroll-mt-24` so sticky header doesn't cover headings.
- Single `<h1>Legal</h1>`, `<h2>` for each section.

## Files
- New: `src/routes/legal.tsx`
- Edit: `src/routes/index.tsx` (footer only)
