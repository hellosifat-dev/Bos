import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { apiClient } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Table, Pagination, type Column } from '@/components/ui/Table'
import { ResourceForm, type Field } from '@/components/resource/ResourcePage'
import { usePermission } from '@/hooks/usePermission'
import { formatDate, getErrorMessage } from '@/utils/format'

interface Leave {
  id: number; type: string; start_date: string; end_date: string; days: string; reason?: string; status: string
  employee?: { name: string; employee_code: string }; review_note?: string
}

const fields: Field[] = [
  { name: 'employee_id', label: 'Employee', type: 'select', required: true, optionsFrom: { endpoint: '/employees', label: (e) => `${e.name} (${e.employee_code})` } },
  { name: 'type', label: 'Leave type', type: 'select', required: true, defaultValue: 'annual', options: [
    { value: 'annual', label: 'Annual' }, { value: 'sick', label: 'Sick' }, { value: 'casual', label: 'Casual' },
    { value: 'unpaid', label: 'Unpaid (deducted from pay)' }, { value: 'other', label: 'Other' },
  ] },
  { name: 'start_date', label: 'From', type: 'date', required: true },
  { name: 'end_date', label: 'To', type: 'date', required: true },
  { name: 'reason', label: 'Reason', type: 'textarea' },
]
const variant: Record<string, 'warning' | 'success' | 'danger'> = { pending: 'warning', approved: 'success', rejected: 'danger' }

export function LeavePage() {
  const qc = useQueryClient()
  const { can } = usePermission()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({ type: 'annual' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['leave', status, page],
    queryFn: () => apiClient.get('/leave-requests', { params: { status: status || undefined, page } })
      .then((r) => r.data as { data: Leave[]; meta: { total: number; per_page: number } }),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['leave'] })
  const onErr = (e: unknown) => toast.error(getErrorMessage(e))

  const create = useMutation({
    mutationFn: () => apiClient.post('/leave-requests', form),
    onSuccess: () => { toast.success('Leave requested.'); setOpen(false); setForm({ type: 'annual' }); refresh() },
    onError: (err: any) => {
      const e = err?.response?.data?.errors as Record<string, string[]> | undefined
      if (e) setErrors(Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v[0]])))
      onErr(err)
    },
  })
  const act = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'reject' | 'delete' }) =>
      action === 'delete' ? apiClient.delete(`/leave-requests/${id}`) : apiClient.post(`/leave-requests/${id}/${action}`),
    onSuccess: () => { toast.success('Updated.'); refresh() },
    onError: onErr,
  })

  const columns: Column<Leave>[] = [
    { key: 'employee', header: 'Employee', cell: (l) => l.employee?.name ?? '—' },
    { key: 'type', header: 'Type', cell: (l) => <span className="capitalize">{l.type}</span> },
    { key: 'dates', header: 'Dates', cell: (l) => `${formatDate(l.start_date)} – ${formatDate(l.end_date)}` },
    { key: 'days', header: 'Days', align: 'right', cell: (l) => Number(l.days) },
    { key: 'reason', header: 'Reason', cell: (l) => l.reason ?? '—' },
    { key: 'status', header: 'Status', cell: (l) => <Badge variant={variant[l.status]}>{l.status}</Badge> },
    { key: 'actions', header: '', align: 'right', cell: (l) => l.status !== 'pending' ? null : (
      <div className="flex justify-end gap-1">
        {can('approve', 'leave') && <Button size="sm" variant="ghost" aria-label="Approve" onClick={() => act.mutate({ id: l.id, action: 'approve' })}><Check className="h-4 w-4 text-green-600" /></Button>}
        {can('reject', 'leave') && <Button size="sm" variant="ghost" aria-label="Reject" onClick={() => act.mutate({ id: l.id, action: 'reject' })}><X className="h-4 w-4 text-red-600" /></Button>}
        {can('create', 'leave') && <Button size="sm" variant="ghost" aria-label="Withdraw" onClick={() => act.mutate({ id: l.id, action: 'delete' })}><Trash2 className="h-4 w-4 text-gray-500" /></Button>}
      </div>
    ) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Leave</h1>
        {can('create', 'leave') && <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setErrors({}); setOpen(true) }}>Request leave</Button>}
      </div>
      <Card padding="none">
        <div className="border-b p-4"><div className="w-56">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} placeholder="All statuses"
                  options={['pending', 'approved', 'rejected'].map((v) => ({ value: v, label: v }))} />
        </div></div>
        <Table columns={columns} data={data?.data ?? []} keyExtractor={(l) => l.id} loading={isLoading} emptyMessage="No leave requests." />
        {data?.meta && data.meta.total > data.meta.per_page && (
          <div className="border-t p-4"><Pagination page={page} total={data.meta.total} perPage={data.meta.per_page} onChange={setPage} /></div>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Request leave" size="xl"
             footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
               <Button loading={create.isPending} onClick={() => create.mutate()}>Submit</Button></div>}>
        <ResourceForm fields={fields} initial={form} errors={errors} onChange={setForm} />
      </Modal>
    </div>
  )
}
