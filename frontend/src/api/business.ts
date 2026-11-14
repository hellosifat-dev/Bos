import apiClient from './client'
import type { ApiResponse, PaginatedResponse, Business, Branch, PaginationParams } from '@/types'

export const businessApi = {
  list:          (params?: PaginationParams)           => apiClient.get<PaginatedResponse<Business>>('/businesses', { params }),
  create:        (data: Partial<Business>)             => apiClient.post<ApiResponse<Business>>('/businesses', data),
  get:           (id: string)                          => apiClient.get<ApiResponse<Business>>(`/businesses/${id}`),
  update:        (id: string, data: Partial<Business>) => apiClient.put<ApiResponse<Business>>(`/businesses/${id}`, data),
  setupProgress: (id: string)                          => apiClient.get<ApiResponse<{ progress: number; steps: Record<string, boolean> }>>(`/businesses/${id}/setup-progress`),
  switch:        (id: string)                          => apiClient.post<ApiResponse<{ business: Business; token: string }>>(`/businesses/${id}/switch`),
  updateStep:    (id: string, step: string, data: unknown) =>
                                                          apiClient.post<ApiResponse>(`/businesses/${id}/setup/${step}`, data),
}

export const branchApi = {
  list:    (params?: PaginationParams)              => apiClient.get<PaginatedResponse<Branch>>('/branches', { params }),
  create:  (data: Partial<Branch>)                  => apiClient.post<ApiResponse<Branch>>('/branches', data),
  get:     (id: string)                             => apiClient.get<ApiResponse<Branch>>(`/branches/${id}`),
  update:  (id: string, data: Partial<Branch>)      => apiClient.put<ApiResponse<Branch>>(`/branches/${id}`, data),
  destroy: (id: string)                             => apiClient.delete<ApiResponse>(`/branches/${id}`),
}
