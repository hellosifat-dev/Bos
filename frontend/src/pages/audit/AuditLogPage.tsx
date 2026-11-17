import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Input }      from '@/components/ui/Input'
import { Select }     from '@/components/ui/Select'
import { Badge }      from '@/components/ui/Badge'
import { Alert }      from '@/components/ui/Alert'
import { Table, Pagination } from '@/components/ui/Table'
import type { Column }      from '@/components/ui/Table'
import { apiClient }        from '@/api/client'
import type { AuditLog }    from '@/types'
import { format }           from 'date-fns'

const actionOptions = [
  { value: '',        label: 'All Actions' },
  { value: 'create',  label: 'Create' },
  { value: 'update',  label: 'Update' },
  { value: 'delete',  label: 'Delete' },
  { value: 'login',   label: 'Login' },
  { value: 'logout',  label: 'Logout' },
]

const actionVariant: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  create:  'success',
  update:  'info',
  delete:  'danger',
  login:   'default',
  logout:  'default',
}

export function AuditLogPage() {
  const [page,   setPage]   = useState(1)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', { page, search, action }],
    queryFn:  () => apiClient.get('/audit-logs', {
      params: { page, per_page: 20, search: search || undefined, action: action || undefined },
    }).then((r) => r.data),
  })

  const logs: AuditLog[] = data?.data ?? []

  const columns: Column<AuditLog>[] = [
    {
      key:    'action',
      header: 'Action',
      cell:   (l) => (
        <div>
          <Badge variant={actionVariant[l.action] ?? 'default'}>
            {l.action}
          </Badge>
        </div>
      ),
    },
    {
      key:    'module',
      header: 'Module',
      cell:   (l) => (
        <div>
          <span className="text-sm font-medium text-gray-700 capitalize">
            {l.module?.replace(/_/g, ' ')}
          </span>
          {l.record_id && (
            <span className="text-xs text-gray-400 block">ID: {l.record_id}</span>
          )}
        </div>
      ),
    },
    {
      key:    'user',
      header: 'User',
      cell:   (l) => (
        <span className="text-sm text-gray-600">
          {(l as AuditLog & { user?: { name: string } }).user?.name ?? `User #${l.user_id}`}
        </span>
      ),
    },
    {
      key:    'ip_address',
      header: 'IP Address',
      cell:   (l) => <span className="text-xs font-mono text-gray-500">{l.ip_address ?? '—'}</span>,
    },
    {
      key:    'created_at',
      header: 'Time',
      align:  'right',
      cell:   (l) => (
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {format(new Date(l.created_at), 'MMM d, HH:mm')}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-0.5 text-sm text-gray-500">Track all actions performed in your business</p>
      </div>

      {error && <Alert variant="error">Failed to load audit logs.</Alert>}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="Search by module, user…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="w-40">
          <Select
            options={actionOptions}
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <Table
        columns={columns}
        data={logs}
        keyExtractor={(l) => l.id}
        loading={isLoading}
        emptyMessage="No audit log entries found."
      />

      {data && (
        <Pagination
          page={page}
          total={data.meta?.total ?? 0}
          perPage={20}
          onChange={setPage}
        />
      )}
    </div>
  )
}
