import client from './client'

export interface Role {
  id: string
  tenant_id?: string
  name: string
  slug: string
  description?: string
  is_system: boolean
  permissions?: Permission[]
  users_count?: number
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  name: string
  slug: string
  module: string
  action: string
  description?: string
}

export interface RolePayload {
  name: string
  description?: string
}

export const rolesApi = {
  list: (params?: Record<string, unknown>) =>
    client.get('/roles', { params }).then(r => r.data),

  get: (id: string) =>
    client.get(`/roles/${id}`).then(r => r.data),

  create: (data: RolePayload) =>
    client.post('/roles', data).then(r => r.data),

  update: (id: string, data: Partial<RolePayload>) =>
    client.put(`/roles/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    client.delete(`/roles/${id}`).then(r => r.data),

  syncPermissions: (id: string, permissionIds: string[]) =>
    client.post(`/roles/${id}/permissions`, { permission_ids: permissionIds }).then(r => r.data),
}

export const permissionsApi = {
  /** Returns a flat Permission[] array */
  list: (): Promise<Permission[]> =>
    client.get('/permissions').then(r => {
      const data = r.data?.data ?? r.data
      // API may return grouped { module: Permission[] } — flatten it
      if (Array.isArray(data)) return data
      return Object.values(data as Record<string, Permission[]>).flat()
    }),

  /** Returns the grouped { module: Permission[] } object */
  listGrouped: (): Promise<Record<string, Permission[]>> =>
    client.get('/permissions').then(r => r.data?.data ?? r.data),
}
