import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, UserCircle2, Pencil, Trash2, Shield } from 'lucide-react'
import { Button }     from '@/components/ui/Button'
import { Input }      from '@/components/ui/Input'
import { Badge }      from '@/components/ui/Badge'
import { Modal }      from '@/components/ui/Modal'
import { Alert }      from '@/components/ui/Alert'
import { Table, Pagination } from '@/components/ui/Table'
import type { Column }   from '@/components/ui/Table'
import { usersApi }      from '@/api/users'
import type { User }     from '@/types'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/format'

export function UserListPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', { page, search }],
    queryFn:  () => usersApi.list({ page, per_page: 15, search: search || undefined }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
      toast.success('User removed.')
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, 'Failed to remove user.')),
  })

  const columns: Column<User>[] = [
    {
      key:    'name',
      header: 'User',
      cell:   (u) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary-700">
              {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{u.name}</p>
            <p className="text-xs text-gray-400">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key:    'phone',
      header: 'Phone',
      cell:   (u) => <span className="text-sm text-gray-600">{u.phone ?? '—'}</span>,
    },
    {
      key:    'status',
      header: 'Status',
      cell:   (u) => (
        <Badge variant={u.status === 'active' ? 'success' : 'warning'} dot>
          {u.status}
        </Badge>
      ),
    },
    {
      key:    'actions',
      header: '',
      align:  'right',
      cell:   (u) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Shield className="h-3.5 w-3.5" />}
            onClick={(e) => { e.stopPropagation(); navigate(`/app/users/${u.id}/roles`) }}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={(e) => { e.stopPropagation(); navigate(`/app/users/${u.id}/edit`) }}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(u) }}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage team members and their access</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/app/users/new')}>
          Invite User
        </Button>
      </div>

      {error && <Alert variant="error">Failed to load users.</Alert>}

      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search users…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {data?.data?.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <UserCircle2 className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No users found</h3>
          <p className="mt-1 text-sm text-gray-400 mb-6">Invite your first team member.</p>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/app/users/new')}>
            Invite User
          </Button>
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            data={data?.data ?? []}
            keyExtractor={(u) => u.id}
            loading={isLoading}
            emptyMessage="No users match your search."
            onRowClick={(u) => navigate(`/app/users/${u.id}`)}
          />
          {data && (
            <Pagination
              page={page}
              total={data.meta?.total ?? 0}
              perPage={15}
              onChange={setPage}
            />
          )}
        </>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove User"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Remove <span className="font-semibold">{deleteTarget?.name}</span> from this business?
        </p>
      </Modal>
    </div>
  )
}
