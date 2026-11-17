import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Building2, CheckCircle2, Settings } from 'lucide-react'
import { Button }  from '@/components/ui/Button'
import { Badge }   from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Modal }   from '@/components/ui/Modal'
import { Alert }   from '@/components/ui/Alert'
import { businessApi } from '@/api/business'
import { useAuthStore } from '@/stores/authStore'
import type { Business } from '@/types'
import toast from 'react-hot-toast'

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  active:    'success',
  setup:     'warning',
  suspended: 'danger',
  inactive:  'default',
}

export function BusinessListPage() {
  const navigate       = useNavigate()
  const qc             = useQueryClient()
  const { setBusiness, currentBusiness } = useAuthStore()
  const [switchTarget, setSwitchTarget] = useState<Business | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['businesses'],
    queryFn:  () => businessApi.list().then((r) => r.data.data),
  })

  const switchMutation = useMutation({
    mutationFn: (id: string) => businessApi.switch(id),
    onSuccess: (res) => {
      setBusiness(res.data.data.business)
      qc.clear()
      setSwitchTarget(null)
      toast.success(`Switched to ${res.data.data.business.name}`)
      navigate('/app/dashboard')
    },
    onError: () => toast.error('Failed to switch business.'),
  })

  const businesses: Business[] = data ?? []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage all businesses in your workspace</p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/app/businesses/new')}
        >
          New Business
        </Button>
      </div>

      {error && (
        <Alert variant="error">Failed to load businesses. Please refresh the page.</Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Building2 className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No businesses yet</h3>
          <p className="mt-1 text-sm text-gray-400 mb-6">Create your first business to get started.</p>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/app/businesses/new')}>
            Create Business
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {businesses.map((biz) => (
            <div
              key={biz.id}
              className="relative bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              {currentBusiness?.id === biz.id && (
                <div className="absolute top-3 right-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              )}
              <div className="flex items-start gap-4">
                {biz.logo ? (
                  <img src={biz.logo} alt={biz.name} className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-primary-100 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{biz.name}</h3>
                  {biz.legal_name && (
                    <p className="text-xs text-gray-400 truncate">{biz.legal_name}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Badge variant={statusVariant[biz.status] ?? 'default'} dot>
                  {biz.status}
                </Badge>
                <span className="text-xs text-gray-400 capitalize">{biz.business_type?.replace('_', ' ')}</span>
              </div>

              <div className="mt-4 flex gap-2">
                {currentBusiness?.id !== biz.id && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    loading={switchMutation.isPending && switchTarget?.id === biz.id}
                    onClick={() => setSwitchTarget(biz)}
                  >
                    Switch
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Settings className="h-4 w-4" />}
                  onClick={() => navigate(`/app/businesses/${biz.id}/settings`)}
                >
                  Settings
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Switch confirm modal */}
      <Modal
        open={!!switchTarget}
        onClose={() => setSwitchTarget(null)}
        title="Switch Business"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSwitchTarget(null)}>Cancel</Button>
            <Button
              loading={switchMutation.isPending}
              onClick={() => switchTarget && switchMutation.mutate(switchTarget.id)}
            >
              Switch
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Switch to <span className="font-semibold">{switchTarget?.name}</span>? Your current context will change.
        </p>
      </Modal>
    </div>
  )
}
