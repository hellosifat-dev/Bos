import { useAuthStore } from '@/stores/authStore'

/**
 * Hook to check if the current user has a given permission.
 * Usage: const { can } = usePermission()
 *        can('create', 'products')  // → boolean
 */
export function usePermission() {
  const permissions = useAuthStore((s) => s.permissions)

  const can = (action: string, module: string): boolean => {
    // Super admin or business owner bypass
    if (permissions.includes('*')) return true
    return permissions.includes(`${module}.${action}`)
  }

  const canAny = (actions: string[], module: string): boolean =>
    actions.some((a) => can(a, module))

  const canAll = (actions: string[], module: string): boolean =>
    actions.every((a) => can(a, module))

  return { can, canAny, canAll, permissions }
}

// ─── Component helper ──────────────────────────────────────────────────────────
import type { ReactNode } from 'react'

interface PermissionGateProps {
  action: string
  module: string
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({ action, module, children, fallback = null }: PermissionGateProps) {
  const { can } = usePermission()
  return can(action, module) ? <>{children}</> : <>{fallback}</>
}
