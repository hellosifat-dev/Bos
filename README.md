# BOS — Business Operating System

A multi-tenant, multi-branch SaaS platform for managing every part of a business — sales, inventory, HR, payroll, accounting, and more.

---

## Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Backend   | Laravel 11, PHP 8.2, Sanctum Auth       |
| Frontend  | React 18 + Vite 5 + TypeScript          |
| Database  | PostgreSQL                              |
| State     | Zustand (global) + React Query (server) |
| Styling   | TailwindCSS 3 + HeadlessUI              |

---

## Project Structure

```
bos/
├── backend/          # Laravel 11 API
│   ├── app/
│   │   ├── Http/Controllers/Api/V1/
│   │   ├── Http/Middleware/
│   │   ├── Http/Requests/
│   │   ├── Http/Resources/
│   │   ├── Models/
│   │   └── Services/
│   ├── database/
│   │   ├── migrations/   # core + one migration per phase
│   │   └── seeders/      # Permissions + Roles
│   ├── routes/api.php
│   └── config/bos.php
│
└── frontend/         # React + Vite SPA
    └── src/
        ├── api/          # Axios API clients
        ├── components/
        │   ├── layout/   # AppLayout, AuthLayout, Sidebar, Header
        │   └── ui/       # Button, Input, Select, Modal, Table, Badge…
        ├── hooks/        # useAuth, usePermission
        ├── pages/        # auth/, dashboard/, business/, branches/, users/, roles/, audit/
        ├── routes/       # Router + PrivateRoute
        ├── stores/       # Zustand authStore
        └── types/        # TypeScript interfaces
```

---

## Getting Started

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate

# Configure PostgreSQL in .env, then:
php artisan migrate
php artisan db:seed        # Seeds permissions + 11 system roles

php artisan serve          # Runs on http://localhost:8000

php vendor/bin/phpunit     # Feature tests (in-memory SQLite)
```

### Frontend

```bash
cd frontend
npm install
npm run dev                # Runs on http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:8000`.

---

## Architecture

### Multi-Tenancy
Every business table has a `tenant_id` column. The `TenantMiddleware` reads the `X-Tenant-ID` request header, validates the tenant is active, and confirms the authenticated user belongs to it. All queries use the `scopeForTenant()` model scope.

### Authentication
- Registering creates the user **and** their tenant (organisation); an email OTP activates the account
  (in development `MAIL_MAILER=log` writes the code to `storage/logs/laravel.log`)
- Sanctum token-based auth (not session/cookie); `POST /auth/refresh` rotates the token
- 2FA is TOTP (RFC 6238). A 2FA login returns a limited `2fa-pending` token that is only accepted by `POST /auth/2fa/verify`
- Password reset uses Laravel's broker; the emailed link opens `/reset-password?token=…&email=…` in the SPA
- Tokens stored in `localStorage`; attached via Axios request interceptor
- 401 responses trigger automatic token refresh with queued request retry
- Optional: OTP verification + TOTP two-factor authentication

### RBAC
Permissions are stored as `module.action` slugs (e.g. `branches.create`). Roles are assigned at business or branch scope; business owners and tenant owners implicitly hold every permission. Business-scoped routes are guarded with `permission:<action>,<module>` middleware. `PermissionService::userCan()` checks the user's roles against the required permission for the given scope. The frontend `usePermission` hook mirrors this with wildcard `*` support.

### Business-scoped modules (Phases 2–5)
Operational models use the `BusinessScoped` trait: when `BusinessMiddleware` has resolved the
`X-Business-ID` context, queries are automatically filtered to that business and new rows inherit its
`tenant_id` / `business_id`. Most resources are served by the generic `CrudController`, and on the
frontend by the config-driven `ResourcePage` component.

### Accounting
`AccountingService` keeps a double-entry ledger. A default chart of accounts is created with each
business, and these events post balanced journal entries automatically:

| Event | Debit | Credit |
|-------|-------|--------|
| Order completed | Accounts Receivable; COGS | Sales Revenue; Sales Tax Payable; Inventory |
| Payment / refund | Cash or Bank / Receivable | Receivable / Cash or Bank |
| Return | Sales Returns; Tax Payable; Inventory | Receivable; COGS |
| Opening stock / adjustment | Inventory (or Inventory Adjustments) | Opening Equity (or Inventory) |
| Payroll paid | Salaries & Wages | Bank; Payroll Deductions Payable |
| Expense approved | Expense account | Cash / Bank / Payable |

### Multi-Branch
`Tenant → Business → Branch` hierarchy. The `X-Business-ID` and `X-Branch-ID` headers scope API calls. The Zustand store tracks the current business and branch, and Axios automatically attaches the headers.

---

## API Routes (v1)

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/send-otp            (email_verification | phone_verification)
POST   /api/v1/auth/verify-otp          (returns a token once the email is verified)
POST   /api/v1/auth/refresh
POST   /api/v1/auth/2fa/enable          (returns TOTP secret + otpauth URL)
POST   /api/v1/auth/2fa/verify          (activates 2FA, or completes a 2FA login challenge)
POST   /api/v1/auth/2fa/disable
GET    /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/{id}
GET    /api/v1/dashboard/stats          [X-Business-ID required]

GET    /api/v1/businesses
POST   /api/v1/businesses
GET    /api/v1/businesses/{id}
PUT    /api/v1/businesses/{id}
POST   /api/v1/businesses/{id}/switch

GET    /api/v1/branches         [X-Business-ID required]
POST   /api/v1/branches
GET    /api/v1/branches/{id}
PUT    /api/v1/branches/{id}
DELETE /api/v1/branches/{id}

GET    /api/v1/users
POST   /api/v1/users
PUT    /api/v1/users/{id}
DELETE /api/v1/users/{id}
POST   /api/v1/users/{id}/roles
DELETE /api/v1/users/{id}/roles

GET    /api/v1/roles
POST   /api/v1/roles
PUT    /api/v1/roles/{id}
DELETE /api/v1/roles/{id}
POST   /api/v1/roles/{id}/permissions

GET    /api/v1/permissions
GET    /api/v1/audit-logs
```

### Phases 2–5 (all require `X-Tenant-ID` + `X-Business-ID` and the matching permission)

```
CRUD   /api/v1/{categories,brands,units,products,warehouses}
GET    /api/v1/inventory                 POST /api/v1/inventory/{adjust,transfer}
GET    /api/v1/inventory/movements       GET  /api/v1/inventory/products/{id}

CRUD   /api/v1/customers
GET    /api/v1/orders                    POST /api/v1/orders            PUT /api/v1/orders/{id}
POST   /api/v1/orders/{id}/{complete,cancel,payments,return}
GET    /api/v1/pos/products              POST /api/v1/pos/checkout

CRUD   /api/v1/{departments,designations,employees}
GET    /api/v1/attendance?date=          POST /api/v1/attendance        GET /api/v1/attendance/summary?month=
GET    /api/v1/leave-requests            POST /api/v1/leave-requests    POST /api/v1/leave-requests/{id}/{approve,reject}
GET    /api/v1/payroll                   POST /api/v1/payroll           PUT /api/v1/payroll/{id}/payslips/{slip}
POST   /api/v1/payroll/{id}/{approve,pay}

CRUD   /api/v1/{accounts,expenses}       GET  /api/v1/accounts/{id}/ledger
POST   /api/v1/expenses/{id}/{approve,reject}
GET    /api/v1/journal-entries           POST /api/v1/journal-entries
GET    /api/v1/reports/{profit-loss,balance-sheet,trial-balance,sales,inventory,expenses}
```

---

## Phase Roadmap

- **Phase 1 — Foundation** ✅ (this codebase)
  - Auth, Tenants, Businesses, Branches, Users, RBAC, Audit Logs
- **Phase 2 — Products & Inventory** ✅
  - Products, categories, brands, units, warehouses, stock levels, adjustments, transfers, movement history
- **Phase 3 — Sales & POS** ✅
  - Customers, orders (draft → complete), invoices, payments, partial returns/refunds, POS terminal with barcode entry
- **Phase 4 — HR & Payroll** ✅
  - Departments, designations, employees, daily attendance sheet + monthly summary, leave requests/approval, monthly payroll with absence & unpaid-leave deductions, payslips
- **Phase 5 — Accounting & Reports** ✅
  - Chart of accounts, double-entry journal (auto-posted from sales, payments, returns, stock adjustments, payroll and expenses), manual entries, account ledgers, expenses with approval, P&L, balance sheet, trial balance, sales / inventory / expense reports with CSV export
