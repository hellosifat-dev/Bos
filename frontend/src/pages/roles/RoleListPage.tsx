import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Shield, Lock, Pencil, Trash2, KeySquare } from 'lucide-react'
import { Button }  from '@/components/ui/Button'
import { Badge }   from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Modal }   from '@/components/ui/Modal'
import { Alert }   from '@/components/ui/Alert'
import { Card }    from '@/components/ui/Card'
import { rolesApi } from '@/api/users'
import type { Role } from '@/types'
import toast from 'react-hot-toast'

export function RoleListPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => rolesApi.list().then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      setDeleteTarget(null)
      toast.success('Role deleted.')
    },
    onError: (err: Error) => toast.error(err.message || 'Cannot delete this role.'),
  })

  const roles: Role[] = data ?? []
  const systemRoles   = roles.filter((r) => r.is_system)
  const customRoles   = roles.filter((r) => !r.is_system)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
          <p className="mt-0.5 text-sm text-gray-500">Define access levels for your team</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/app/roles/new')}>
          New Role
        </Button>
      </div>

      {error && <Alert variant="error">Failed to load roles.</Alert>}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-6">
          {/* System roles */}
          {systemRoles.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                System Roles
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {systemRoles.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    onPermissions={() => navigate(`/app/roles/${role.id}/permissions`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom roles */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Custom Roles
            </h2>
            {customRoles.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
                <Shield className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No custom roles yet.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  className="mt-3"
                  onClick={() => navigate('/app/roles/new')}
                >
                  Create Role
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {customRoles.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    onEdit={() => navigate(`/app/roles/${role.id}/edit`)}
                    onPermissions={() => navigate(`/app/roles/${role.id}/permissions`)}
                    onDelete={() => setDeleteTarget(role)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Role"
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
          Delete role <span className="font-semibold">{deleteTarget?.name}</span>? Users with this role will lose their access.
        </p>
      </Modal>
    </div>
  )
}

// ─── Role card ────────────────────────────────────────────────────────────────
function RoleCard({
  role,
  onEdit,
  onDelete,
  onPermissions,
}: {
  role:          Role
  onEdit?:       () => void
  onDelete?:     () => void
  onPermissions: () => void
}) {
  return (
    <Card padding="sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {role.is_system
            ? <Lock className="h-4 w-4 text-gray-400 flex-shrink-0" />
            : <Shield className="h-4 w-4 text-primary-500 flex-shrink-0" />}
          <h3 className="font-medium text-gray-900 text-sm">{role.name}</h3>
        </div>
        {role.is_system && (
          <Badge variant="default" size="sm">System</Badge>
        )}
      </div>
      {role.description && (
        <p className="mt-2 text-xs text-gray-500 line-clamp-2">{role.description}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<KeySquare className="h-3.5 w-3.5" />}
          onClick={onPermissions}
        >
          Permissions
        </Button>
        {!role.is_system && onEdit && (
          <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit} />
        )}
        {!role.is_system && onDelete && (
          <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} onClick={onDelete} />
        )}
      </div>
    </Card>
  )
}
