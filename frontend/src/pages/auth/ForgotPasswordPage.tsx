import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input  } from '@/components/ui/Input'
import { Alert  } from '@/components/ui/Alert'
import { authApi } from '@/api/auth'
import { getErrorMessage } from '@/utils/format'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})
type FormData = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: ({ email }: FormData) => authApi.forgotPassword(email),
    onSuccess: () => setSent(true),
  })

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  if (sent) {
    return (
      <>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Mail className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Check your inbox</h2>
          <p className="mt-2 text-sm text-gray-500">
            We sent a password reset link to{' '}
            <span className="font-medium text-gray-700">{getValues('email')}</span>.
          </p>
        </div>
        <Alert variant="info" className="mb-5">
          Didn't receive an email? Check your spam folder, or try again in a few minutes.
        </Alert>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setSent(false)}
        >
          Try a different email
        </Button>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/login" className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </p>
      </>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Forgot password?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      {mutation.error && (
        <Alert variant="error" className="mb-5">
          {getErrorMessage(mutation.error, 'Something went wrong. Please try again.')}
        </Alert>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          required
          {...register('email')}
        />

        <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
          Send reset link
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        <Link to="/login" className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </p>
    </>
  )
}
