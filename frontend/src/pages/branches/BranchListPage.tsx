import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Star, Pencil, Trash2 } from 'lucide-react'
import { Button }  from '@/components/ui/Button'
import { Badge }   from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Modal }   from '@/components/ui/Modal'
import { Alert }   from '@/components/ui/Alert'
import { branchApi } from '@/api/business'
import { useAuthStore } from '@/stores/authStore'
import type { Branch } from '@/types'
import toast from 'react-hot-toast'

export function BranchListPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const { currentBusiness } = useAuthStore()
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['branches', currentBusiness?.id],
    queryFn:  () => branchApi.list().then((r) => r.data.data),
    enabled:  !!currentBusiness?.id,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => branchApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] })
      setDeleteTarget(null)
      toast.success('Branch deleted.')
    },
    onError: (err: Error) => toast.error(err.message || 'Cannot delete branch.'),
  })

  const branches: Branch[] = data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          <p className="mt-0.5 text-sm text-gray-500">{currentBusiness?.name}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/app/branches/new')}>
          Add Branch
        </Button>
      </div>

      {error && <Alert variant="error">Failed to load branches.</Alert>}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <MapPin className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No branches yet</h3>
          <p className="mt-1 text-sm text-gray-400 mb-6">Add your first branch location.</p>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/app/branches/new')}>
            Add Branch
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <div key={branch.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-50 p-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                      {branch.is_headquarters && (
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Code: {branch.code}</p>
                  </div>
                </div>
                <Badge variant={branch.status === 'active' ? 'success' : 'default'} dot>
                  {branch.status}
                </Badge>
              </div>

              {branch.address?.city && (
                <p className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[branch.address.city, branch.address.state].filter(Boolean).join(', ')}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => navigate(`/app/branches/${branch.id}/edit`)}
                >
                  Edit
                </Button>
                {!branch.is_headquarters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                    onClick={() => setDeleteTarget(branch)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Branch"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Delete <span className="font-semibold">{deleteTarget?.name}</span>? This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
