import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { Button }  from '@/components/ui/Button'
import { Input }   from '@/components/ui/Input'
import { Select }  from '@/components/ui/Select'
import { Alert }   from '@/components/ui/Alert'
import { Card }    from '@/components/ui/Card'
import { usersApi, rolesApi } from '@/api/users'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/format'

const schema = z.object({
  name:     z.string().min(2, 'Name is required'),
  email:    z.string().email('Enter a valid email'),
  phone:    z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role_id:  z.string().min(1, 'Select a role'),
})
type FormData = z.infer<typeof schema>

export function UserCreatePage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => rolesApi.list().then((r) => r.data.data),
  })

  const roleOptions = (rolesData ?? []).map((r: { id: string; name: string }) => ({
    value: r.id,
    label: r.name,
  }))

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => usersApi.create({
      name:     data.name,
      email:    data.email,
      phone:    data.phone,
      password: data.password,
      role_id:  data.role_id,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created and invited!')
      navigate('/app/users')
    },
  })

  return (
    <div className="mx-auto max-w-xl">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to users
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invite User</h1>
        <p className="mt-0.5 text-sm text-gray-500">Add a team member and assign their role.</p>
      </div>

      {mutation.error && (
        <Alert variant="error" className="mb-5">
          {getErrorMessage(mutation.error, 'Failed to create user.')}
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Jane Doe"
            error={errors.name?.message}
            required
            {...register('name')}
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="jane@company.com"
            error={errors.email?.message}
            required
            {...register('email')}
          />
          <Input
            label="Phone Number"
            type="tel"
            placeholder="+880 1xxx xxx xxx"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Input
            label="Temporary Password"
            type="password"
            placeholder="Min. 8 characters"
            hint="User can change this after first login"
            error={errors.password?.message}
            required
            {...register('password')}
          />
          <Select
            label="Role"
            options={roleOptions}
            placeholder="Select a role…"
            error={errors.role_id?.message}
            required
            {...register('role_id')}
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>Create User</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
