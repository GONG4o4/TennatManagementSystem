# TenantManagementSystem

A responsive React + Vite frontend for a landlord-tenant management application.

## Features
- Role-aware landlord, applicant, and tenant interfaces with protected routes
- Property/unit CRUD, application review, screening criteria and results
- Rental unit descriptions and multiple photo uploads, displayed in the tenant available-rentals view
- Approved-application-only lease creation with date-overlap validation
- Lease compliance assessments, deposit and deduction records, rent-increase history, notices, printable agreement drafts, and confirmed-payment receipts
- Invoice generation and voiding, expense entry/filtering, maintenance workflows
- Tenant applications with document metadata, invoices, pending payment attempts, and profile settings
- Database-backed account profiles, properties, units, applications, leases, invoices, expenses, maintenance, notifications, and payment attempts
- Search, status filters, responsive navigation, confirmation/validation states, and CSV summary export

## Tech stack
- React + Vite
- React Router
- Tailwind CSS
- Axios
- Lucide React

## Run locally
```bash
npm install
npm run dev -- --host 0.0.0.0
```

## Production build
```bash
npm run build
```

## Database and API behavior
The frontend loads account records from the authenticated PHP API and clears the old sample workspace saved in browser `localStorage`. New public accounts start with the `applicant` role and can browse rentals and submit or track applications. A landlord's approval promotes the applicant to `tenant`; landlord approval is enforced by database triggers and the API. Existing applications and tenant-only lease, invoice, payment, and maintenance access use the tenant role. Property, unit, application, screening, lease, invoice, expense, maintenance, notification, payment-attempt, and profile actions use the API and persist to MySQL. Landlords can upload up to 8 JPEG, PNG, or WebP photos per unit (5 MB each, 30 MB total); applicants and tenants can browse available units and view their photos and descriptions. Application file upload is not implemented; documents already in the database can be reviewed. Payment attempts are recorded as pending only; no payment is charged without a configured gateway.

The backend uses PHP + MySQL. Import `database/landlord_tenant_schema_mysql.sql` into MariaDB/MySQL. For an existing database, run each unapplied migration in `database/migrations/` once (the rental compliance migration precedes its deduction-basis and payment-refund follow-ups), then create `backend/.env` from `backend/.env.example` and set your database credentials and a private signing key. Generate a key with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`. Do not commit `backend/.env`; it is ignored by Git.

### Lease compliance and payment records

Set each property’s rental classification and construction date before relying on its lease assessment. Regulations are effective-date based; missing coverage information or an unverified rule is marked for manual review rather than treated as legal approval. The seeded NHSB Resolution 2024-01 entry is intentionally unverified and lacks a verified construction cutoff, so applicable residential cases require legal verification. Confirm current rules with an authoritative source; the application is not legal advice.

Landlords can record received deposits, bank-holding details, accrued interest, documented deductions, rent-increase proposals, and notices. Rent increases that need review are recorded without changing the lease rent. Printable lease agreements are drafts for review, not declarations of legal sufficiency. Document references are recorded as text; files are not uploaded by these workflows.

Payment attempts remain pending until a landlord confirms an eligible cash, bank-transfer, or other offline payment. Card and e-wallet payments cannot be confirmed until a trusted gateway callback is configured. Confirmed payments receive printable receipts; each refund is retained in a refund ledger, and the invoice balance is recalculated. These records do not initiate an external payment or refund transfer.

With XAMPP Apache and MySQL running and the frontend served by Vite, set `VITE_API_BASE_URL` in `.env.local` to:

```env
VITE_API_BASE_URL=http://localhost/tenantManagement/backend/public/index.php/api
```

The login and registration screens use the PHP API and do not accept hardcoded/demo credentials. Public registration creates tenant accounts only; provision landlord accounts through a trusted process. Passwords are hashed server-side and login returns a two-hour bearer token. The frontend expects:

- `POST /auth/login` → `{ user, accessToken }`
- `POST /auth/register` → `{ user, accessToken }`
- `POST /auth/password` → updates the authenticated user's password hash

The API routes used by the frontend include:

| Schema area | Required API contract |
|---|---|
| Landlord profile / tenant profile | `GET/PATCH /profile` |
| Property | `GET/POST /properties`, `PUT /properties/:id` |
| Rental unit | `GET/POST /units`, `PUT /units/:id`, `POST /units/:id/images` |
| Application and documents | `GET/POST /applications`, `PATCH /applications/:id/status`, `GET/POST /applications/:id/documents`, `PATCH /documents/:id/verification` |
| Screening | `GET/POST /screening-criteria`, `PUT /screening-criteria/:id`, `POST /applications/:id/screenings`, `POST /screenings/:id/results` |
| Lease and lease tenants | `GET/POST /leases`, `PUT /leases/:id`, `GET /leases/:id/agreement` |
| Lease records | `GET /rental-regulations`, `GET/PATCH /leases/:id/deposit`, `POST /leases/:id/deposit/deductions`, `GET/POST /leases/:id/rent-increases`, `GET/POST /leases/:id/notices` |
| Rent invoice | `GET/POST /invoices`, `PATCH /invoices/:id/status` |
| Payment attempt / payment / receipt / refund | `GET /payments/methods`, `GET /payments`, `POST /payments/initiate`, `GET /payments/:id/status`, `GET /payments/:id/receipt`, `POST /payments/:id/refund` |
| Expense | `GET/POST /expenses`, `DELETE /expenses/:id`, `GET /expenses/summary` |
| Maintenance request | `GET/POST /maintenance`, `PATCH /maintenance/:id/status` |
| Notification | `GET /notifications`, `PATCH /notifications/:id/read` |
| Audit log | `GET /audit-log` (landlord only) |

All protected routes require bearer authentication and enforce role and record ownership in the PHP backend. Document binary storage and live payment gateway processing are not yet available.
