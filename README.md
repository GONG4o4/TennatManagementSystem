# TenantManagementSystem

A responsive React + Vite frontend for a landlord-tenant management application.

## Features
- Role-aware landlord, applicant, and tenant interfaces with protected routes
- Public rental discovery with listing details, ratings, verified-tenant reviews, and listing-specific applications
- Renter signup with separated name fields, birthdate, contact/employment details, and private supporting-document uploads
- Landlord application review without the screening-criteria/evaluation workflow
- Rental unit descriptions and multiple photo uploads, displayed in the tenant available-rentals view
- Approved-application-only lease creation with date-overlap validation
- Lease compliance assessments, deposit and deduction records, rent-increase history, notices, printable agreement drafts, and confirmed-payment receipts
- Invoice generation and voiding, expense entry/filtering, maintenance workflows
- Tenant applications with document metadata, invoices, pending payment attempts, and profile settings
- Database-backed account profiles, properties, units, applications, leases, invoices, expenses, maintenance, notifications, and payment attempts
- Search, status filters, responsive navigation, confirmation/validation states, and CSV summary export
- Shared purple-and-white styling with pagination capped at 10 items per page across application lists

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
The public landing page shows active properties with vacant units, listing details, photos, rent, and tenant review averages. Renters can send an application for a specific listing. Verified current or former tenants may leave one public rating and review per property. Landlords receive applications for manual review; the old screening page and criteria/evaluation flow are no longer part of the renter workflow.

Signup collects first, optional middle, and last names, birthdate, contact and emergency-contact information, employment status, monthly income, a government-issued photo ID, and proof of income. Rental history/reference is optional. Documents accept PDF, JPEG, or PNG files up to 10 MB each and are stored under `backend/storage/private-documents/`, outside the public directory; the storage directory denies direct HTTP access and landlord downloads require an application relationship. Run the new listing/signup/reviews migration on an existing database before using these features. Landlords can upload up to 8 JPEG, PNG, or WebP photos per unit (5 MB each, 30 MB total). Payment attempts are recorded as pending only; no payment is charged without a configured gateway.

The backend uses PHP + MySQL. Import `database/landlord_tenant_schema_mysql.sql` into MariaDB/MySQL. For an existing database, run each unapplied migration in `database/migrations/` once, then create `backend/.env` from `backend/.env.example` and set your database credentials and a private signing key. Generate a key with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`. Do not commit `backend/.env`; it is ignored by Git.

### Lease compliance and payment records

Set each property’s rental classification and construction date before relying on its lease assessment. Regulations are effective-date based; missing coverage information or an unverified rule is marked for manual review rather than treated as legal approval. The seeded NHSB Resolution 2024-01 entry is intentionally unverified and lacks a verified construction cutoff, so applicable residential cases require legal verification. Confirm current rules with an authoritative source; the application is not legal advice.

Landlords can record received deposits, bank-holding details, accrued interest, documented deductions, rent-increase proposals, and notices. Rent increases that need review are recorded without changing the lease rent. Printable lease agreements are drafts for review, not declarations of legal sufficiency. Document references are recorded as text; files are not uploaded by these workflows.

Payment attempts remain pending until a landlord confirms an eligible cash, bank-transfer, or other offline payment. Card and e-wallet payments cannot be confirmed until a trusted gateway callback is configured. Confirmed payments receive printable receipts; each refund is retained in a refund ledger, and the invoice balance is recalculated. These records do not initiate an external payment or refund transfer.

### Rental application flow

Public registration creates renter accounts and securely stores the required ID and proof-of-income uploads; reference letters are optional. If signup starts from a listing, the account and listing-specific application are created in sequence. Otherwise, a renter can browse listings after signup and use **Send application**. Application details and uploaded documents are visible to the renter and to landlords they have applied to, and are not directly public. Landlord decisions remain manual (submitted, under review, approved, or rejected); legacy screening tables and API endpoints are retained for existing data but are no longer shown or called by the frontend.

With XAMPP Apache and MySQL running and the frontend served by Vite, set `VITE_API_BASE_URL` in `.env.local` to:

```env
VITE_API_BASE_URL=http://localhost/tenantManagement/backend/public/index.php/api
```

The login and registration screens use the PHP API and do not accept hardcoded/demo credentials. Public registration creates applicant accounts only; provision landlord accounts through a trusted process. Passwords are hashed server-side and login returns a two-hour bearer token. The frontend expects:

- `POST /auth/login` → `{ user, accessToken }`
- `POST /auth/register` → `{ user, accessToken }`
- `POST /auth/password` → updates the authenticated user's password hash

The API routes used by the frontend include:

| Schema area | Required API contract |
|---|---|
| Public listings and reviews | `GET /listings`, `GET /listings/:id/reviews`, `POST /listings/:id/reviews` |
| Landlord profile / tenant profile | `GET/PATCH /profile` |
| Property | `GET/POST /properties`, `PUT /properties/:id` |
| Rental unit | `GET/POST /units`, `PUT /units/:id`, `POST /units/:id/images` |
| Application and documents | `GET/POST /applications` (`POST` requires `unit_id`), `PATCH /applications/:id/status`, `GET /applications/:id/documents`, `GET /tenant-documents/:id/download`, `PATCH /tenant-documents/:id/verification` |
| Lease and lease tenants | `GET/POST /leases`, `PUT /leases/:id`, `GET /leases/:id/agreement` |
| Lease records | `GET /rental-regulations`, `GET/PATCH /leases/:id/deposit`, `POST /leases/:id/deposit/deductions`, `GET/POST /leases/:id/rent-increases`, `GET/POST /leases/:id/notices` |
| Rent invoice | `GET/POST /invoices`, `PATCH /invoices/:id/status` |
| Payment attempt / payment / receipt / refund | `GET /payments/methods`, `GET /payments`, `POST /payments/initiate`, `GET /payments/:id/status`, `GET /payments/:id/receipt`, `POST /payments/:id/refund` |
| Expense | `GET/POST /expenses`, `DELETE /expenses/:id`, `GET /expenses/summary` |
| Maintenance request | `GET/POST /maintenance`, `PATCH /maintenance/:id/status` |
| Notification | `GET /notifications`, `PATCH /notifications/:id/read` |
| Audit log | `GET /audit-log` (landlord only) |

Protected routes require bearer authentication and enforce role and record ownership in the PHP backend. Public listings and review reads are unauthenticated; review submissions require an eligible lease. Live payment gateway processing is not available.
