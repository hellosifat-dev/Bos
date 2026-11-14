import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  timeout: 30000,
})

// ── Request interceptor ────────────────────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Attach auth token
  const token = localStorage.getItem('bos_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // Attach tenant + business + branch context
  const tenantId   = localStorage.getItem('bos_tenant_id')
  const businessId = localStorage.getItem('bos_business_id')
  const branchId   = localStorage.getItem('bos_branch_id')

  if (tenantId)   config.headers['X-Tenant-ID']   = tenantId
  if (businessId) config.headers['X-Business-ID'] = businessId
  if (branchId)   config.headers['X-Branch-ID']   = branchId

  return config
})

// ── Response interceptor ───────────────────────────────────────────────────────
let isRefreshing = false
let pendingRequests: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem('bos_token')}` },
        })
        const newToken = data.data.token
        localStorage.setItem('bos_token', newToken)
        pendingRequests.forEach((cb) => cb(newToken))
        pendingRequests = []
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch {
        // Refresh failed — clear auth and redirect to login
        localStorage.removeItem('bos_token')
        localStorage.removeItem('bos_tenant_id')
        localStorage.removeItem('bos_business_id')
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
