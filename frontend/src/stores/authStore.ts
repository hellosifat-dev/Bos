import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Business } from '@/types'

interface AuthStore {
  user: User | null
  token: string | null
  tenantId: string | null
  currentBusiness: Business | null
  currentBranchId: string | null
  permissions: string[]
  isAuthenticated: boolean

  setAuth: (user: User, token: string) => void
  setTenant: (tenantId: string) => void
  setBusiness: (business: Business, permissions?: string[]) => void
  setBranch: (branchId: string | null) => void
  setPermissions: (permissions: string[]) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      tenantId:        null,
      currentBusiness: null,
      currentBranchId: null,
      permissions:     [],
      isAuthenticated: false,

      setAuth: (user, token) => {
        localStorage.setItem('bos_token', token)
        // Default to the user's primary tenant unless one is already selected.
        const current = localStorage.getItem('bos_tenant_id')
        const tenant  = user.tenants?.find((t) => t.is_primary) ?? user.tenants?.[0]
        if (!current && tenant) localStorage.setItem('bos_tenant_id', String(tenant.id))
        set((s) => ({
          user, token, isAuthenticated: true,
          tenantId: current ?? (tenant ? String(tenant.id) : s.tenantId),
        }))
      },

      setTenant: (tenantId) => {
        localStorage.setItem('bos_tenant_id', tenantId)
        set({ tenantId })
      },

      setBusiness: (business, permissions = []) => {
        localStorage.setItem('bos_business_id', business.id)
        localStorage.removeItem('bos_branch_id')
        set({ currentBusiness: business, permissions, currentBranchId: null })
      },

      setBranch: (branchId) => {
        if (branchId) localStorage.setItem('bos_branch_id', branchId)
        else localStorage.removeItem('bos_branch_id')
        set({ currentBranchId: branchId })
      },

      setPermissions: (permissions) => set({ permissions }),

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      logout: () => {
        localStorage.removeItem('bos_token')
        localStorage.removeItem('bos_tenant_id')
        localStorage.removeItem('bos_business_id')
        localStorage.removeItem('bos_branch_id')
        set({
          user:            null,
          token:           null,
          tenantId:        null,
          currentBusiness: null,
          currentBranchId: null,
          permissions:     [],
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'bos-auth',
      partialize: (state) => ({
        user:            state.user,
        token:           state.token,
        tenantId:        state.tenantId,
        currentBusiness: state.currentBusiness,
        currentBranchId: state.currentBranchId,
        permissions:     state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
