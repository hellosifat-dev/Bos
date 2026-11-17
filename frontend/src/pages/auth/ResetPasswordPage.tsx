import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input  } from '@/components/ui/Input'
import { Alert  } from '@/components/ui/Alert'
import { authApi } from '@/api/auth'
import { getErrorMessage } from '@/utils/format'

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm:  z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path:    ['confirm'],
})
type FormData = z.infer<typeof schema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const [done,     setDone]     = useState(false)
  const [showPass, setShowPass] = useState(false)

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      authApi.resetPassword({ token, email, password: data.password, password_confirmation: data.confirm }),
    onSuccess: () => setDone(true),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  if (done) {
    return (
      <>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Password reset!</h2>
          <p className="mt-2 text-sm text-gray-500">Your password has been successfully updated.</p>
        </div>
        <Button className="w-full" size="lg" onClick={() => navigate('/login')}>
          Sign in with new password
        </Button>
      </>
    )
  }

  if (!token || !email) {
    return (
      <Alert variant="error">
        Invalid or expired reset link. Please request a new one.
      </Alert>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Reset password</h2>
        <p className="mt-1 text-sm text-gray-500">Enter and confirm your new password.</p>
      </div>

      {mutation.error && (
        <Alert variant="error" className="mb-5">
          {getErrorMessage(mutation.error, 'Failed to reset password. The link may have expired.')}
        </Alert>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Input
          label="New Password"
          type={showPass ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          leftIcon={<Lock className="h-4 w-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          error={errors.password?.message}
          required
          {...register('password')}
        />

        <Input
          label="Confirm New Password"
          type={showPass ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Re-enter password"
          leftIcon={<Lock className="h-4 w-4" />}
          error={errors.confirm?.message}
          required
          {...register('confirm')}
        />

        <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
          Reset Password
        </Button>
      </form>
    </>
  )
}
