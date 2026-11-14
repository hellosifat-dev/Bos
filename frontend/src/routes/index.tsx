import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthLayout }  from '@/components/layout/AuthLayout'
import { AppLayout }   from '@/components/layout/AppLayout'
import { PrivateRoute } from './PrivateRoute'
import { PageSpinner }  from '@/components/ui/Spinner'

// ─── Auth pages (small, no lazy needed) ────────────────────────────────────
import { LoginPage }          from '@/pages/auth/LoginPage'
import { RegisterPage }       from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { OtpVerifyPage }       from '@/pages/auth/OtpVerifyPage'
import { TwoFactorPage }       from '@/pages/auth/TwoFactorPage'
import { ResetPasswordPage }   from '@/pages/auth/ResetPasswordPage'

// ─── App pages (lazy) ───────────────────────────────────────────────────────
const DashboardPage         = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const BusinessListPage      = lazy(() => import('@/pages/business/BusinessListPage').then((m) => ({ default: m.BusinessListPage })))
const BusinessCreatePage    = lazy(() => import('@/pages/business/BusinessCreatePage').then((m) => ({ default: m.BusinessCreatePage })))
const BranchListPage        = lazy(() => import('@/pages/branches/BranchListPage').then((m) => ({ default: m.BranchListPage })))
const BranchCreatePage      = lazy(() => import('@/pages/branches/BranchCreatePage').then((m) => ({ default: m.BranchCreatePage })))
const BranchEditPage        = lazy(() => import('@/pages/branches/BranchEditPage'))
const UserListPage          = lazy(() => import('@/pages/users/UserListPage').then((m) => ({ default: m.UserListPage })))
const UserCreatePage        = lazy(() => import('@/pages/users/UserCreatePage').then((m) => ({ default: m.UserCreatePage })))
const UserEditPage          = lazy(() => import('@/pages/users/UserEditPage'))
const RoleListPage          = lazy(() => import('@/pages/roles/RoleListPage').then((m) => ({ default: m.RoleListPage })))
const RoleEditPage          = lazy(() => import('@/pages/roles/RoleEditPage'))
const PermissionMatrixPage  = lazy(() => import('@/pages/roles/PermissionMatrixPage').then((m) => ({ default: m.PermissionMatrixPage })))
const AuditLogPage          = lazy(() => import('@/pages/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })))

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageSpinner />}>{children}</Suspense>
)

export const router = createBrowserRouter([
  // ── Public auth routes ────────────────────────────────────────────────────
  {
    element: <AuthLayout />,
    children: [
      { path: '/login',           element: <LoginPage /> },
      { path: '/register',        element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/verify-otp',      element: <OtpVerifyPage /> },
      { path: '/two-factor',      element: <TwoFactorPage /> },
      { path: '/reset-password',  element: <ResetPasswordPage /> },
    ],
  },

  // ── Protected app routes ──────────────────────────────────────────────────
  {
    path: '/app',
    element: (
      <PrivateRoute>
        <AppLayout />
      </PrivateRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },

      {
        path: 'dashboard',
        element: <Wrap><DashboardPage /></Wrap>,
      },

      // Businesses
      {
        path: 'businesses',
        element: <Wrap><BusinessListPage /></Wrap>,
      },
      {
        path: 'businesses/new',
        element: <Wrap><BusinessCreatePage /></Wrap>,
      },

      // Branches (scoped to current business via store)
      {
        path: 'branches',
        element: (
          <PrivateRoute permission="branches.view">
            <Wrap><BranchListPage /></Wrap>
          </PrivateRoute>
        ),
      },
      {
        path: 'branches/new',
        element: (
          <PrivateRoute permission="branches.create">
            <Wrap><BranchCreatePage /></Wrap>
          </PrivateRoute>
        ),
      },
      {
        path: 'branches/:id/edit',
        element: (
          <PrivateRoute permission="branches.edit">
            <Wrap><BranchEditPage /></Wrap>
          </PrivateRoute>
        ),
      },

      // Users
      {
        path: 'users',
        element: (
          <PrivateRoute permission="users.view">
            <Wrap><UserListPage /></Wrap>
          </PrivateRoute>
        ),
      },
      {
        path: 'users/new',
        element: (
          <PrivateRoute permission="users.create">
            <Wrap><UserCreatePage /></Wrap>
          </PrivateRoute>
        ),
      },
      {
        path: 'users/:id/edit',
        element: (
          <PrivateRoute permission="users.edit">
            <Wrap><UserEditPage /></Wrap>
          </PrivateRoute>
        ),
      },

      // Roles & permissions
      {
        path: 'roles',
        element: (
          <PrivateRoute permission="roles.view">
            <Wrap><RoleListPage /></Wrap>
          </PrivateRoute>
        ),
      },
      {
        path: 'roles/:id/edit',
        element: (
          <PrivateRoute permission="roles.edit">
            <Wrap><RoleEditPage /></Wrap>
          </PrivateRoute>
        ),
      },
      {
        path: 'roles/:id/permissions',
        element: (
          <PrivateRoute permission="roles.edit">
            <Wrap><PermissionMatrixPage /></Wrap>
          </PrivateRoute>
        ),
      },

      // Audit logs
      {
        path: 'audit-logs',
        element: (
          <PrivateRoute permission="audit_logs.view">
            <Wrap><AuditLogPage /></Wrap>
          </PrivateRoute>
        ),
      },
    ],
  },

  // ── Root redirect ─────────────────────────────────────────────────────────
  { path: '/',  element: <Navigate to="/app/dashboard" replace /> },
  { path: '*',  element: <Navigate to="/app/dashboard" replace /> },
])
