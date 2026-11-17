import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'

import { usersApi, rolesApi } from '@/api/users'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  role_id: z.string().min(1, 'Role is required'),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
})

type FormData = z.infer<typeof schema>

export default function UserEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: userResp, isLoading: userLoading, isError } = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.get(id!).then((r) => r.data),
    enabled: !!id,
  })

  const { data: rolesResp } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list().then((r) => r.data),
  })

  const user = userResp?.data
  const roles: Array<{ id: string; name: string }> = rolesResp?.data ?? []

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        role_id: user.roles?.[0]?.id ?? '',
        status: user.status ?? 'active',
      })
    }
  }, [user, reset])

  const mutation = useMutation({
    mutationFn: (data: FormData) => usersApi.update(id!, data),
    onSuccess: () => {
      toast.success('User updated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user', id] })
      navigate('/app/users')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to update user'
      toast.error(msg)
    },
  })

  const onSubmit = (data: FormData) => mutation.mutate(data)

  if (userLoading) return <PageSpinner />
  if (isError) return (
    <Alert variant="error" title="Error">
      Failed to load user. Please go back and try again.
    </Alert>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/app/users')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </button>

      <Card>
        <CardHeader
          title="Edit User"
          subtitle={`Editing: ${user?.name ?? ''}`}
        />
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardBody className="space-y-4">
            <Input
              label="Full Name"
              placeholder="e.g. John Doe"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="john@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Phone"
              placeholder="+880 1XXXXXXXXX"
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Controller
              name="role_id"
              control={control}
              render={({ field }) => (
                <Select
                  label="Role"
                  error={errors.role_id?.message}
                  {...field}
                >
                  <option value="">Select a role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              )}
            />

            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select label="Status" {...field}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </Select>
              )}
            />
          </CardBody>

          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/app/users')}
            >
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
