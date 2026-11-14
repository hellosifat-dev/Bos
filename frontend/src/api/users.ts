import apiClient from './client'
import type { ApiResponse, PaginatedResponse, User, Role, Permission, PaginationParams } from '@/types'

export const usersApi = {
  list:        (params?: PaginationParams)                       => apiClient.get<PaginatedResponse<User>>('/users', { params }),
  create:      (data: Partial<User> & { password: string; role_id?: string; send_invitation?: boolean }) =>
                                                                    apiClient.post<ApiResponse<User>>('/users', data),
  get:         (id: string)                                      => apiClient.get<ApiResponse<User>>(`/users/${id}`),
  update:      (id: string, data: Partial<User>)                 => apiClient.put<ApiResponse<User>>(`/users/${id}`, data),
  destroy:     (id: string)                                      => apiClient.delete<ApiResponse>(`/users/${id}`),
  assignRole:  (id: string, roleId: string, branchId?: string)   => apiClient.post<ApiResponse>(`/users/${id}/roles`, { role_id: roleId, branch_id: branchId }),
  revokeRole:  (id: string, roleId: string)                      => apiClient.delete<ApiResponse>(`/users/${id}/roles`, { data: { role_id: roleId } }),
}

export const rolesApi = {
  list:            (params?: PaginationParams)                    => apiClient.get<PaginatedResponse<Role>>('/roles', { params }),
  create:          (data: Partial<Role> & { permission_ids?: string[] }) =>
                                                                    apiClient.post<ApiResponse<Role>>('/roles', data),
  get:             (id: string)                                   => apiClient.get<ApiResponse<Role>>(`/roles/${id}`),
  update:          (id: string, data: Partial<Role> & { permission_ids?: string[] }) =>
                                                                    apiClient.put<ApiResponse<Role>>(`/roles/${id}`, data),
  destroy:         (id: string)                                   => apiClient.delete<ApiResponse>(`/roles/${id}`),
  syncPermissions: (id: string, permissionIds: string[])          => apiClient.post<ApiResponse<Role>>(`/roles/${id}/permissions`, { permission_ids: permissionIds }),
}

export const permissionsApi = {
  // Returns permissions grouped by module from the API
  listGrouped: () => apiClient.get<ApiResponse<Record<string, Permission[]>>>('/permissions'),
  // Flattened list — extract all permissions from the grouped response
  list: () => apiClient.get<ApiResponse<Record<string, Permission[]>>>('/permissions').then((r) => ({
    ...r,
    data: {
      ...r.data,
      data: Object.values(r.data.data ?? {}).flat() as Permission[],
    },
  })),
}
