import client from './client'

export interface Branch {
  id: string
  business_id: string
  tenant_id: string
  name: string
  code: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  country?: string
  is_headquarters: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BranchPayload {
  name: string
  code: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  country?: string
  is_headquarters?: boolean
}

export const branchesApi = {
  list: (params?: Record<string, unknown>) =>
    client.get('/branches', { params }).then(r => r.data),

  get: (id: string) =>
    client.get(`/branches/${id}`).then(r => r.data),

  create: (data: BranchPayload) =>
    client.post('/branches', data).then(r => r.data),

  update: (id: string, data: Partial<BranchPayload>) =>
    client.put(`/branches/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    client.delete(`/branches/${id}`).then(r => r.data),
}
