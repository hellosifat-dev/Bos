import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input  } from '@/components/ui/Input'
import { Alert  } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'
import { getErrorMessage } from '@/utils/format'

const schema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  email:    z.string().email('Enter a valid email'),
  phone:    z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm:  z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path:    ['confirm'],
})

type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const [showPass, setShowPass] = useState(false)
  const { registerMutation } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormData) => {
    registerMutation.mutate({
      name:     data.name,
      email:    data.email,
      phone:    data.phone,
      password: data.password,
    })
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
        <p className="mt-1 text-sm text-gray-500">Start your free trial — no credit card required</p>
      </div>

      {registerMutation.error && (
        <Alert variant="error" className="mb-5">
          {getErrorMessage(registerMutation.error, 'Registration failed. Please try again.')}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="John Doe"
          leftIcon={<User className="h-4 w-4" />}
          error={errors.name?.message}
          required
          {...register('name')}
        />

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

        <Input
          label="Phone number"
          type="tel"
          autoComplete="tel"
          placeholder="+1 555 000 0000"
          leftIcon={<Phone className="h-4 w-4" />}
          hint="Optional — used for two-factor authentication"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label="Password"
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
          label="Confirm password"
          type={showPass ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Re-enter password"
          leftIcon={<Lock className="h-4 w-4" />}
          error={errors.confirm?.message}
          required
          {...register('confirm')}
        />

        <p className="text-xs text-gray-500">
          By creating an account you agree to our{' '}
          <a href="#" className="text-primary-600 hover:underline">Terms of Service</a> and{' '}
          <a href="#" className="text-primary-600 hover:underline">Privacy Policy</a>.
        </p>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={registerMutation.isPending}
        >
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
          Sign in
        </Link>
      </p>
    </>
  )
}
