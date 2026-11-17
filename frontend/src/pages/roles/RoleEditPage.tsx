import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Lock } from 'lucide-react'

import { rolesApi } from '@/api/users'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(255).optional(),
})

type FormData = z.infer<typeof schema>

export default function RoleEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['role', id],
    queryFn: () => rolesApi.get(id!).then((r) => r.data),
    enabled: !!id,
  })

  const role = response?.data

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (role) {
      reset({
        name: role.name,
        description: role.description ?? '',
      })
    }
  }, [role, reset])

  const mutation = useMutation({
    mutationFn: (data: FormData) => rolesApi.update(id!, data),
    onSuccess: () => {
      toast.success('Role updated successfully')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['role', id] })
      navigate('/app/roles')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to update role'
      toast.error(msg)
    },
  })

  const onSubmit = (data: FormData) => mutation.mutate(data)

  if (isLoading) return <PageSpinner />
  if (isError) return (
    <Alert variant="error" title="Error">
      Failed to load role. Please go back and try again.
    </Alert>
  )

  if (role?.is_system) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/app/roles')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Roles
        </button>

        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <Lock className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  System Role — Read Only
                </h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  <strong>{role.name}</strong> is a system role and cannot be
                  edited. To manage permissions, use the Permission Matrix.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => navigate('/app/roles')}>
                  Back to Roles
                </Button>
                <Button onClick={() => navigate(`/app/roles/${id}/permissions`)}>
                  View Permissions
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/app/roles')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Roles
      </button>

      <Card>
        <CardHeader
          title="Edit Role"
          subtitle={
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">Editing:</span>
              <span className="text-sm font-medium">{role?.name}</span>
              <Badge variant="info" size="sm">{role?.slug}</Badge>
            </div>
          }
        />
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardBody className="space-y-4">
            <Input
              label="Role Name"
              placeholder="e.g. Store Manager"
              hint="The name shown to users when assigning roles."
              error={errors.name?.message}
              {...register('name')}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Brief description of what this role can do…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           placeholder:text-gray-400 resize-none"
                {...register('description')}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
              )}
            </div>
          </CardBody>

          <CardFooter className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/app/roles/${id}/permissions`)}
            >
              Manage Permissions →
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/app/roles')}
              >
                Cancel
              </Button>
              <Button type="submit" loading={mutation.isPending}>
                Save Changes
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
