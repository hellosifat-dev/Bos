import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'

import { branchApi } from '@/api/business'
import type { Branch } from '@/types'
type BranchPayload = Partial<Branch>
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').max(20),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  is_headquarters: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

export default function BranchEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['branch', id],
    queryFn: () => branchApi.get(id!).then((r) => r.data),
    enabled: !!id,
  })

  const branch = response?.data

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (branch) {
      reset({
        name: branch.name,
        code: branch.code,
        phone: branch.phone ?? '',
        email: branch.email ?? '',
        address: branch.address ?? '',
        city: branch.city ?? '',
        state: branch.state ?? '',
        country: branch.country ?? '',
        is_headquarters: branch.is_headquarters,
      })
    }
  }, [branch, reset])

  const mutation = useMutation({
    mutationFn: (data: BranchPayload) => branchApi.update(id!, data),
    onSuccess: () => {
      toast.success('Branch updated successfully')
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      queryClient.invalidateQueries({ queryKey: ['branch', id] })
      navigate('/app/branches')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to update branch'
      toast.error(msg)
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  if (isLoading) return <PageSpinner />
  if (isError) return (
    <Alert variant="error" title="Error">
      Failed to load branch. Please go back and try again.
    </Alert>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/app/branches')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Branches
      </button>

      <Card>
        <CardHeader
          title="Edit Branch"
          subtitle={`Editing: ${branch?.name ?? ''}`}
        />
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Branch Name"
                placeholder="e.g. Main Branch"
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="Branch Code"
                placeholder="e.g. BR001"
                error={errors.code?.message}
                {...register('code')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Phone"
                placeholder="+880 1XXXXXXXXX"
                error={errors.phone?.message}
                {...register('phone')}
              />
              <Input
                label="Email"
                type="email"
                placeholder="branch@company.com"
                error={errors.email?.message}
                {...register('email')}
              />
            </div>

            <Input
              label="Address"
              placeholder="Street address"
              error={errors.address?.message}
              {...register('address')}
            />

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="City"
                placeholder="Dhaka"
                error={errors.city?.message}
                {...register('city')}
              />
              <Input
                label="State / Division"
                placeholder="Dhaka Division"
                error={errors.state?.message}
                {...register('state')}
              />
              <Input
                label="Country"
                placeholder="Bangladesh"
                error={errors.country?.message}
                {...register('country')}
              />
            </div>

            {!branch?.is_headquarters && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  {...register('is_headquarters')}
                />
                <span className="text-sm font-medium text-gray-700">
                  Set as Headquarters
                </span>
              </label>
            )}
          </CardBody>

          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/app/branches')}
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
