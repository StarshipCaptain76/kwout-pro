import { createFileRoute, Link } from "@tanstack/react-router";

const kwoutLogo = { url: "/kwout-logo.png" };
const CONTACT_EMAIL = "hello@kwout.co.za";
const BUSINESS = {
  name: "KWOUT",
  address: "38 Geelhout Avenue, Still Bay, WC, South Africa, 6674",
};
const LAST_UPDATED = "14 July 2026";

export const Route = createFileRoute("/legal")({
  component: LegalPage,
  head: () => ({
    meta: [
      { title: "Legal — Privacy, Terms & Cookies · KWOUT" },
      {
        name: "description",
        content:
          "KWOUT's Privacy Policy, Terms & Conditions (including PayFast payment terms) and Cookie Policy.",
      },
      { property: "og:title", content: "Legal — Privacy, Terms & Cookies · KWOUT" },
      {
        property: "og:description",
        content:
          "Privacy Policy, Terms & Conditions and Cookie Policy for KWOUT business stationery.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kwout.co.za/legal" },
    ],
    links: [{ rel: "canonical", href: "https://kwout.co.za/legal" }],
  }),
});

function LegalPage() {
  return (
    <div className="min-h-[100svh] bg-[#F5F5F0] text-[#111111]">
      <header className="max-w-4xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={kwoutLogo.url}
            alt="KWOUT logo"
            className="h-9 w-9 rounded object-contain"
          />
          <span className="font-display text-2xl tracking-wide text-[#3FA34D]">KWOUT</span>
        </Link>
        <Link
          to="/"
          className="text-sm font-medium underline underline-offset-4 hover:text-[#3FA34D]"
        >
          ← Back to home
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 pb-20">
        <h1 className="font-display text-5xl sm:text-6xl text-primary leading-none">Legal</h1>
        <p className="mt-3 text-sm text-[#111111]/70">Last updated: {LAST_UPDATED}</p>

        <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2 text-sm">
          <a
            href="#privacy"
            className="px-3 py-1.5 rounded-full border border-black/10 bg-white hover:border-[#3FA34D] hover:text-[#3FA34D]"
          >
            Privacy Policy
          </a>
          <a
            href="#terms"
            className="px-3 py-1.5 rounded-full border border-black/10 bg-white hover:border-[#3FA34D] hover:text-[#3FA34D]"
          >
            Terms & Conditions
          </a>
          <a
            href="#cookies"
            className="px-3 py-1.5 rounded-full border border-black/10 bg-white hover:border-[#3FA34D] hover:text-[#3FA34D]"
          >
            Cookie Policy
          </a>
        </nav>

        {/* PRIVACY */}
        <section id="privacy" className="scroll-mt-24 mt-12">
          <h2 className="font-display text-3xl sm:text-4xl text-[#3FA34D]">Privacy Policy</h2>

          <div className="prose prose-sm sm:prose-base max-w-none mt-4 space-y-4 text-[#111111]">
            <p>
              {BUSINESS.name} ("we", "us", "our") respects your privacy. This policy explains
              what personal information we collect when you use the KWOUT service, why we
              collect it, and the choices you have. It is written to align with the
              Protection of Personal Information Act, 2013 (POPIA) of South Africa.
            </p>

            <h3 className="font-semibold text-lg mt-6">Information we collect</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Account data:</strong> your email address, name, and authentication
                credentials.
              </li>
              <li>
                <strong>Business profile:</strong> the company name, address, logo, banking
                details, VAT number and branding colours you enter.
              </li>
              <li>
                <strong>Business documents:</strong> customer contacts, quotes, invoices,
                statements, expenses, payslips and any related notes or attachments you
                create in the app.
              </li>
              <li>
                <strong>Payment metadata:</strong> subscription status, billing dates and a
                transaction reference returned by our payment processor. We do{" "}
                <strong>not</strong> receive or store your full card number, CVV or bank
                credentials.
              </li>
              <li>
                <strong>Technical data:</strong> basic session and device information
                required to sign you in and keep the service secure.
              </li>
            </ul>

            <h3 className="font-semibold text-lg mt-6">How we use it</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide the service and store your business records.</li>
              <li>To bill your subscription and confirm payments.</li>
              <li>To send transactional messages (sign-in, password reset, receipts).</li>
              <li>To secure the service, prevent abuse and comply with the law.</li>
            </ul>
            <p>We do not sell your personal information and we do not use it for advertising.</p>

            <h3 className="font-semibold text-lg mt-6">Third-party processors</h3>
            <p>We rely on the following operators to run the service:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Lovable Cloud</strong> — application hosting, database, authentication
                and file storage. Data is encrypted in transit and access is protected by
                row-level security.
              </li>
              <li>
                <strong>PayFast (Pty) Ltd</strong> — our South African payment processor.
                Card and banking information is submitted directly to PayFast under their
                own privacy policy and PCI-DSS controls.
              </li>
            </ul>

            <h3 className="font-semibold text-lg mt-6">Retention</h3>
            <p>
              We keep your account data and business documents for as long as your account
              is active. If you cancel your subscription, records remain available while
              your account exists so you can export them; you may request deletion at any
              time (see below). We may retain limited billing records for the period
              required by South African tax and accounting law.
            </p>

            <h3 className="font-semibold text-lg mt-6">Your rights</h3>
            <p>
              You may request access to, correction of, or deletion of your personal
              information, and you may object to processing. Contact us at{" "}
              <a
                className="underline hover:text-[#3FA34D]"
                href={`mailto:${CONTACT_EMAIL}`}
              >
                {CONTACT_EMAIL}
              </a>
              . You may also lodge a complaint with the South African Information
              Regulator.
            </p>

            <h3 className="font-semibold text-lg mt-6">Children</h3>
            <p>
              KWOUT is a business tool and is not directed at children under 18. We do not
              knowingly collect information from minors.
            </p>

            <h3 className="font-semibold text-lg mt-6">Contact</h3>
            <p>
              {BUSINESS.name}, {BUSINESS.address}. Email:{" "}
              <a className="underline hover:text-[#3FA34D]" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
        </section>

        {/* TERMS */}
        <section id="terms" className="scroll-mt-24 mt-16">
          <h2 className="font-display text-3xl sm:text-4xl text-[#3FA34D]">
            Terms & Conditions
          </h2>

          <div className="prose prose-sm sm:prose-base max-w-none mt-4 space-y-4 text-[#111111]">
            <p>
              These terms govern your use of KWOUT, a subscription-based online tool for
              creating quotes, invoices, statements, payslips and expense records for your
              business. By creating an account you agree to these terms.
            </p>

            <h3 className="font-semibold text-lg mt-6">1. The merchant</h3>
            <p>
              The service is provided by {BUSINESS.name}, {BUSINESS.address}. You can
              contact us at{" "}
              <a className="underline hover:text-[#3FA34D]" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>

            <h3 className="font-semibold text-lg mt-6">2. The service</h3>
            <p>
              KWOUT is a digital software-as-a-service product. Once you sign up you receive
              immediate access to create business stationery (quotes, invoices, statements,
              payslips), track expenses and manage related records. No physical goods are
              shipped.
            </p>

            <h3 className="font-semibold text-lg mt-6">3. Pricing and billing</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>New accounts receive a 30-day free trial with all features included.</li>
              <li>After the trial the subscription is R100.00 per month, billed monthly in South African Rand (ZAR).</li>
              <li>All prices include applicable taxes where required.</li>
              <li>Access is granted immediately once payment is confirmed by our payment processor.</li>
            </ul>

            <h3 className="font-semibold text-lg mt-6">4. Payment processor</h3>
            <p>
              Payments are processed by <strong>PayFast (Pty) Ltd</strong>, a licensed South
              African payment provider. When you pay, you are redirected to PayFast to enter
              your card or EFT details. We never see or store your full card number. Payment
              disputes must first be raised with us at{" "}
              <a className="underline hover:text-[#3FA34D]" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              ; unresolved disputes may be escalated through PayFast or your card issuer.
            </p>

            <h3 className="font-semibold text-lg mt-6">5. Refunds and cancellation</h3>
            <p>
              You may cancel your subscription at any time from your account settings.
              Cancellation stops all future billing. <strong>Fees already paid are
              non-refundable</strong>, and you keep access to the service until the end of
              the paid billing period. There are no cancellation penalties.
            </p>

            <h3 className="font-semibold text-lg mt-6">6. Delivery</h3>
            <p>
              KWOUT is a digital service delivered over the internet. There is nothing to
              ship. Access is available 24/7 subject to routine maintenance and
              circumstances beyond our reasonable control.
            </p>

            <h3 className="font-semibold text-lg mt-6">7. Availability</h3>
            <p>
              The service is offered to customers in South Africa. Billing is only supported
              in ZAR via PayFast. You are responsible for complying with the laws of your
              own jurisdiction if you access the service from outside South Africa.
            </p>

            <h3 className="font-semibold text-lg mt-6">8. Your account and acceptable use</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are responsible for your login credentials and for everything done under your account.</li>
              <li>The data you enter must be lawful and must not infringe anyone else's rights.</li>
              <li>You may not attempt to reverse-engineer, resell, overload or misuse the service.</li>
            </ul>

            <h3 className="font-semibold text-lg mt-6">9. Content ownership</h3>
            <p>
              You own the business data you enter into KWOUT. You grant us a limited licence
              to host, process and display that data solely to provide the service to you.
            </p>

            <h3 className="font-semibold text-lg mt-6">10. Suspension and termination</h3>
            <p>
              We may suspend or terminate accounts that breach these terms, fail to pay, or
              are used unlawfully. On termination, you may request an export of your data
              for a reasonable period before it is deleted.
            </p>

            <h3 className="font-semibold text-lg mt-6">11. Limitation of liability</h3>
            <p>
              KWOUT is provided on an "as is" basis. To the maximum extent allowed by law,
              our total liability to you for any claim arising out of the service is limited
              to the fees you paid us in the three months before the event giving rise to
              the claim. We are not liable for indirect or consequential loss, loss of
              profit, or loss of data beyond our reasonable control.
            </p>

            <h3 className="font-semibold text-lg mt-6">12. Changes to these terms</h3>
            <p>
              We may update these terms from time to time. Material changes will be notified
              by email or through the app before they take effect. Continued use after the
              effective date means you accept the updated terms.
            </p>

            <h3 className="font-semibold text-lg mt-6">13. Governing law</h3>
            <p>
              These terms are governed by the laws of the Republic of South Africa. The
              courts of the Western Cape have exclusive jurisdiction over any dispute.
            </p>
          </div>
        </section>

        {/* COOKIES */}
        <section id="cookies" className="scroll-mt-24 mt-16">
          <h2 className="font-display text-3xl sm:text-4xl text-[#3FA34D]">Cookie Policy</h2>

          <div className="prose prose-sm sm:prose-base max-w-none mt-4 space-y-4 text-[#111111]">
            <p>
              KWOUT uses a small number of cookies and similar browser storage to make the
              service work. We do not use advertising cookies and we do not use third-party
              analytics or tracking cookies.
            </p>

            <h3 className="font-semibold text-lg mt-6">Cookies we set</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Authentication session</strong> — set when you sign in so we can
                keep you signed in as you move between pages. Essential; the service will
                not work without it.
              </li>
              <li>
                <strong><code>otm_brand</code></strong> — a small cookie that remembers your
                company name, logo and brand colours so the app can display your branding
                on the very first frame after page load, before the full app has loaded.
                Essential for a correct branded experience; contains no tracking data.
              </li>
            </ul>

            <h3 className="font-semibold text-lg mt-6">Third-party services</h3>
            <p>
              When you pay for a subscription you are redirected to <strong>PayFast</strong>,
              which may set its own cookies on its own domain to process the payment
              securely. Those cookies are governed by PayFast's own cookie and privacy
              policies.
            </p>

            <h3 className="font-semibold text-lg mt-6">Managing cookies</h3>
            <p>
              You can clear or block cookies through your browser settings. If you block the
              cookies above, you will not be able to stay signed in or see your branding
              applied on first load.
            </p>

            <h3 className="font-semibold text-lg mt-6">Contact</h3>
            <p>
              Questions about cookies? Email{" "}
              <a className="underline hover:text-[#3FA34D]" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/10">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6 flex flex-col items-center gap-2 text-xs text-[#111111]/80">
          <div className="flex items-center gap-2">
            <img src={kwoutLogo.url} alt="" className="h-5 w-5 rounded object-contain opacity-80" />
            <span className="font-display tracking-wide text-sm text-[#3FA34D]">KWOUT</span>
          </div>
          <div>Made for entrepreneurs. © KWOUT 2026</div>
        </div>
      </footer>
    </div>
  );
}
