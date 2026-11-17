import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { Button }  from '@/components/ui/Button'
import { Input }   from '@/components/ui/Input'
import { Alert }   from '@/components/ui/Alert'
import { Card }    from '@/components/ui/Card'
import { branchApi } from '@/api/business'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/format'

const schema = z.object({
  name:             z.string().min(2, 'Branch name is required'),
  code:             z.string().min(1, 'Branch code is required').max(10),
  phone:            z.string().optional(),
  email:            z.string().email('Invalid email').optional().or(z.literal('')),
  is_headquarters:  z.boolean().default(false),
  address_line1:    z.string().optional(),
  address_city:     z.string().optional(),
  address_state:    z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function BranchCreatePage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => branchApi.create({
      name:            data.name,
      code:            data.code,
      phone:           data.phone,
      email:           data.email || undefined,
      is_headquarters: data.is_headquarters,
      address: {
        line1: data.address_line1,
        city:  data.address_city,
        state: data.address_state,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch created!')
      navigate('/app/branches')
    },
  })

  return (
    <div className="mx-auto max-w-xl">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to branches
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Branch</h1>
        <p className="mt-0.5 text-sm text-gray-500">Create a new branch location for your business.</p>
      </div>

      {mutation.error && (
        <Alert variant="error" className="mb-5">
          {getErrorMessage(mutation.error, 'Failed to create branch.')}
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Branch Name"
              placeholder="Main Branch"
              error={errors.name?.message}
              required
              {...register('name')}
            />
            <Input
              label="Branch Code"
              placeholder="MAIN"
              hint="Short unique identifier"
              error={errors.code?.message}
              required
              {...register('code')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              type="tel"
              placeholder="+880 1xxx xxx xxx"
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
            label="Address Line 1"
            placeholder="Street address"
            {...register('address_line1')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="City"  placeholder="Dhaka"  {...register('address_city')} />
            <Input label="State" placeholder="Dhaka Division" {...register('address_state')} />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              {...register('is_headquarters')}
            />
            Mark as headquarters
          </label>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>Create Branch</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
