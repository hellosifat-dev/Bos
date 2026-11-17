import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'

import { rolesApi } from '@/api/users'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/utils/format'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(255).optional(),
})

type FormData = z.infer<typeof schema>

export default function RoleCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => rolesApi.create(data),
    onSuccess: (res) => {
      toast.success('Role created. Now choose its permissions.')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      navigate(`/app/roles/${res.data.data.id}/permissions`)
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to create role')),
  })

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
        <CardHeader title="New Role" subtitle="Create a custom role for this business" />
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
          <CardBody className="space-y-4">
            <Input
              label="Role Name"
              placeholder="e.g. Store Manager"
              error={errors.name?.message}
              {...register('name')}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Brief description of what this role can do…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 resize-none"
                {...register('description')}
              />
            </div>
          </CardBody>
          <CardFooter className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate('/app/roles')}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>Create Role</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
