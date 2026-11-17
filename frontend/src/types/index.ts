// ─── API Response ────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  message?: string
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  email: string
  phone?: string
  status: 'active' | 'inactive' | 'suspended'
  email_verified_at?: string
  phone_verified_at?: string
  two_factor_enabled: boolean
  last_login_at?: string
  roles?: Role[]
  tenants?: Array<{ id: string; name: string; slug: string; role: string; is_primary: boolean }>
  created_at: string
}

export interface AuthState {
  user: User | null
  token: string | null
  currentTenantId: string | null
  currentBusiness: Business | null
  currentBranchId: string | null
  permissions: string[]
  isAuthenticated: boolean
}

// ─── Business ─────────────────────────────────────────────────────────────────
export type BusinessType =
  | 'retail' | 'ecommerce' | 'wholesale' | 'b2b'
  | 'restaurant' | 'service' | 'manufacturing'
  | 'corporate' | 'multi_branch' | 'subscription'

export type BusinessStatus = 'active' | 'inactive' | 'setup'

export interface Business {
  id: string
  name: string
  legal_name?: string
  slug: string
  business_type: BusinessType
  email: string
  phone?: string
  address?: Address
  country: string
  currency: string
  timezone: string
  language?: string
  logo?: string
  favicon?: string
  status: BusinessStatus
  setup_completed_at?: string
  setup_progress?: number
  branches_count?: number
  owner?: User
  branches?: Branch[]
  created_at: string
}

// ─── Branch ───────────────────────────────────────────────────────────────────
export interface Branch {
  id: string
  name: string
  code: string
  phone?: string
  email?: string
  address?: Address
  is_headquarters: boolean
  status: 'active' | 'inactive'
  working_hours?: WorkingHours
  manager?: User
  employees_count?: number
  created_at: string
}

// ─── Role & Permission ────────────────────────────────────────────────────────
export interface Role {
  id: string
  name: string
  slug: string
  description?: string
  is_system: boolean
  scope: 'global' | 'business' | 'branch' | 'department' | 'own'
  users_count?: number
  permissions?: Permission[]
  created_at: string
}

export interface Permission {
  id: string
  name: string
  slug: string
  module: string
  action: string
  description?: string
}

// ─── Common ───────────────────────────────────────────────────────────────────
export interface Address {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

export interface WorkingHours {
  [day: string]: { open: string; close: string; closed?: boolean }
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  module: string
  record_type: string
  record_id: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  user?: User
  created_at: string
}

// ─── Filters & Params ─────────────────────────────────────────────────────────
export interface PaginationParams {
  page?: number
  per_page?: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
}
