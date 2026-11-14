import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { PageSpinner } from '@/components/ui/Spinner'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/api/auth'

interface PrivateRouteProps {
  children: React.ReactNode
  /** If set, user must have this permission slug (module.action) to view */
  permission?: string
}

export function PrivateRoute({ children, permission }: PrivateRouteProps) {
  const location        = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const token           = useAuthStore((s) => s.token)
  const permissions     = useAuthStore((s) => s.permissions)
  const setAuth         = useAuthStore((s) => s.setAuth)
  const logout          = useAuthStore((s) => s.logout)

  // Verify token is still valid on first load (React Query v5 — no onSuccess on useQuery)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['auth-me'],
    queryFn:  () => authApi.me(),
    enabled:  !!token && !isAuthenticated,
    retry:    false,
  })

  useEffect(() => {
    if (data) {
      const res = data as { data?: { user: Parameters<typeof setAuth>[0]; token: string } }
      if (res.data?.user && res.data.token) {
        setAuth(res.data.user, res.data.token)
      }
    }
  }, [data, setAuth])

  useEffect(() => {
    if (isError) logout()
  }, [isError, logout])

  if (isLoading) return <PageSpinner />
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (permission) {
    const hasPermission =
      permissions.includes('*') || permissions.includes(permission)
    if (!hasPermission) {
      return <Navigate to="/app/dashboard" replace />
    }
  }

  return <>{children}</>
}
