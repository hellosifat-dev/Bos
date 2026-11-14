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
│   │   ├── migrations/   # 14 migrations
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
- Sanctum token-based auth (not session/cookie)
- Tokens stored in `localStorage`; attached via Axios request interceptor
- 401 responses trigger automatic token refresh with queued request retry
- Optional: OTP verification + TOTP two-factor authentication

### RBAC
Permissions are stored as `module.action` slugs (e.g. `products.create`). Roles are assigned at business or branch scope. The `PermissionService::can()` method checks the user's roles against the required permission for the given scope. The frontend `usePermission` hook mirrors this with wildcard `*` support.

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
POST   /api/v1/auth/send-otp
POST   /api/v1/auth/verify-otp
POST   /api/v1/auth/2fa/enable
POST   /api/v1/auth/2fa/verify

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

---

## Phase Roadmap

- **Phase 1 — Foundation** ✅ (this codebase)
  - Auth, Tenants, Businesses, Branches, Users, RBAC, Audit Logs
- **Phase 2 — Products & Inventory** (next)
  - Product catalogue, categories, units, stock management
- **Phase 3 — Sales & POS**
  - Orders, invoices, point-of-sale terminal, customers
- **Phase 4 — HR & Payroll**
  - Employees, attendance, payroll, leave management
- **Phase 5 — Accounting & Reports**
  - Chart of accounts, journal entries, financial reports
