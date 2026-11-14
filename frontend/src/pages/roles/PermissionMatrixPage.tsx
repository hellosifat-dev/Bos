import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Save } from 'lucide-react'
import { Button }  from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Alert }   from '@/components/ui/Alert'
import { rolesApi, permissionsApi } from '@/api/users'
import type { Permission } from '@/types'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

// ─── Group permissions by module ─────────────────────────────────────────────
function groupByModule(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = []
    acc[p.module].push(p)
    return acc
  }, {} as Record<string, Permission[]>)
}

const ACTION_ORDER = ['view', 'create', 'edit', 'delete', 'export', 'import', 'approve', 'manage']

export function PermissionMatrixPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)

  // Load all permissions
  const { data: allPerms, isLoading: permsLoading } = useQuery({
    queryKey: ['permissions-all'],
    queryFn:  () => permissionsApi.list().then((r) => r.data),
  })

  // Load role with its current permissions
  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ['role', id],
    queryFn:  () => rolesApi.get(id!).then((r) => r.data),
    enabled:  !!id,
  })

  // Initialise selected permissions once role loads
  useEffect(() => {
    if (role && !initialized) {
      setSelected(new Set(role.permissions?.map((p: Permission) => p.id) ?? []))
      setInitialized(true)
    }
  }, [role, initialized])

  const saveMutation = useMutation({
    mutationFn: () => rolesApi.syncPermissions(id!, Array.from(selected)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role', id] })
      toast.success('Permissions saved.')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save permissions.'),
  })

  const isLoading = permsLoading || roleLoading
  const grouped   = groupByModule(allPerms ?? [])
  const modules   = Object.keys(grouped).sort()

  const toggle = (permId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(permId) ? next.delete(permId) : next.add(permId)
      return next
    })
  }

  const toggleModule = (module: string) => {
    const ids = grouped[module].map((p) => p.id)
    const allOn = ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => allOn ? next.delete(id) : next.add(id))
      return next
    })
  }

  const toggleAll = () => {
    const allIds = (allPerms ?? []).map((p) => p.id)
    const allOn  = allIds.every((id) => selected.has(id))
    setSelected(allOn ? new Set() : new Set(allIds))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {role?.name ?? 'Role'} — Permissions
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {selected.size} of {(allPerms ?? []).length} permissions granted
            </p>
          </div>
        </div>
        <Button
          icon={<Save className="h-4 w-4" />}
          loading={saveMutation.isPending}
          disabled={isLoading || !!role?.is_system}
          onClick={() => saveMutation.mutate()}
        >
          Save Changes
        </Button>
      </div>

      {role?.is_system && (
        <Alert variant="warning">
          System roles cannot be modified. Their permissions are managed by the platform.
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Select-all header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={(allPerms ?? []).every((p) => selected.has(p.id))}
              onChange={toggleAll}
              disabled={!!role?.is_system}
            />
            <span className="text-sm font-semibold text-gray-700">Select All</span>
          </div>

          {/* Module rows */}
          {modules.map((module) => {
            const perms   = grouped[module]
            const actions = ACTION_ORDER.filter((a) => perms.some((p) => p.action === a))
            const extraActions = perms.filter((p) => !ACTION_ORDER.includes(p.action)).map((p) => p.action)
            const allActions = [...actions, ...extraActions]
            const moduleAllOn  = perms.every((p) => selected.has(p.id))
            const moduleSomeOn = perms.some((p) => selected.has(p.id))

            return (
              <div key={module} className="border-b border-gray-100 last:border-b-0">
                {/* Module header */}
                <div className="flex items-center gap-3 px-5 py-3 bg-gray-50/50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={moduleAllOn}
                    ref={(el) => { if (el) el.indeterminate = !moduleAllOn && moduleSomeOn }}
                    onChange={() => toggleModule(module)}
                    disabled={!!role?.is_system}
                  />
                  <span className="text-sm font-semibold text-gray-800 capitalize">
                    {module.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({perms.filter((p) => selected.has(p.id)).length}/{perms.length})
                  </span>
                </div>

                {/* Permission checkboxes */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 px-10 py-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {allActions.map((action) => {
                    const perm = perms.find((p) => p.action === action)
                    if (!perm) return null
                    const checked = selected.has(perm.id)
                    return (
                      <label
                        key={perm.id}
                        className={clsx(
                          'flex items-center gap-2 text-sm cursor-pointer',
                          role?.is_system && 'cursor-not-allowed opacity-60'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={checked}
                          onChange={() => toggle(perm.id)}
                          disabled={!!role?.is_system}
                        />
                        <span className={clsx('capitalize', checked ? 'text-gray-800' : 'text-gray-400')}>
                          {action}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
