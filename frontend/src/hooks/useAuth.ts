import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi, type LoginPayload, type RegisterPayload } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage } from '@/utils/format'

export function useAuth() {
  const navigate  = useNavigate()
  const authStore = useAuthStore()

  // ── Login ──────────────────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: (data: LoginPayload) => authApi.login(data),
    onSuccess: ({ data: res }) => {
      if (!res.success) { toast.error(res.message || 'Login failed'); return }
      const { user, token, requires_2fa, requires_otp } = res.data

      if (requires_otp) {
        navigate('/verify-otp', { state: { email: user.email, type: 'email_verification' } })
        return
      }
      if (requires_2fa && token) {
        // Limited challenge token: only valid for POST /auth/2fa/verify.
        localStorage.setItem('bos_token', token)
        navigate('/two-factor')
        return
      }
      if (!token) { toast.error('Login failed'); return }

      authStore.setAuth(user, token)
      toast.success(`Welcome back, ${user.name}!`)
      navigate('/app/dashboard')
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Login failed. Please check your credentials.'))
    },
  })

  // ── Register ───────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: (data: RegisterPayload) => authApi.register(data),
    onSuccess: ({ data: res }) => {
      if (!res.success) { toast.error(res.message || 'Registration failed'); return }
      if (res.data.token) {
        // Email verification disabled on the server: signed in straight away.
        authStore.setAuth(res.data.user, res.data.token)
        toast.success('Account created!')
        navigate('/app/dashboard')
        return
      }
      toast.success('Account created! Please verify your email.')
      navigate('/verify-otp', { state: { email: res.data.user.email, type: 'email_verification' } })
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Registration failed.'))
    },
  })

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      authStore.logout()
      navigate('/login')
      toast.success('Logged out successfully.')
    },
  })

  // ── Current user ───────────────────────────────────────────────────────────
  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
    enabled: authStore.isAuthenticated,
    select: (res) => res.data.data,
    staleTime: 1000 * 60 * 10,
  })

  return {
    user:          meData || authStore.user,
    isAuth:        authStore.isAuthenticated,
    login:         loginMutation.mutate,
    register:      registerMutation.mutate,
    logout:        logoutMutation.mutate,
    isLoggingIn:   loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    // Expose full mutation objects so pages can read .error, .isPending directly
    loginMutation,
    registerMutation,
    logoutMutation,
  }
}
