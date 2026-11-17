import apiClient from './client'
import type { ApiResponse, User } from '@/types'

export interface LoginPayload  { email?: string; phone?: string; password: string; remember?: boolean }
export interface RegisterPayload { name: string; email: string; phone?: string; password: string; password_confirmation?: string }
export interface AuthTokenData { user: User; token: string | null; requires_2fa?: boolean; requires_otp?: boolean }

export const authApi = {
  login:           (data: LoginPayload)            => apiClient.post<ApiResponse<AuthTokenData>>('/auth/login', data),
  register:        (data: RegisterPayload)         => apiClient.post<ApiResponse<AuthTokenData>>('/auth/register', data),
  logout:          ()                              => apiClient.post<ApiResponse>('/auth/logout'),
  me:              ()                              => apiClient.get<ApiResponse<User>>('/auth/me'),
  forgotPassword:  (email: string)                 => apiClient.post<ApiResponse>('/auth/forgot-password', { email }),
  resetPassword:   (data: { token: string; email: string; password: string; password_confirmation: string }) =>
                                                      apiClient.post<ApiResponse>('/auth/reset-password', data),
  sendOtp:         (data: { email?: string; phone?: string; type: string }) =>
                                                      apiClient.post<ApiResponse>('/auth/send-otp', data),
  verifyOtp:       (data: { email?: string; phone?: string; code: string; type: string }) =>
                                                      apiClient.post<ApiResponse<AuthTokenData>>('/auth/verify-otp', data),
  refresh:         ()                              => apiClient.post<ApiResponse<{ token: string }>>('/auth/refresh'),
  enable2FA:       ()                              => apiClient.post<ApiResponse<{ qr_url: string; secret: string }>>('/auth/2fa/enable'),
  disable2FA:      (code: string)                  => apiClient.post<ApiResponse>('/auth/2fa/disable', { code }),
  verify2FA:       (data: { code: string })         => apiClient.post<ApiResponse<AuthTokenData>>('/auth/2fa/verify', data),
  sessions:        ()                              => apiClient.get<ApiResponse>('/auth/sessions'),
  revokeSession:   (id: string)                    => apiClient.delete<ApiResponse>(`/auth/sessions/${id}`),
}
