# On the MOOVE

**Quote • Invoice • Plan • Track** — A complete operations & billing platform for independent transport, removal & logistics operators.

Built with ❤️ for businesses like **MOOVE Transport** (Western Cape, South Africa) running reliable truck & trailer services for furniture moves, garden refuse, building materials, rubble removal, and more.

## 🚀 What is On the MOOVE?

A beautiful, mobile-first Progressive Web App that helps small transport operators:

- Quickly generate professional **quotes** and **invoices**
- **Plan and schedule** daily jobs with an intelligent drag-and-drop planner
- Track **expenses** with receipt photos and categories
- Manage **customers** and reusable **service catalog**
- Customize **branding**, pricing rates, VAT, and theme
- Work **offline-first** with seamless Supabase cloud sync when online
- Share PDFs via WhatsApp, email or print

Designed specifically around the realities of independent South African operators: Rand currency, distance-based pricing (km), deposits, multiple payment methods, job categorization by load type, and a scheduler that actually helps plan routes/days.

## ✨ Core Features

### 1. Smart Billing (Quotes & Invoices)
- Automatic sequential numbering with custom prefixes (Q- / INV-)
- Flexible line items: description, qty, unit price, unit (km / each / hour / job / custom)
- From / To addresses with Google Maps autocomplete + distance calculation for accurate km pricing
- VAT (custom %), deposit % with paid flag, balance due
- Status pipeline: Draft → Sent → Accepted → Paid / Cancelled
- One-tap PDF generation (jsPDF) with your logo, company details, banking info, terms
- Share buttons: WhatsApp, Email, Copy link, Print
- Auto-archive old draft/sent quotes (>10 days)
- Dashboard: Outstanding balances, monthly paid/quotes/invoices stats, Today's jobs

### 2. Intelligent Job Planner
- **3 Views**: Agenda (next 60 days), Week, Month calendar
- **Drag & drop** accepted/paid jobs between days or to "Unscheduled" bucket
- Automatic **material/load categorization** (Furniture 🪑, Rubble 🪨, Garden 🌿, Sand/Stone 🪨, Grass 🌱, Other) based on item keywords — color-coded cards
- Long-press / tap actions on jobs: Mark as Paid (cash/eft/card), Move to another date, Cancel, Open full details
- Swipe left/right navigation (mobile friendly)
- Visual indicators for paid/unpaid, today highlight
- Perfect for planning truck routes and daily capacity

### 3. Expense Management & Tracking
- Log fuel, vehicle maintenance, subcontractors, tools, marketing, meals, etc.
- **Receipt photo capture** (mobile camera) or upload — stored as data URL or synced
- VAT amount, payment method, notes, optional link to a job/doc
- Custom expense categories (rename/delete safe)
- **Historical import** from bank CSV/JSON + seed data
- Clear imported historical data when needed
- Results / Reports page for insights (charts via Recharts)

### 4. Customers, Catalog & Settings
- **Customer database** with name, phone, email, address + contact import button
- **Service Catalog**: Pre-define common jobs/services with price + unit for lightning-fast quoting
- **Company Profile**: Logo upload (data URL or hosted), name, tagline, full address, phone, email, company reg no, VAT no
- **Theme Customizer**: Primary & accent colors live preview across app
- **Billing Defaults**: Rate per km, base callout fee, default deposit %, VAT rate, currency symbol, next numbers
- **Banking details** for invoices (account name, number, bank, branch, swift)
- Density preference (compact / normal / comfortable) — great for mobile vs desktop

### 5. Technical & UX Highlights
- **Offline capable** — everything works locally; syncs when back online
- **Supabase Auth** + real-time sync across devices
- Responsive design with bottom tab bar on mobile, top nav on desktop, beautiful sheets/drawers
- Touch-optimized: drag handles, long-press, swipe gestures
- Sonner toasts, loading states, error boundaries with Lovable reporting
- PWA-ready (can be installed on home screen)

## 🛠 Tech Stack

- **Core**: React 19 + TypeScript + Vite
- **Full-stack / Routing**: TanStack Start + TanStack Router + TanStack Query
- **State Management**: Zustand (with persist middleware) + custom Supabase sync layer
- **UI Library**: Tailwind CSS 4 + shadcn/ui (Radix primitives) + lucide-react
- **Forms & Validation**: React Hook Form + Zod + @hookform/resolvers
- **Charts**: Recharts
- **PDF**: jsPDF
- **Drag & Drop**: @dnd-kit
- **Dates**: date-fns
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage for potential assets)
- **Other**: Google Maps browser key for address autocomplete & distance, Embla Carousel, Sonner, Vaul, etc.

## 📁 Project Structure (Key Paths)

```
onthemoove/
├── src/
│   ├── routes/              # TanStack Router file-based routes (index, planner, expenses, doc/$id, settings, auth, results, docs)
│   ├── components/
│   │   ├── app/             # Domain components (Shell, AddressAutocomplete, ReceiptCapture, DatePicker, InlineTumbler, etc.)
│   │   └── ui/              # shadcn/ui components
│   ├── lib/                 # Core logic: store.ts (Zustand), sync.ts, pdf.ts, maps.functions.ts, expenses.functions.ts, utils.ts
│   ├── integrations/supabase/ # Client, auth, types, middleware
│   ├── data/                # Seed data (historical.json, bank-import)
│   └── styles.css
├── supabase/
│   └── migrations/          # SQL migrations for DB schema
├── public/                  # Static assets (favicon)
├── package.json
└── README.md (this file)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ / Bun (recommended, has bun.lock)
- Supabase account (free tier works great)

### 1. Clone & Install
```bash
git clone https://github.com/StarshipCaptain76/onthemoove.git
cd onthemoove
bun install   # or npm install
```

### 2. Supabase Setup (Important!)
1. Create a new Supabase project at https://supabase.com
2. Copy your **Project URL** and **anon/public key** into `.env` (replace existing or create VITE_SUPABASE_* and SUPABASE_* vars)
3. Run the migrations:
   - Go to Supabase SQL Editor
   - Or use Supabase CLI: `supabase db push` (after linking)
   - Execute the .sql files in `supabase/migrations/` in order (or as needed)
4. Enable Auth (Email provider) in Supabase dashboard
5. (Optional) Set up Storage bucket if extending for receipts/logos

**Note**: The `.env` currently contains example keys for a specific project. **Replace with your own** for production use and never commit real secrets.

### 3. Run Development Server
```bash
bun dev
# or
npm run dev
```
Open http://localhost:5173 (or the port shown). Sign up / sign in via /auth route.

### 4. Build for Production
```bash
bun run build
bun run preview
```

### Deployment
- **Recommended**: Vercel (auto-detects Vite/TanStack Start, great DX)
- Set environment variables in Vercel dashboard (from your .env)
- Or any static host + Supabase backend

The app uses TanStack Start which supports SSR/edge functions if needed.

## 🔒 Security & Best Practices
- Client-side keys are publishable (anon) keys — normal for Supabase browser apps.
- For production: Use Row Level Security (RLS) policies on Supabase tables (currently basic).
- Rotate keys if repo is public.
- Consider adding proper backend validation / edge functions for sensitive ops.

## 📸 Screenshots / Demo
*(Add screenshots of dashboard, planner views, doc editor, expenses, settings here when available)*

- **Dashboard**: Stats + Today’s jobs + Recent activity
- **Planner**: Drag-drop calendar magic for job scheduling
- **Quote/Invoice Editor**: Rich form with address search, live totals, PDF preview
- **Mobile-first**: Bottom nav, FAB for quick create, sheets for actions

## 🗺️ Roadmap / Future Ideas
- [ ] Multi-user / team accounts with roles
- [ ] Real-time collaborative editing on jobs
- [ ] Advanced reporting & analytics (profitability per job/type)
- [ ] Integration with accounting software (Xero, Sage, etc.)
- [ ] Route optimization suggestions based on addresses
- [ ] SMS/WhatsApp automated notifications to customers
- [ ] Offline receipt OCR?
- [ ] Public quote sharing links with e-signature?

## 🤝 Contributing
This is currently a private tool for MOOVE operations. Issues/PRs welcome if you have ideas for similar transport operators!

## 📄 License
Private / All rights reserved for now. Contact owner for usage.

## 🙏 Credits & Built With
- Generated & iterated with [Lovable.dev](https://lovable.dev) AI
- TanStack ecosystem for amazing DX
- shadcn/ui for beautiful components
- Supabase for backend simplicity
- South African transport operators who inspired the feature set

---

**On the MOOVE** — Keep your business moving smoothly. 🚚

For support or customizations: Contact the developer (StarshipCaptain76 / DawieE76)