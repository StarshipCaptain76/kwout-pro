# KWOUT

**Simple accounting & billing for entrepreneurs.**

Quote. Invoice. Track expenses. Send statements. Get paid.

KWOUT is a beautiful, mobile-first Progressive Web App that gives solopreneurs and small businesses a lightweight alternative to heavy accounting suites — without the spreadsheets, without the complexity.

## What is KWOUT?

A focused billing and light-accounting tool that helps small businesses:

- Generate professional **quotes** and **invoices** in seconds
- Track **expenses** with receipt photos and categories
- Manage a **customer database** and a reusable **service catalog**
- Send monthly **customer statements** with 30 / 60 / 90 / 120+ day aging
- Plan work with a simple drag-and-drop **job planner**
- Customize **branding**, tax rates, currency, and theme
- Work **offline-first** with seamless cloud sync when online
- Share PDFs via WhatsApp, email, or print

Designed for freelancers, tradespeople, consultants, small service businesses and side-hustles — anyone who needs to invoice customers and keep an eye on cash flow without wrestling with a full accounting package.

## Core Features

### 1. Quotes & Invoices
- Automatic sequential numbering with custom prefixes (Q- / INV-)
- Flexible line items: description, qty, unit price, unit (each / hour / job / km / custom)
- Optional From / To addresses with address autocomplete
- Tax / VAT (custom %), deposit % with paid flag, balance due
- Status pipeline: Draft → Sent → Accepted → Paid / Cancelled
- One-tap PDF generation with your logo, company details, banking info, terms
- Share buttons: WhatsApp, Email, Copy link, Print
- Dashboard overview: outstanding balances, monthly totals, recent activity

### 2. Expenses
- Log fuel, tools, subscriptions, subcontractors, marketing, meals — anything
- **Receipt photo capture** (mobile camera) or upload
- VAT amount, payment method, notes, optional link to a job/document
- Custom expense categories (rename/delete safe)
- Historical import from bank CSV / JSON
- Reports & charts for insights

### 3. Customer Statements
- Monthly account statements per customer
- **Aging buckets**: Current / 30-59 / 60-89 / 90-119 / 120+ days
- Opening balance, invoices, deposits, closing balance
- Send via WhatsApp, email, or download as PDF

### 4. Job Planner
- **3 Views**: Agenda (next 60 days), Week, Month calendar
- **Drag & drop** jobs between days or to an "Unscheduled" bucket
- Long-press / tap actions: mark as paid, move to another date, cancel, open details
- Swipe navigation on mobile
- Visual indicators for paid/unpaid, today highlight

### 5. Customers, Catalog & Settings
- **Customer database** with name, phone, email, address + contact import
- **Service Catalog**: pre-define common services/items with price + unit for fast quoting
- **Company Profile**: logo, name, tagline, address, phone, email, company reg no, tax no
- **Theme Customizer**: primary & accent colors with live preview
- **Billing Defaults**: default tax rate, deposit %, currency symbol, next numbers, per-km rate, callout fee
- **Banking details** for invoices (account name, number, bank, branch, swift)
- Density preference (compact / normal / comfortable)

### 6. Technical & UX Highlights
- **Offline capable** — works locally; syncs when back online
- Cloud auth + real-time sync across devices
- Responsive: bottom tab bar on mobile, top nav on desktop, sheets/drawers
- Touch-optimized: drag handles, long-press, swipe gestures
- Toasts, loading states, graceful error boundaries
- PWA-ready (installable on home screen)

## Tech Stack

- **Core**: React 19 + TypeScript + Vite 7
- **Framework**: TanStack Start + TanStack Router + TanStack Query
- **State**: Zustand (persist) + custom cloud sync layer
- **UI**: Tailwind CSS 4 + shadcn/ui (Radix) + lucide-react
- **Forms & Validation**: React Hook Form + Zod
- **Charts**: Recharts
- **PDF**: jsPDF
- **Drag & Drop**: @dnd-kit
- **Dates**: date-fns
- **Backend**: Lovable Cloud (PostgreSQL, Auth, Realtime, Storage)

## Project Structure

```
kwout/
├── src/
│   ├── routes/              # TanStack Router file-based routes
│   ├── components/
│   │   ├── app/             # Domain components (Shell, ReceiptCapture, DatePicker, etc.)
│   │   └── ui/              # shadcn/ui components
│   ├── lib/                 # Core logic: store, sync, pdf, statements, utils
│   ├── integrations/        # Cloud (Supabase) client, auth
│   ├── data/                # Seed / import data
│   └── styles.css
├── supabase/
│   └── migrations/          # SQL migrations for DB schema
├── public/                  # Static assets
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+ or Bun (recommended)
- A Lovable Cloud project (auto-provisioned in Lovable)

### 1. Install
```bash
bun install   # or npm install
```

### 2. Run Development Server
```bash
bun dev
```
Open the URL shown in the terminal. Sign up / sign in via the `/auth` route.

### 3. Build for Production
```bash
bun run build
bun run preview
```

## Security
- Client uses publishable (anon) keys only — safe for browser use.
- Row Level Security (RLS) policies protect all user data server-side.
- All privileged operations run server-side via TanStack server functions.

## Roadmap / Future Ideas
- [ ] Multi-user / team accounts with roles
- [ ] Recurring invoices & subscriptions
- [ ] Advanced reporting & profitability analytics
- [ ] Integrations with accounting software (Xero, Sage, etc.)
- [ ] Online payment links on invoices
- [ ] Automated payment reminders
- [ ] Public quote sharing links with e-signature
- [ ] Receipt OCR

## License
Private / All rights reserved.

## Credits
- Built with [Lovable.dev](https://lovable.dev)
- TanStack ecosystem
- shadcn/ui
- Lovable Cloud (Supabase)

---

**KWOUT** — Quote. Invoice. Get paid.
